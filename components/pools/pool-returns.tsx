import { getPoolsHistoricalEarnings } from "@/lib/db/queries/pools/historical-earnings";
import { feeDateKey, getPoolFeeSnapshots } from "@/lib/db/queries/pools/fees";
import { getMaxDelegatedStake } from "@/lib/db/queries/predictors/max-delegated-stake";
import { getSatoriPriceForDateSafe } from "@/lib/livecoinwatch";
import { mergeKnownPool, poolDisplayName } from "@/lib/pool-utils";
import { normalizePoolAddress } from "@/lib/pool-name-index";
import type { readPoolNameIndex } from "@/lib/pool-name-index-server";
import type { TopPoolWithName } from "@/lib/get-pool-and-date-params";
import { cacheLifeForDate } from "@/lib/db/cache-utils";
import {
  PoolReturnsTable,
  type PoolReturnSeries,
} from "./pool-returns-table";

interface PoolReturnsProps {
  topPools: TopPoolWithName[];
  date: Date;
}

async function getPoolReturnData({ topPools, date }: PoolReturnsProps) {
  "use cache";
  cacheLifeForDate(date);

  const pools = topPools
    .map((pool) => mergeKnownPool(pool))
    .filter((pool) => !pool.closed || pool.closed > date);

  if (pools.length === 0) return null;

  const [earnings, satoriPrice, fullStakeAmount] = await Promise.all([
    getPoolsHistoricalEarnings(pools, date, 90),
    getSatoriPriceForDateSafe(date),
    getMaxDelegatedStake(date),
  ]);

  const feeDates = Array.from(
    new Map(
      earnings
        .flatMap(({ data }) => data ?? [])
        .map((row) => {
          const date = new Date(row.date);
          return [feeDateKey(date), date] as const;
        })
    ).values()
  );
  const feeSnapshots = await getPoolFeeSnapshots(pools, feeDates);

  const series: PoolReturnSeries[] = earnings
    .map(({ pool, data }) => ({
      address: pool.address,
      name: pool.name,
      days: (data ?? [])
        .flatMap((d) => {
          const date = new Date(d.date);
          const fee = feeSnapshots[feeDateKey(date)]?.[pool.address];
          return fee
            ? [
                {
                  date: String(d.date),
                  eps: Number(d.earnings_per_staking_power) || 0,
                  fee,
                },
              ]
            : [];
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter((s) => s.days.length > 0);

  if (series.length === 0) return null;

  return { series, satoriPrice, fullStakeAmount: fullStakeAmount ?? 0 };
}

export async function PoolReturns({ topPools, date, poolNames }: PoolReturnsProps & {
  poolNames: ReturnType<typeof readPoolNameIndex>;
}) {
  // Keep the optional index out of the financial cache key and resolve labels per request.
  const [data, names] = await Promise.all([getPoolReturnData({ topPools, date }), poolNames]);
  if (!data) return null;

  const series = data.series.map((pool) => {
    const key = normalizePoolAddress(pool.address);
    const name = key === null ? undefined : names?.[key];
    return {
      ...pool,
      name: name === undefined
        ? poolDisplayName(
            pool.address,
            topPools.find((topPool) => topPool.address === pool.address)?.label_vault
          ) ?? pool.name
        : name ?? "Unknown Pool",
    };
  });

  return <PoolReturnsTable {...data} series={series} />;
}
