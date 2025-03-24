import { getPoolsHistoricalEarnings } from "@/lib/db"
import type { Pool } from "@/lib/known_pools"
import { PoolsStakingComparisonChart } from "./pools-staking-comparison-chart";
import { unstable_cacheLife as cacheLife } from "next/cache";

interface PoolsStakingComparisonProps {
  pools: Array<Pool>
  date: Date
}

function transformData(
  rawData: {
    pool_address: string;
    data: {
      date: string;
      total_staking_power: number;
      contributor_count: number;
      contributor_count_with_staking_power: number;
      earnings_per_staking_power: number;
    }[];
  }[]
): Record<string, number | Date>[] {
  const dateMap = new Map<string, Record<string, number | Date>>();

  rawData.forEach(({ pool_address, data }) => {
    data.forEach(({ date, earnings_per_staking_power }) => {
      if (!dateMap.has(date)) {
        dateMap.set(date, { date: new Date(date) });
      }
      dateMap.get(date)![pool_address] = earnings_per_staking_power;
    });
  });

  return Array.from(dateMap.values());
}

export async function PoolsStakingComparison({ pools, date }: PoolsStakingComparisonProps) {
  "use cache";
  cacheLife("default");

  const validPools = pools.filter(pool => typeof pool.vault_address === 'string');
  const data = await getPoolsHistoricalEarnings(validPools, date);

  return <PoolsStakingComparisonChart data={transformData(data)} pools={pools} />
}

