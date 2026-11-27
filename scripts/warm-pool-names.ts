import pg from "pg";
import { z } from "zod";
import type { Redis } from "ioredis";
import { POOL_NAME_INDEX_LIMITS as LIMITS, isPoolNameIndexDay, poolNameIndexKey } from "../lib/pool-name-index";
import { buildPoolNameIndex, type AuditAliasRow, type CrossChainLink, type DbPoolPair } from "./pool-name-index-builder";

export const MAX_NAME_AUDIT_BYTES = 2 * 1024 * 1024;
const TODAY_TTL = 21_600;
const SQL_TIMEOUT_MS = 4_000;

const registrySchema = z.object({
  pools: z.array(z.object({
    address: z.string(),
    pool_name: z.string().nullish(),
    alias: z.string().nullish(),
  }).refine((row) => row.pool_name !== undefined || row.alias !== undefined)).max(LIMITS.registryRows),
});
const dbPairsSchema = z.array(z.object({ pool_address: z.string().nullable(), pool_vault: z.string().nullable() }));
const linksSchema = z.array(z.object({
  evm_address: z.string(), evr_address: z.string(), kind: z.enum(["wallet", "vault"]), confidence: z.literal("certain"),
}));

// The upstream audit CSV has no quoted fields (see lib/satorinet/audit.ts).
export function parseAudit(body: string, day: string): AuditAliasRow[] {
  if (Buffer.byteLength(body) > MAX_NAME_AUDIT_BYTES) throw new Error("oversized audit");
  const [header = "", ...lines] = body.trimEnd().split(/\r?\n/);
  if (lines.length === 0 || lines.length > LIMITS.auditRows) throw new Error("invalid audit row count");
  const columns = header.replace(/^\uFEFF/, "").split(",");
  const timestamp = columns.indexOf("observation_ts");
  const alias = columns.indexOf("pool_alias");
  const wallet = columns.indexOf("pool_wallet");
  if (Math.min(timestamp, alias, wallet) < 0 || new Set(columns).size !== columns.length) {
    throw new Error("invalid audit header");
  }
  return lines.map((line) => {
    const fields = line.split(",");
    const stamp = fields[timestamp]?.trim() ?? "";
    if (fields.length !== columns.length || line.includes('"') ||
        !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(stamp) ||
        !isPoolNameIndexDay(stamp.slice(0, 10))) {
      throw new Error("invalid audit row");
    }
    const time = new Date(stamp.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
    if (!Number.isFinite(time.getTime()) || time.toISOString().slice(0, 10) !== day) {
      throw new Error("wrong audit day");
    }
    return { pool_alias: fields[alias]!, pool_wallet: fields[wallet]! };
  });
}

export async function loadPoolNameEvidence(connectionString: string, days: readonly string[]): Promise<{
  links: CrossChainLink[];
  pairs: Map<string, DbPoolPair[]>;
}> {
  const url = URL.parse(connectionString);
  if (!url) throw new Error("invalid pool names database URL");
  // pg merges connection string parameters over explicit connection settings.
  for (const key of ["connectionTimeoutMillis", "query_timeout", "statement_timeout"]) {
    url.searchParams.delete(key);
  }
  const client = new pg.Client({
    connectionString: url.href,
    connectionTimeoutMillis: 5_000,
    statement_timeout: SQL_TIMEOUT_MS,
    query_timeout: SQL_TIMEOUT_MS,
  });
  // pg emits an event for connection loss outside an in-flight query. Never log the raw error.
  client.on("error", () => {});
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '4s'");
    const { rows: links } = await client.query(`
      SELECT evm_address, evr_address, kind, confidence
      FROM public.evm_address_links
      WHERE confidence = 'certain' AND kind IN ('wallet', 'vault')
      LIMIT $1`, [LIMITS.links + 1]);
    const pairs = new Map<string, DbPoolPair[]>();
    for (const day of days) {
      const { rows } = await client.query(`
        SELECT DISTINCT pool_address, pool_vault
        FROM public.daily_contributor_address
        WHERE date = $1::date
        LIMIT $2`, [day, LIMITS.dbPairs + 1]);
      pairs.set(day, dbPairsSchema.parse(rows));
    }
    await client.query("COMMIT");
    return { links: linksSchema.parse(links), pairs };
  } finally {
    // Ending the connection also rolls back an unfinished transaction.
    await client.end();
  }
}

export type NameAudit = { day: string; body: string | null | undefined }; // null: confirmed gap; undefined: failed

export async function warmPoolNames(
  redis: Pick<Redis, "set">,
  connectionString: string,
  registryBody: string | undefined,
  audits: readonly NameAudit[],
  today: string,
  loadEvidence = loadPoolNameEvidence,
): Promise<boolean> {
  let registryRows;
  try {
    registryRows = registrySchema.parse(JSON.parse(registryBody ?? "")).pools;
  } catch {
    console.warn("SKIP pool names: unavailable or invalid registry");
    return false;
  }

  const dated = new Map<string, AuditAliasRow[]>();
  for (const { day, body } of audits) {
    try {
      if (body === undefined) throw new Error("audit unavailable");
      dated.set(day, body === null ? [] : parseAudit(body, day));
    } catch {
      console.warn(`SKIP pool names ${day}: unavailable, invalid or oversized stakers audit`);
    }
  }
  if (dated.size === 0) return false;

  let evidence;
  try {
    evidence = await loadEvidence(connectionString, [...dated.keys()]);
  } catch {
    console.warn("SKIP pool names: database read failed");
    return false;
  }

  let published = 0;
  const builtAt = new Date().toISOString();
  for (const [day, auditRows] of dated) {
    try {
      const dbPairs = evidence.pairs.get(day);
      if (!dbPairs) throw new Error("missing DB pairs");
      const result = buildPoolNameIndex({ day, builtAt, registryRows, auditRows, dbPairs, links: evidence.links });
      if (!result.ok) {
        console.warn(`SKIP pool names ${day}: ${result.reason}`);
        continue;
      }
      const key = poolNameIndexKey(day);
      const payload = JSON.stringify(result.index);
      // Do not persist a mutable audit if a run crosses UTC midnight.
      if (day === today) await redis.set(key, payload, "EX", TODAY_TTL);
      else await redis.set(key, payload);
      published++;
      console.log(`ok   pool names ${day}`);
    } catch {
      console.warn(`SKIP pool names ${day}: build or publish failed`);
    }
  }
  return published === audits.length;
}
