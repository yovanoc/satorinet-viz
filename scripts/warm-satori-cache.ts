/**
 * Warms the Redis cache with satorinet.io / network.satorinet.io data so
 * deployments whose IPs Cloudflare blocks (Vercel) can serve everything
 * from Redis. Run from any machine/CI whose IP passes (residential, GHA...).
 *
 *   REDIS_URL=... pnpm warm                              # latest + today + yesterday
 *   REDIS_URL=... BACKFILL_SINCE=2025-12-25 pnpm warm    # + all historical days (resumable)
 *
 * Keys written match what lib/satorinet/{api,audit}.ts read:
 *   satorinet:raw:<path>                      latest JSON endpoints (TTL 26h)
 *   satorinet:raw:audit:<kind>:<latest|day>   raw audit CSVs (latest TTL 26h, today TTL 3h, past forever)
 *   satorinet:leaderboard:<day>:<offset>      leaderboard pages (today TTL 3h, past forever)
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { Redis } from "ioredis";
import { impitFetch } from "../lib/satorinet/transport";

const REDIS_CONNECT_TIMEOUT_MS = 5_000;

function createRedis(rawUrl: string | undefined): Redis {
  const url = rawUrl?.trim();
  if (!url) {
    throw new Error(
      "REDIS_URL is required; add the production REDIS_URL repository secret before running the cache warmer",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("REDIS_URL must be a valid redis:// or rediss:// URL");
  }
  if (!parsed.hostname || !["redis:", "rediss:"].includes(parsed.protocol)) {
    throw new Error("REDIS_URL must be a valid redis:// or rediss:// URL");
  }

  return new Redis(url, {
    lazyConnect: true,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
}

function describeError(error: unknown): string {
  if (error instanceof Error && "errors" in error && Array.isArray(error.errors)) {
    const nested = error.errors.map((entry: unknown) => describeError(entry));
    if (nested.length > 0) return nested.join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

let redis!: Redis;
let lastRedisError: unknown;
const onRedisError = (error: unknown) => {
  lastRedisError = error;
  console.error(`Redis error: ${describeError(error)}`);
};

const EARLIEST = "2025-12-25";
const DELAY_MS = 1300;
const TTL_RAW = 26 * 3600;
const TTL_TODAY_LB = 3 * 3600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dayStr = (d: Date) => d.toISOString().split("T")[0]!;

let warmFailures = 0;

async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    await redis.ping();
  } catch (error) {
    const cause = lastRedisError ?? error;
    throw new Error(`Redis connection failed: ${describeError(cause)}`, {
      cause,
    });
  }
}

/** Throttled GET with 429 backoff; throws on HTTP errors, Cloudflare challenges, and data-gap 404/500s. */
async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    await sleep(DELAY_MS);
    const res = await impitFetch(url, {
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.text();
    if (res.status === 429 && attempt < 5) {
      console.log(`429, backing off 60s (${url})`);
      await sleep(60_000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    if (body.includes("Just a moment")) throw new Error(`Cloudflare challenge: ${url}`);
    return body;
  }
}

async function warmJsonLatest(): Promise<void> {
  for (const path of ["satori-price", "wallet-holders", "holder-aggregation", "pools"]) {
    try {
      const body = await get(`https://satorinet.io/api/${path}`);
      JSON.parse(body); // sanity: never store an HTML error page
      await redis.setex(`satorinet:raw:${path}`, TTL_RAW, body);
      console.log(`ok   ${path}`);
    } catch (e) {
      warmFailures++;
      console.error(`FAIL ${path}: ${describeError(e)}`);
    }
  }
}

async function warmAudit(day: string | null, today = dayStr(new Date())): Promise<void> {
  const mutable = day !== null && day === today;
  for (const kind of ["stakers", "workers", "predictors"]) {
    const key = `satorinet:raw:audit:${kind}:${day ?? "latest"}`;
    try {
      if (day && !mutable && (await redis.ttl(key)) === -1) continue; // immutable, already warmed
      const url = day
        ? `https://network.satorinet.io/api/v1/audit/${kind}?date=${day}`
        : `https://network.satorinet.io/api/v1/audit/${kind}/latest`;
      const body = await get(url);
      if (body.startsWith("{")) throw new Error("no audit data");
      if (day && mutable) await redis.setex(key, TTL_TODAY_LB, body);
      else if (day) await redis.set(key, body);
      else await redis.setex(key, TTL_RAW, body);
      console.log(`ok   audit ${kind} ${day ?? "latest"}`);
    } catch (e) {
      if (!day) warmFailures++;
      console.error(`FAIL audit ${kind} ${day ?? "latest"}: ${describeError(e)}`);
    }
  }
}

async function warmLeaderboard(day: string, forever: boolean): Promise<void> {
  let offset = 0;
  try {
    while (true) {
      const key = `satorinet:leaderboard:${day}:${offset}`;
      let page: { page?: { has_more?: boolean; returned?: number } };
      const cached = forever ? await redis.get(key) : null;
      if (cached) {
        page = JSON.parse(cached); // already warmed — just follow pagination
      } else {
        const body = await get(
          `https://satorinet.io/api/leaderboard?offset=${offset}&date=${day}`
        );
        page = JSON.parse(body);
        if (forever) await redis.set(key, body);
        else await redis.setex(key, TTL_TODAY_LB, body);
      }
      if (!page.page?.has_more || !page.page.returned) break;
      offset += page.page.returned;
    }
    console.log(`ok   leaderboard ${day} (${offset} rows+)`);
  } catch (e) {
    const message = describeError(e);
    if (forever && message.startsWith("HTTP 404:")) {
      console.log(`SKIP leaderboard ${day} @${offset}: historical gap`);
      return;
    }
    warmFailures++;
    console.error(`FAIL leaderboard ${day} @${offset}: ${message}`);
  }
}

function* daysBetween(from: string, to: string): Generator<string> {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    yield dayStr(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

async function main(): Promise<void> {
  redis = createRedis(process.env.REDIS_URL);
  redis.on("error", onRedisError);
  try {
    await connectRedis();

    const today = dayStr(new Date());
    const yesterday = dayStr(new Date(Date.now() - 86_400_000));

    await warmJsonLatest();
    await warmAudit(null, today);
    await warmAudit(today, today);
    await warmAudit(yesterday, today);
    await warmLeaderboard(today, false);
    await warmLeaderboard(yesterday, true);

    const since = process.env.BACKFILL_SINCE;
    if (since) {
      console.log(`Backfilling ${since} -> ${yesterday} (resumable, skips existing keys)`);
      for (const day of daysBetween(since < EARLIEST ? EARLIEST : since, yesterday)) {
        await warmAudit(day, today);
        await warmLeaderboard(day, true);
      }
    }

    if (warmFailures > 0) {
      throw new Error(
        `${warmFailures} required cache operation(s) failed; inspect the FAIL lines for the upstream error`,
      );
    }
  } finally {
    redis.off("error", onRedisError);
    redis.disconnect();
  }
}

void main().catch((error) => {
  console.error(`Warm Satori cache failed: ${describeError(error)}`);
  process.exitCode = 1;
});
