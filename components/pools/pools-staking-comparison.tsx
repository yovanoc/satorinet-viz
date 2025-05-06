import {
  KNOWN_POOLS,
  mostWantedTop,
  type Pool,
  type TopPool,
} from "@/lib/known_pools";
import {
  PoolsStakingComparisonChart,
  type Entry,
} from "./pools-staking-comparison-chart";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getPoolFeesForDate } from "@/lib/pool-utils";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { getPoolsHistoricalEarnings } from "@/lib/db/queries/pools/historical-earnings";
import { getMaxDelegatedStake } from "@/lib/db/queries/predictors/max-delegated-stake";

interface PoolsStakingComparisonProps {
  date: Date;
  topPools: TopPool[];
}

async function transformData(
  rawData: Awaited<ReturnType<typeof getPoolsHistoricalEarnings>>
): Promise<Entry[]> {
  const dateMap = new Map<
    string,
    {
      satoriPrice: number;
      fullStakeAmount: number;
      pools: Record<
        string,
        {
          pool: Pool;
          earnings_per_staking_power: number;
          fees: ReturnType<typeof getPoolFeesForDate>;
        }
      >;
    }
  >();

  for (const { pool, data } of rawData) {
    if (!data) continue;
    await Promise.all(
      data.map(async ({ date, earnings_per_staking_power }) => {
        if (pool.closed && pool.closed <= new Date(date)) return;
        if (!dateMap.has(date)) {
          const dateObj = new Date(date);
          const [satoriPrice, fullStakeAmount] = await Promise.all([
            getSatoriPriceForDate(dateObj),
            getMaxDelegatedStake(dateObj),
          ]);

          dateMap.set(date, {
            satoriPrice,
            fullStakeAmount: fullStakeAmount ?? 0,
            pools: {},
          });
        }
        dateMap.get(date)!.pools[pool.address] = {
          pool,
          earnings_per_staking_power,
          fees: getPoolFeesForDate(pool, new Date(date)),
        };
      })
    );
  }

  return Array.from(dateMap.entries())
    .map(([date, data]) => ({
      date: new Date(date),
      satoriPrice: data.satoriPrice,
      fullStakeAmount: data.fullStakeAmount,
      poolEarnings: data.pools,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function PoolsStakingComparison({
  date,
  topPools,
}: PoolsStakingComparisonProps) {
  "use cache";
  cacheLife("max");

  const [satoriPrice, fullStakeAmount] = await Promise.all([
    getSatoriPriceForDate(date),
    getMaxDelegatedStake(date),
  ]);

  const top3 = mostWantedTop(topPools)
    .map((pool) => KNOWN_POOLS.find((p) => p.address === pool.address))
    .filter((pool) => !!pool);

  const data = await getPoolsHistoricalEarnings(top3, date);
  const transformedData = await transformData(data);

  return (
    <PoolsStakingComparisonChart
      data={transformedData}
      pools={top3}
      fullStakeAmount={fullStakeAmount ?? 0}
      satoriPrice={satoriPrice}
    />
  );
}
