import ky from "ky";
import { cacheLife } from "next/cache";
import { redis } from "../redis";
import { getTodayMidnightUTC, normalizeToUTCMidnight } from "../date";
import { SATORI_API_EARLIEST_DATE } from "./api";

/**
 * Daily audit CSVs from network.satorinet.io — the most accurate per-neuron
 * source for stakers (lenders), workers and predictors.
 *
 * `?date=YYYY-MM-DD` works back to 2025-12-25 ("No audit found" before).
 * Historical days are immutable — parsed rows are cached in Redis forever.
 *
 * Pattern: cached inner functions THROW on network failure (so errors are
 * never cached), exported outer functions catch and return null.
 */
const BASE_URL = "https://network.satorinet.io/api/v1/audit";

const client = ky.create({
  prefix: BASE_URL,
  retry: { limit: 3, methods: ["get"] },
  timeout: 60_000,
});

export interface AuditStakerRow {
  observation_ts: string;
  peer_id: number;
  lender_wallet: string;
  lender_vault: string | null;
  lender_reward: string | null;
  pool_wallet: string;
  pool_vault: string | null;
  pool_reward: string | null;
  pool_balance: number;
  lender_contribution: number;
  pool_commission: number;
  share: number;
  reward_calculated: number;
}

export interface AuditWorkerRow {
  observation_ts: string;
  peer_id: number;
  worker_wallet: string;
  worker_vault: string | null;
  pool_wallet: string;
  pool_vault: string | null;
  worker_balance: number;
  pool_contribution: number;
  worker_distance: number;
  worker_reward_calculated: number;
  distributed_reward: number;
}

export interface AuditPredictorRow {
  observation_ts: string;
  peer_id: number;
  wallet_address: string;
  reward_address: string | null;
  vault_address: string | null;
  distance: number;
  balance: number;
  total: number;
}

/** Values never contain commas/quotes in these CSVs — plain split is enough. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]!.split(",");
  return lines.slice(1).map((line) => {
    const values = line.trim().split(",");
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]!] = values[i] ?? "";
    return row;
  });
}

const str = (v: string): string | null => (v === "" ? null : v);
const num = (v: string): number => {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

type AuditKind = "stakers" | "workers" | "predictors";

/** null = the API has no audit for that date. Throws on network failure. */
async function fetchAuditCsv(kind: AuditKind, date?: Date): Promise<string | null> {
  const path = date ? `${kind}?date=${date.toISOString().split("T")[0]}` : `${kind}/latest`;
  const res = await client.get(path, { throwHttpErrors: false });
  // Missing dates come back as 404 with a JSON body ("No audit found")
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Audit ${path} failed with status ${res.status}`);
  const text = await res.text();
  if (text.startsWith("{")) return null;
  return text;
}

function hasAuditData(date?: Date): boolean {
  if (!date) return true;
  const d = normalizeToUTCMidnight(date);
  return (
    d.getTime() >= SATORI_API_EARLIEST_DATE.getTime() &&
    d.getTime() <= getTodayMidnightUTC().getTime()
  );
}

async function getAudit<T>(
  kind: AuditKind,
  mapRow: (row: Record<string, string>) => T,
  date?: Date
): Promise<T[] | null> {
  if (!hasAuditData(date)) return null;

  const historical =
    date !== undefined &&
    normalizeToUTCMidnight(date).getTime() < getTodayMidnightUTC().getTime();
  const cacheKey = historical
    ? `satorinet:audit:${kind}:${date.toISOString().split("T")[0]}`
    : null;

  if (cacheKey) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as T[];
  }

  const csv = await fetchAuditCsv(kind, date);
  if (csv === null) return null;

  const rows = parseCsv(csv).map(mapRow);
  if (cacheKey) await redis.set(cacheKey, JSON.stringify(rows));
  return rows;
}

const mapStakerRow = (r: Record<string, string>): AuditStakerRow => ({
  observation_ts: r.observation_ts!,
  peer_id: num(r.peer_id!),
  lender_wallet: r.lender_wallet!,
  lender_vault: str(r.lender_vault!),
  lender_reward: str(r.lender_reward!),
  pool_wallet: r.pool_wallet!,
  pool_vault: str(r.pool_vault!),
  pool_reward: str(r.pool_reward!),
  pool_balance: num(r.pool_balance!),
  lender_contribution: num(r.lender_contribution!),
  pool_commission: num(r.pool_commission!),
  share: num(r.share!),
  reward_calculated: num(r.reward_calculated!),
});

const mapWorkerRow = (r: Record<string, string>): AuditWorkerRow => ({
  observation_ts: r.observation_ts!,
  peer_id: num(r.peer_id!),
  worker_wallet: r.worker_wallet!,
  worker_vault: str(r.worker_vault!),
  pool_wallet: r.pool_wallet!,
  pool_vault: str(r.pool_vault!),
  worker_balance: num(r.worker_balance!),
  pool_contribution: num(r.pool_contribution!),
  worker_distance: num(r.worker_distance!),
  worker_reward_calculated: num(r.worker_reward_calculated!),
  distributed_reward: num(r.distributed_reward!),
});

const mapPredictorRow = (r: Record<string, string>): AuditPredictorRow => ({
  observation_ts: r.observation_ts!,
  peer_id: num(r.peer_id!),
  wallet_address: r.wallet_address!,
  reward_address: str(r.reward_address!),
  vault_address: str(r.vault_address!),
  distance: num(r.distance!),
  balance: num(r.balance!),
  total: num(r.total!),
});

async function getAuditStakersCached(date?: Date): Promise<AuditStakerRow[] | null> {
  "use cache";
  cacheLife("hours");
  return getAudit("stakers", mapStakerRow, date);
}

async function getAuditWorkersCached(date?: Date): Promise<AuditWorkerRow[] | null> {
  "use cache";
  cacheLife("hours");
  return getAudit("workers", mapWorkerRow, date);
}

async function getAuditPredictorsCached(date?: Date): Promise<AuditPredictorRow[] | null> {
  "use cache";
  cacheLife("hours");
  return getAudit("predictors", mapPredictorRow, date);
}

/** Lender→pool audit. `date` omitted = latest. Returns null when no audit exists for the date. */
export async function getAuditStakers(date?: Date): Promise<AuditStakerRow[] | null> {
  try {
    return await getAuditStakersCached(date);
  } catch (e) {
    console.error("Error fetching audit stakers", e);
    return null;
  }
}

/** Worker→pool audit. `date` omitted = latest. Returns null when no audit exists for the date. */
export async function getAuditWorkers(date?: Date): Promise<AuditWorkerRow[] | null> {
  try {
    return await getAuditWorkersCached(date);
  } catch (e) {
    console.error("Error fetching audit workers", e);
    return null;
  }
}

/** Predictor audit. `date` omitted = latest. Returns null when no audit exists for the date. */
export async function getAuditPredictors(date?: Date): Promise<AuditPredictorRow[] | null> {
  try {
    return await getAuditPredictorsCached(date);
  } catch (e) {
    console.error("Error fetching audit predictors", e);
    return null;
  }
}
