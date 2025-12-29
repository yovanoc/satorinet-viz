import {
  KNOWN_POOLS,
  mostWantedTop,
  type Pool,
  type TopPool,
} from "@/lib/known_pools";
import type { Entry } from "./pools-staking-comparison-chart";
import type { DistanceEntry } from "./pools-avg-distance-comparison-chart";
import { PoolsComparisonTabs } from "./pools-comparison-tabs";
import { cacheLife } from "next/cache";
import { getPoolFeesForDate } from "@/lib/pool-utils";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { getPoolsHistoricalEarnings } from "@/lib/db/queries/pools/historical-earnings";
import { getMaxDelegatedStake } from "@/lib/db/queries/predictors/max-delegated-stake";
import { getPoolHistoricalData } from "@/lib/db/queries/pools/historical-data";

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

async function transformAvgDistanceData(
  rawData: Array<{
    pool: Pool;
    data: Awaited<ReturnType<typeof getPoolHistoricalData>>;
  }>
): Promise<DistanceEntry[]> {
  const dateMap = new Map<
    string,
    {
      date: Date;
      poolDistances: DistanceEntry["poolDistances"];
    }
  >();

  for (const { pool, data } of rawData) {
    for (const row of data) {
      const dateObj = new Date(row.date);
      if (pool.closed && pool.closed <= dateObj) continue;

      const key = dateObj.toISOString().slice(0, 10);
      if (!dateMap.has(key)) {
        dateMap.set(key, {
          date: new Date(
            Date.UTC(
              dateObj.getUTCFullYear(),
              dateObj.getUTCMonth(),
              dateObj.getUTCDate(),
              0,
              0,
              0
            )
          ),
          poolDistances: {},
        });
      }

      const avg = row.avg_distance;
      if (avg > 0) {
        dateMap.get(key)!.poolDistances[pool.address] = { avg_distance: avg };
      }
    }
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
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

  const [earningsRaw, avgDistanceRaw] = await Promise.all([
    getPoolsHistoricalEarnings(top3, date),
    Promise.all(
      top3.map(async (pool) => ({
        pool,
        data: await getPoolHistoricalData(
          { address: pool.address, vault_address: pool.vault_address },
          date,
          30
        ),
      }))
    ),
  ]);

  const [earningsData, avgDistanceData] = await Promise.all([
    transformData(earningsRaw),
    transformAvgDistanceData(avgDistanceRaw),
  ]);

  return (
    <PoolsComparisonTabs
      pools={top3}
      earningsData={earningsData}
      avgDistanceData={avgDistanceData}
      fullStakeAmount={fullStakeAmount ?? 0}
      satoriPrice={satoriPrice}
    />
  );
}
