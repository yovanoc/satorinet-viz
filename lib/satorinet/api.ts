import ky from "ky";
import Bottleneck from "bottleneck";
import { cacheLife } from "next/cache";
import * as z from "zod/mini";
import { redis } from "../redis";
import { getTodayMidnightUTC, normalizeToUTCMidnight } from "../date";

/**
 * Client for the satorinet.io website API.
 *
 * satorinet.io rate-limits aggressively ("Too many requests"), so every
 * request goes through one shared limiter. Data updates once every 24h.
 * Historical data (leaderboard by date) is immutable — cached in Redis forever.
 *
 * Pattern: the cached inner functions THROW on failure (so errors are never
 * cached), the exported outer functions catch and return null/[] fallbacks.
 */
const BASE_URL = "https://satorinet.io/api";

/** Earliest date the satorinet.io/network.satorinet.io date-params have data for. */
export const SATORI_API_EARLIEST_DATE = new Date(Date.UTC(2025, 11, 25));

// ponytail: single global limiter, ~1 req/1.2s — their rate limit is per-IP and data changes daily
const limiter = new Bottleneck({ maxConcurrent: 1, minTime: 1200 });

const client = ky.create({
  prefix: BASE_URL,
  retry: { limit: 3, methods: ["get"] },
  timeout: 30_000,
});

function toDateParam(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function isHistorical(date: Date): boolean {
  return normalizeToUTCMidnight(date).getTime() < getTodayMidnightUTC().getTime();
}

async function fetchParsed<T>(
  path: string,
  schema: z.ZodMiniType<T>,
  searchParams?: Record<string, string>
): Promise<T> {
  const res = await limiter.schedule(() => client.get(path, { searchParams }).json());
  return schema.parse(res);
}

// ---------------------------------------------------------------------------
// /api/satori-price — live price (no history)
// ---------------------------------------------------------------------------

const satoriPriceSchema = z.object({
  price: z.number(),
  source: z.string(),
  change_percent: z.string(),
  updated_at: z.number(),
});
export type SatoriPrice = z.infer<typeof satoriPriceSchema>;

async function getSatoriPriceLiveCached(): Promise<SatoriPrice> {
  "use cache";
  cacheLife("hours");
  return fetchParsed("satori-price", satoriPriceSchema);
}

export async function getSatoriPriceLive(): Promise<SatoriPrice | null> {
  try {
    return await getSatoriPriceLiveCached();
  } catch (e) {
    console.error("Error fetching satori-price", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// /api/wallet-holders — total holder count (no history)
// ---------------------------------------------------------------------------

const walletHoldersSchema = z.object({ count: z.number() });

async function getWalletHoldersCountCached(): Promise<number> {
  "use cache";
  cacheLife("hours");
  return (await fetchParsed("wallet-holders", walletHoldersSchema)).count;
}

export async function getWalletHoldersCount(): Promise<number | null> {
  try {
    return await getWalletHoldersCountCached();
  } catch (e) {
    console.error("Error fetching wallet-holders", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// /api/holder-aggregation — holder tier distribution (no history)
// ---------------------------------------------------------------------------

const holderTierSchema = z.object({
  name: z.string(),
  min: z.number(),
  max: z.nullable(z.number()),
  holders: z.number(),
  totalBalance: z.number(),
  percentOfSupply: z.number(),
  percentOfHolders: z.number(),
});

const holderAggregationSchema = z.object({
  totalHolders: z.number(),
  totalSatori: z.number(),
  tiers: z.array(holderTierSchema),
});
export type HolderAggregation = z.infer<typeof holderAggregationSchema>;
export type HolderTier = z.infer<typeof holderTierSchema>;

async function getHolderAggregationCached(): Promise<HolderAggregation> {
  "use cache";
  cacheLife("hours");
  return fetchParsed("holder-aggregation", holderAggregationSchema);
}

export async function getHolderAggregation(): Promise<HolderAggregation | null> {
  try {
    return await getHolderAggregationCached();
  } catch (e) {
    console.error("Error fetching holder-aggregation", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// /api/pools — live pool registry (no history)
// ---------------------------------------------------------------------------

const livePoolSchema = z.object({
  address: z.string(),
  alias: z.nullable(z.string()),
  commission: z.number(),
  version: z.nullable(z.string()),
  worker_count: z.number(),
  active_workers: z.number(),
  lender_count: z.number(),
  total_lent: z.number(),
  avg_worker_earnings: z.number(),
});
export type LivePool = z.infer<typeof livePoolSchema>;

const livePoolsResponseSchema = z.object({ pools: z.array(livePoolSchema) });

async function getLivePoolsCached(): Promise<LivePool[]> {
  "use cache";
  cacheLife("hours");
  return (await fetchParsed("pools", livePoolsResponseSchema)).pools;
}

export async function getLivePools(): Promise<LivePool[]> {
  try {
    return await getLivePoolsCached();
  } catch (e) {
    console.error("Error fetching pools", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// /api/leaderboard — neuron ranking, paginated (limit fixed at 25), ?date=
// ---------------------------------------------------------------------------

const scoreBreakdownSchema = z.object({
  bitcoin_skill: z.number(),
  accuracy: z.number(),
  crypto_skill: z.number(),
  experience: z.number(),
});

const leaderboardPredictorSchema = z.object({
  rank: z.number(),
  wallet_address: z.string(),
  reward_address: z.nullable(z.string()),
  distance: z.number(),
  balance: z.number(),
  reward: z.number(),
  n_obs: z.number(),
  n_eff: z.number(),
  skill_sum: z.number(),
  round_score: z.number(),
  quality_score: z.number(),
  tier: z.string(),
  score_breakdown: scoreBreakdownSchema,
});
export type LeaderboardPredictor = z.infer<typeof leaderboardPredictorSchema>;

const leaderboardPageSchema = z.object({
  observation_ts: z.string(),
  total_distributed: z.number(),
  predictor_count: z.number(),
  page: z.object({
    limit: z.number(),
    offset: z.number(),
    returned: z.number(),
    has_more: z.boolean(),
  }),
  scoring_weights: z.record(z.string(), z.number()),
  predictors: z.array(leaderboardPredictorSchema),
});
export type LeaderboardPage = z.infer<typeof leaderboardPageSchema>;

async function fetchLeaderboardPage(date: Date, offset: number): Promise<LeaderboardPage> {
  const day = toDateParam(date);
  const cacheKey = `satorinet:leaderboard:${day}:${offset}`;
  const historical = isHistorical(date);

  if (historical) {
    const cached = await redis.get(cacheKey);
    if (cached) return leaderboardPageSchema.parse(JSON.parse(cached));
  }

  const page = await fetchParsed("leaderboard", leaderboardPageSchema, {
    offset: String(offset),
    date: day,
  });
  if (historical) await redis.set(cacheKey, JSON.stringify(page));
  return page;
}

async function getLeaderboardPageCached(date: Date, offset: number): Promise<LeaderboardPage> {
  "use cache";
  cacheLife("hours");
  return fetchLeaderboardPage(date, offset);
}

/** One page (25 rows) of the leaderboard for a date. Historical pages are cached in Redis forever. */
export async function getLeaderboardPage(
  date: Date,
  offset = 0
): Promise<LeaderboardPage | null> {
  try {
    return await getLeaderboardPageCached(date, offset);
  } catch (e) {
    console.error(`Error fetching leaderboard ${toDateParam(date)} offset=${offset}`, e);
    return null;
  }
}

export type Leaderboard = Omit<LeaderboardPage, "page">;

/**
 * The full leaderboard for a date (walks pagination — ~80 throttled requests
 * the first time, then served from Redis forever for historical dates).
 */
export async function getFullLeaderboard(date: Date): Promise<Leaderboard | null> {
  const day = toDateParam(date);
  const cacheKey = `satorinet:leaderboard-full:${day}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as Leaderboard;

    const first = await fetchLeaderboardPage(date, 0);
    const predictors = [...first.predictors];
    let page = first.page;
    while (page.has_more) {
      const next = await fetchLeaderboardPage(date, page.offset + page.returned);
      predictors.push(...next.predictors);
      page = next.page;
    }

    const result: Leaderboard = {
      observation_ts: first.observation_ts,
      total_distributed: first.total_distributed,
      predictor_count: first.predictor_count,
      scoring_weights: first.scoring_weights,
      predictors,
    };

    // Historical days are immutable — keep forever. Today may still change — 1h TTL.
    if (isHistorical(date)) await redis.set(cacheKey, JSON.stringify(result));
    else await redis.setex(cacheKey, 60 * 60, JSON.stringify(result));

    return result;
  } catch (e) {
    console.error(`Error fetching full leaderboard ${day}`, e);
    return null;
  }
}
