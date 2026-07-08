import { getPoolsHistoricalEarnings } from "@/lib/db/queries/pools/historical-earnings";
import { getMaxDelegatedStake } from "@/lib/db/queries/predictors/max-delegated-stake";
import { getSatoriPriceForDateSafe } from "@/lib/livecoinwatch";
import { KNOWN_POOLS } from "@/lib/known_pools";
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

export async function PoolReturns({ topPools, date }: PoolReturnsProps) {
  "use cache";
  cacheLifeForDate(date);

  const pools = KNOWN_POOLS.filter(
    (pool) =>
      (!pool.closed || pool.closed > date) &&
      topPools.some((tp) => tp.address === pool.address)
  );

  if (pools.length === 0) return null;

  const [earnings, satoriPrice, fullStakeAmount] = await Promise.all([
    getPoolsHistoricalEarnings(pools, date, 90),
    getSatoriPriceForDateSafe(date),
    getMaxDelegatedStake(date),
  ]);

  const series: PoolReturnSeries[] = earnings
    .map(({ pool, data }) => ({
      address: pool.address,
      name: pool.name,
      days: (data ?? [])
        .map((d) => ({
          date: String(d.date),
          eps: Number(d.earnings_per_staking_power) || 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter((s) => s.days.length > 0);

  if (series.length === 0) return null;

  return (
    <PoolReturnsTable
      series={series}
      satoriPrice={satoriPrice}
      fullStakeAmount={fullStakeAmount ?? 0}
    />
  );
}
