import { getPoolsHistoricalEarnings } from "@/lib/db";
import type { Pool } from "@/lib/known_pools";
import { PoolsStakingComparisonChart } from "./pools-staking-comparison-chart";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getPoolFeesForDate } from "@/lib/pool-utils";

interface PoolsStakingComparisonProps {
  pools: Array<Pool>;
  date: Date;
}

function transformData(
  rawData: {
    pool: Pool;
    data: {
      date: string;
      total_staking_power: number;
      contributor_count: number;
      contributor_count_with_staking_power: number;
      earnings_per_staking_power: number;
    }[] | null;
  }[]
): [date: Date, poolEarnings: Record<string, {
  pool: Pool,
  earnings_per_staking_power: number,
  fees: ReturnType<typeof getPoolFeesForDate>,
}>][] {
  const dateMap = new Map<string, Record<string, {
    pool: Pool,
    earnings_per_staking_power: number,
    fees: ReturnType<typeof getPoolFeesForDate>,
  }>>();

  rawData.forEach(({ pool, data }) => {
    if (!data) return;
    data.forEach(({ date, earnings_per_staking_power }) => {
      if (!dateMap.has(date)) {
        dateMap.set(date, {});
      }
      dateMap.get(date)![pool.address] = {
        pool,
        earnings_per_staking_power,
        fees: getPoolFeesForDate(pool, new Date(date)),
      }
    });
  });

  return Array.from(dateMap.entries()).map(([date, earnings]) => [
    new Date(date),
    earnings,
  ] as const);
}

export async function PoolsStakingComparison({
  pools,
  date,
}: PoolsStakingComparisonProps) {
  "use cache";
  cacheLife("default");

  const validPools = pools.filter(
    (pool) => typeof pool.vault_address === "string"
  );
  const data = await getPoolsHistoricalEarnings(validPools, date);

  return (
    <PoolsStakingComparisonChart data={transformData(data)} pools={pools} />
  );
}
