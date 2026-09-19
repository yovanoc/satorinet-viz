import {
  KNOWN_POOLS,
  mostWantedTop,
  type Pool,
  type TopPool,
} from "@/lib/known_pools";
import type { Entry } from "./pools-staking-comparison-chart";
import type { DistanceEntry } from "./pools-avg-distance-comparison-chart";
import { PoolsComparisonTabs } from "./pools-comparison-tabs";
import { cacheLifeForDate } from "@/lib/db/cache-utils";
import { getSatoriPriceForDateSafe } from "@/lib/livecoinwatch";
import { getPoolsHistoricalEarnings } from "@/lib/db/queries/pools/historical-earnings";
import { getMaxDelegatedStake } from "@/lib/db/queries/predictors/max-delegated-stake";
import { getPoolHistoricalData } from "@/lib/db/queries/pools/historical-data";
import { feeDateKey, getPoolFeeSnapshots } from "@/lib/db/queries/pools/fees";

interface PoolsStakingComparisonProps {
  date: Date;
  topPools: TopPool[];
}

async function transformData(
  rawData: Awaited<ReturnType<typeof getPoolsHistoricalEarnings>>
): Promise<Entry[]> {
  const pools = rawData.map(({ pool }) => pool);
  const dates = Array.from(
    new Map(
      rawData
        .flatMap(({ data }) => data ?? [])
        .map((row) => {
          const date = new Date(row.date);
          return [feeDateKey(date), date] as const;
        })
    ).values()
  );
  const [feeSnapshots, dateResources] = await Promise.all([
    getPoolFeeSnapshots(pools, dates),
    Promise.all(
      dates.map(async (date) => [
        feeDateKey(date),
        {
          satoriPrice: (await getSatoriPriceForDateSafe(date)) ?? 0,
          fullStakeAmount: (await getMaxDelegatedStake(date)) ?? 0,
          pools: {} as Entry["poolEarnings"],
        },
      ] as const)
    ),
  ]);
  const dateMap = new Map(dateResources);

  for (const { pool, data } of rawData) {
    for (const row of data ?? []) {
      const date = new Date(row.date);
      if (pool.closed && pool.closed <= date) continue;
      const key = feeDateKey(date);
      const entry = dateMap.get(key);
      const fee = feeSnapshots[key]?.[pool.address];
      if (!entry || !fee) continue;
      entry.pools[pool.address] = {
        pool,
        earnings_per_staking_power: row.earnings_per_staking_power,
        fees: fee,
      };
    }
  }

  return Array.from(dateMap.entries())
    .filter(([, data]) => Object.keys(data.pools).length > 0)
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
  cacheLifeForDate(date);

  const [satoriPrice, fullStakeAmount] = await Promise.all([
    getSatoriPriceForDateSafe(date),
    getMaxDelegatedStake(date),
  ]);

  const topOnes = mostWantedTop(topPools).map(
    (pool) =>
      KNOWN_POOLS.find((knownPool) => knownPool.address === pool.address) ?? {
        name: pool.name ?? "Unknown Pool",
        color: "#888",
        address: pool.address,
        vault_address: pool.vault_address,
      }
  );

  const earningsRaw = await getPoolsHistoricalEarnings(topOnes, date);
  const avgDistanceRaw = earningsRaw;

  const [earningsData, avgDistanceData] = await Promise.all([
    transformData(earningsRaw),
    transformAvgDistanceData(avgDistanceRaw),
  ]);

  return (
    <PoolsComparisonTabs
      pools={topOnes}
      earningsData={earningsData}
      avgDistanceData={avgDistanceData}
      fullStakeAmount={fullStakeAmount ?? 0}
      satoriPrice={satoriPrice ?? 0}
    />
  );
}
