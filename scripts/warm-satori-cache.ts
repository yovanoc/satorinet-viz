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
 *   satorinet:raw:audit:<kind>:<latest|day>   raw audit CSVs (latest TTL 26h, days forever)
 *   satorinet:leaderboard:<day>:<offset>      leaderboard pages (today TTL 3h, past forever)
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { Impit } from "impit";
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);
const impit = new Impit({ browser: "chrome" });

const EARLIEST = "2025-12-25";
const DELAY_MS = 1300;
const TTL_RAW = 26 * 3600;
const TTL_TODAY_LB = 3 * 3600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dayStr = (d: Date) => d.toISOString().split("T")[0]!;

let criticalFailures = 0;

/** Throttled GET with 429 backoff; throws on HTTP errors, Cloudflare challenges, and data-gap 404/500s. */
async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    await sleep(DELAY_MS);
    const res = await impit.fetch(url, { timeout: 60_000 });
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
      criticalFailures++;
      console.error(`FAIL ${path}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function warmAudit(day: string | null): Promise<void> {
  for (const kind of ["stakers", "workers", "predictors"]) {
    const key = `satorinet:raw:audit:${kind}:${day ?? "latest"}`;
    try {
      if (day && (await redis.exists(key))) continue; // immutable, already warmed
      const url = day
        ? `https://network.satorinet.io/api/v1/audit/${kind}?date=${day}`
        : `https://network.satorinet.io/api/v1/audit/${kind}/latest`;
      const body = await get(url);
      if (body.startsWith("{")) throw new Error("no audit data");
      if (day) await redis.set(key, body);
      else await redis.setex(key, TTL_RAW, body);
      console.log(`ok   audit ${kind} ${day ?? "latest"}`);
    } catch (e) {
      if (!day) criticalFailures++;
      console.error(`FAIL audit ${kind} ${day ?? "latest"}: ${e instanceof Error ? e.message : e}`);
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
    console.error(`FAIL leaderboard ${day} @${offset}: ${e instanceof Error ? e.message : e}`);
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
  const today = dayStr(new Date());
  const yesterday = dayStr(new Date(Date.now() - 86_400_000));

  await warmJsonLatest();
  await warmAudit(null);
  await warmAudit(today);
  await warmAudit(yesterday);
  await warmLeaderboard(today, false);
  await warmLeaderboard(yesterday, true);

  const since = process.env.BACKFILL_SINCE;
  if (since) {
    console.log(`Backfilling ${since} -> ${yesterday} (resumable, skips existing keys)`);
    for (const day of daysBetween(since < EARLIEST ? EARLIEST : since, yesterday)) {
      await warmAudit(day);
      await warmLeaderboard(day, true);
    }
  }

  redis.quit();
  if (criticalFailures > 0) {
    console.error(`${criticalFailures} critical failure(s) — this IP may be blocked too`);
    process.exit(1);
  }
}

void main();
