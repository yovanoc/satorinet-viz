/**
 * Warms the Redis cache with satorinet.io / network.satorinet.io data so
 * deployments whose IPs Cloudflare blocks (Vercel) can serve everything
 * from Redis. Run from any machine/CI whose IP passes (residential, GHA...).
 *
 *   REDIS_URL=... pnpm warm                              # latest + today + yesterday
 *   REDIS_URL=... BACKFILL_SINCE=2025-12-25 pnpm warm    # + all historical days (resumable)
 *   REDIS_URL=... POOL_NAMES_DATABASE_URL=... POOL_NAMES_DATE=2026-11-26 pnpm warm # name index only
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
import { isPoolNameIndexDay } from "../lib/pool-name-index";
import { MAX_NAME_AUDIT_BYTES, parseAudit, warmPoolNames } from "./warm-pool-names";

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

class AuditGap extends Error {}

function isAuditGap(body: string): boolean {
  try {
    const error = JSON.parse(body);
    return [error, error?.detail, error?.message, error?.error].includes("No audit found");
  } catch {
    return false;
  }
}

async function readBoundedAudit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("missing stakers audit body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks, bytes).toString("utf8");
    bytes += value.byteLength;
    if (bytes > MAX_NAME_AUDIT_BYTES) {
      await reader.cancel();
      throw new Error("oversized stakers audit");
    }
    chunks.push(value);
  }
}

/** Throttled GET with 429 backoff; throws on upstream failures. */
async function get(url: string, names?: "collect" | "backfill"): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    await sleep(DELAY_MS);
    const res = await impitFetch(url, {
      signal: AbortSignal.timeout(60_000),
    });
    const body = names === "backfill" ? await readBoundedAudit(res) : await res.text();
    if (res.status === 429 && attempt < 5) {
      console.log(`429, backing off 60s (${url})`);
      await sleep(60_000);
      continue;
    }
    if (names && res.status === 404 && isAuditGap(body)) throw new AuditGap(`HTTP 404: ${url}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    if (body.includes("Just a moment")) throw new Error(`Cloudflare challenge: ${url}`);
    return body;
  }
}

async function warmJsonLatest(): Promise<string | undefined> {
  let registry;
  for (const path of ["satori-price", "wallet-holders", "holder-aggregation", "pools"]) {
    try {
      const body = await get(`https://satorinet.io/api/${path}`);
      JSON.parse(body); // sanity: never store an HTML error page
      await redis.setex(`satorinet:raw:${path}`, TTL_RAW, body);
      if (path === "pools") registry = body;
      console.log(`ok   ${path}`);
    } catch (e) {
      warmFailures++;
      console.error(`FAIL ${path}: ${describeError(e)}`);
    }
  }
  return registry;
}

async function warmAudit(day: string | null, today: string, collectNames = false): Promise<string | null | undefined> {
  const mutable = day !== null && day === today;
  let stakers;
  for (const kind of ["stakers", "workers", "predictors"]) {
    const collect = collectNames && day !== null && kind === "stakers";
    const key = `satorinet:raw:audit:${kind}:${day ?? "latest"}`;
    try {
      if (day && !mutable && (await redis.ttl(key)) === -1) {
        if (collect) stakers = await redis.getrange(key, 0, MAX_NAME_AUDIT_BYTES);
        continue; // immutable, already warmed
      }
      const url = day
        ? `https://network.satorinet.io/api/v1/audit/${kind}?date=${day}`
        : `https://network.satorinet.io/api/v1/audit/${kind}/latest`;
      const body = await get(url, collect ? "collect" : undefined);
      if (body.startsWith("{")) throw new Error("no audit data");
      if (day && mutable) await redis.setex(key, TTL_TODAY_LB, body);
      else if (day) await redis.set(key, body);
      else await redis.setex(key, TTL_RAW, body);
      // Raw warming keeps its existing behavior even when names cannot use the body.
      if (collect && Buffer.byteLength(body) <= MAX_NAME_AUDIT_BYTES) stakers = body;
      console.log(`ok   audit ${kind} ${day ?? "latest"}`);
    } catch (e) {
      if (collect && e instanceof AuditGap) stakers = null;
      if (!day) warmFailures++;
      console.error(`FAIL audit ${kind} ${day ?? "latest"}: ${describeError(e)}`);
    }
  }
  return stakers;
}

async function backfillPoolNames(day: string, today: string, database: string): Promise<void> {
  let registry;
  let body;
  try {
    const key = `satorinet:raw:audit:stakers:${day}`;
    registry = await get("https://satorinet.io/api/pools");
    if ((await redis.ttl(key)) === -1) {
      const cached = await redis.getrange(key, 0, MAX_NAME_AUDIT_BYTES);
      try {
        parseAudit(cached, day);
        body = cached;
      } catch {
        // Refetch invalid evidence without overwriting the permanent raw key.
      }
    }
    body ??= await get(`https://network.satorinet.io/api/v1/audit/stakers?date=${day}`, "backfill");
  } catch (error) {
    if (error instanceof AuditGap) body = null;
  }
  if (!(await warmPoolNames(redis, database, registry, [{ day, body }], today))) {
    throw new Error(`pool name backfill did not publish ${day}`);
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
  const now = Date.now();
  const today = dayStr(new Date(now));
  const yesterday = dayStr(new Date(now - 86_400_000));
  const database = process.env.POOL_NAMES_DATABASE_URL?.trim();
  const namesDate = process.env.POOL_NAMES_DATE;
  const since = process.env.BACKFILL_SINCE;
  if (namesDate) {
    if (!isPoolNameIndexDay(namesDate) || namesDate < EARLIEST || namesDate > yesterday) {
      throw new Error("POOL_NAMES_DATE must be one historical YYYY-MM-DD date (earliest 2025-12-25)");
    }
    if (since) throw new Error("POOL_NAMES_DATE and BACKFILL_SINCE cannot be combined");
    if (!database) throw new Error("POOL_NAMES_DATABASE_URL is required for pool name backfill");
  }

  redis = createRedis(process.env.REDIS_URL);
  redis.on("error", onRedisError);
  try {
    await connectRedis();
    if (namesDate && database) return await backfillPoolNames(namesDate, today, database);

    const registry = await warmJsonLatest();
    await warmAudit(null, today);
    const current = await warmAudit(today, today, Boolean(database));
    const finalized = await warmAudit(yesterday, today, Boolean(database));
    await warmLeaderboard(today, false);
    await warmLeaderboard(yesterday, true);

    if (database) {
      await warmPoolNames(redis, database, registry, [
        { day: today, body: current },
        { day: yesterday, body: finalized },
      ], today);
    }

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
