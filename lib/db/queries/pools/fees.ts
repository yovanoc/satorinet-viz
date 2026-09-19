import pLimit from "p-limit";
import { cacheLifeForDate } from "../../cache-utils";
import { getAuditStakers } from "@/lib/satorinet/audit";
import {
  resolvePoolFee,
  type FeePool,
  type ResolvedPoolFee,
} from "@/lib/pool-utils";

export type PoolFeeSnapshot = Record<string, ResolvedPoolFee>;
export type PoolFeeSnapshots = Record<string, PoolFeeSnapshot>;

const auditDateLimit = pLimit(4);

export function feeDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** One audit request for a date, then resolve every requested pool from that snapshot. */
export async function getPoolFeeSnapshot(
  pools: readonly FeePool[],
  date: Date
): Promise<PoolFeeSnapshot> {
  "use cache";
  cacheLifeForDate(date);

  const auditRows = await getAuditStakers(date);
  return Object.fromEntries(
    pools.map((pool) => [
      pool.address,
      resolvePoolFee(pool, date, auditRows),
    ])
  );
}

/** Build shared per-date maps so callers never fetch one audit CSV per pool. */
export async function getPoolFeeSnapshots(
  pools: readonly FeePool[],
  dates: readonly Date[]
): Promise<PoolFeeSnapshots> {
  const uniqueDates = Array.from(
    new Map(dates.map((date) => [feeDateKey(date), date])).values()
  );
  const snapshots = await Promise.all(
    uniqueDates.map((date) =>
      auditDateLimit(async () => [
        feeDateKey(date),
        await getPoolFeeSnapshot(pools, date),
      ] as const)
    )
  );
  return Object.fromEntries(snapshots);
}
