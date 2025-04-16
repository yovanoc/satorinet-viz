import type { PoolData } from "@/components/old/daily-contributor-address-card";
import DailyContributorAddressCard from "@/components/old/daily-contributor-address-card";
import DatePickerWrapper from "@/components/old/date-picker-wrapper";
import PoolHistoricalData from "@/components/old/pool-historical-data";
import PoolSelectorWrapper from "@/components/old/pool-selector-wrapper";
import PoolWorkerComparison from "@/components/old/pool-vs-worker-comparison";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPoolHistoricalData, getPoolWorkerStats } from "@/lib/db";
import { getPoolAndDate } from "@/lib/get-pool-and-date-params";
import { KNOWN_POOLS, type Pool } from "@/lib/known_pools";
import { getWorkerReward, type WorkerReward } from "@/lib/satorinet/central";
import { Suspense } from "react";

// TODO show if pool is closed, since when
// TODO show the different % fees staged ?

const tryGetWorkerReward = async (
  address: string
): Promise<WorkerReward | null> => {
  try {
    const res = await getWorkerReward(address);
    return res;
  } catch (e) {
    console.error(e);
    return null;
  }
};

async function PoolDataSection({ date, pool }: { date: Date; pool: Pool }) {
  try {
    const [historicalData, workerStats, workerReward] = await Promise.all([
      pool.vault_address
        ? getPoolHistoricalData(pool.address, pool.vault_address, date)
        : null,
      pool.vault_address
        ? getPoolWorkerStats(pool.address, pool.vault_address, date)
        : null,
      tryGetWorkerReward(pool.address),
    ]);

    const dateWorkerStats = workerStats
      ? workerStats.find(
          (workerStat) => new Date(workerStat.date).getTime() === date.getTime()
        )
      : null;
    const dateHistoricalData = historicalData
      ? historicalData.find(
          (historicalData) =>
            new Date(historicalData.date).getTime() === date.getTime()
        )
      : null;
    const enrichedPoolData: PoolData = {
      workerReward,
      worker_count: dateWorkerStats?.worker_count,
      worker_count_with_earnings: dateWorkerStats?.worker_count_with_earnings,
      total_reward: dateWorkerStats?.total_reward,
      total_miner_earned: dateWorkerStats?.total_miner_earned,
      avg_score: dateWorkerStats?.avg_score,
      contributor_count: dateHistoricalData?.contributor_count,
      contributor_count_with_staking_power:
        dateHistoricalData?.contributor_count_with_staking_power,
      pool_address: pool.address,
      total_staking_power: dateHistoricalData?.total_staking_power ?? 0,
      total_delegated_stake: dateWorkerStats?.total_delegated_stake,
      total_balance: dateWorkerStats?.total_balance,
      pool_balance: dateHistoricalData?.pool_balance,
      pools_own_staking_power: dateHistoricalData?.pools_own_staking_power,
      earnings_per_staking_power:
        dateHistoricalData?.earnings_per_staking_power,
      pool_miner_percent: dateWorkerStats?.pool_miner_percent,
    };

    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <DailyContributorAddressCard
                poolData={enrichedPoolData}
                date={date}
                poolName={pool.name}
              />
            </div>
            <div className="flex-1">
              <PoolHistoricalData
                historicalData={historicalData ?? []}
                workerStats={workerStats ?? []}
                date={date}
                poolName={pool.name}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <PoolWorkerComparison pool={pool} date={date} />
          </div>
        </div>
      </div>
    );
  } catch (e) {
    console.error(e);
    return (
      <Card className="h-[500px] flex items-center justify-center">
        Error loading pool data
      </Card>
    );
  }
}

export default async function PoolsSingle({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string; date?: string }>;
}) {
  const params = await searchParams;
  const poolAndDate = await getPoolAndDate(params);

  if (!poolAndDate) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        Pool not found
      </Card>
    );
  }

  const { selectedPool, selectedDate } = poolAndDate;

  return (
    <div className="flex flex-col flex-1 gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16 relative">
        {/* Mobile: left-aligned date */}
        <span className="text-xl font-bold lg:hidden">
          {selectedDate.toLocaleDateString()}
        </span>

        {/* Desktop: centered date */}
        <span className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold">
          {selectedDate.toLocaleDateString()}
        </span>

        <div className="ml-auto">
          <DatePickerWrapper selectedDate={selectedDate} />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 lg:px-6 flex-1">
        <PoolSelectorWrapper
          pools={KNOWN_POOLS}
          selectedPool={selectedPool.address}
        />

        <Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
        >
          <PoolDataSection pool={selectedPool} date={selectedDate} />
        </Suspense>
      </div>
    </div>
  );
}
