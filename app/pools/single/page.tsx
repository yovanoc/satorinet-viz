import type { PoolData } from "@/components/pools/daily-contributor-address-card";
import DailyContributorAddressCard from "@/components/pools/daily-contributor-address-card";
import DatePickerWrapper from "@/components/date-picker-wrapper";
import PoolHistoricalData from "@/components/pools/pool-historical-data";
import PoolSelectorWrapper from "@/components/pools/pool-selector-wrapper";
import PoolWorkerComparison from "@/components/pools/pool-vs-worker-comparison";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPoolHistoricalData } from "@/lib/db/queries/pools/historical-data";
import { getPoolWorkerStats } from "@/lib/db/queries/predictors/worker-stats";
import { getPoolAndDate, type TopPoolWithName } from "@/lib/get-pool-and-date-params";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { getWorkerReward, type WorkerReward } from "@/lib/satorinet/central";
import { Suspense } from "react";
import { getContributors } from "@/lib/db/queries/contributors";
import { getPredictors } from "@/lib/db/queries/predictors";
import { Address } from "@/components/address";

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

async function ContributorsAndPredictors({
  date,
  pool,
}: {
  date: Date;
  pool: TopPoolWithName;
}) {
  const [contributors, predictors] = await Promise.all([
    getContributors(pool.address, date),
    getPredictors(pool.address, pool.vault_address, date),
  ]);

  const topContributors = contributors.slice(0, 20);
  const topPredictors = predictors.slice(0, 20);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-4">
          <h2 className="text-xl font-bold">Top Contributors</h2>
          <ul className="flex flex-col gap-2">
            {topContributors.map((contributor) => (
              <li key={contributor.contributor}>
                {contributor.contributor_vault ? (
                  <>
                    <span className="font-semibold">Vault: </span>
                    <Address address={contributor.contributor_vault} /> -{" "}
                  </>
                ) : null}
                <span className="font-semibold">Wallet: </span>
                <Address address={contributor.contributor} /> -{" "}
                {contributor.staking_power_contribution} SP
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <h2 className="text-xl font-bold">Top Predictors</h2>
          <ul className="flex flex-col gap-2">
            {topPredictors.map((predictor) => (
              <li key={predictor.worker_address}>
                {predictor.worker_vault_address ? (
                  <>
                    <span className="font-semibold">Vault: </span>
                    <Address address={predictor.worker_vault_address} /> -{" "}
                  </>
                ) : null}
                <span className="font-semibold">Wallet: </span>
                <Address address={predictor.worker_address} /> -{" "}
                {predictor.reward} Rewards
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

async function PoolDataSection({ date, pool }: { date: Date; pool: TopPoolWithName }) {
  const knownPool = KNOWN_POOLS.find((p) => p.address === pool.address);
  try {
    const [historicalData, workerStats, workerReward] = await Promise.all([
      getPoolHistoricalData(pool, date),
      getPoolWorkerStats(pool.address, pool.vault_address, date),
      tryGetWorkerReward(pool.address),
    ]);

    const dateWorkerStats = workerStats.find(
      (workerStat) => new Date(workerStat.date).getTime() === date.getTime()
    );
    const dateHistoricalData = historicalData.find(
      (historicalData) =>
        new Date(historicalData.date).getTime() === date.getTime()
    );
    const enrichedPoolData: PoolData = {
      workerReward,
      url: knownPool?.url,
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
      closed: knownPool?.closed,
    };

    const name = knownPool?.name ?? pool.address;

    return (
      <div className="h-full flex flex-col gap-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-3 flex flex-col gap-6 order-1">
            <DailyContributorAddressCard
              poolData={enrichedPoolData}
              date={date}
              poolName={name}
            />
          </div>
          <div className="xl:col-span-4 flex flex-col gap-6 order-2">
            <PoolHistoricalData
              historicalData={historicalData ?? []}
              workerStats={workerStats ?? []}
              date={date}
              poolName={name}
            />
          </div>
          <div className="xl:col-span-5 flex flex-col gap-6 order-3">
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

  const { selectedPool, selectedDate, topPoolsWithNames } = poolAndDate;

  return (
    <div className="flex flex-col flex-1 gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16 relative">
        <span className="text-xl font-bold lg:hidden">
          {selectedDate.toLocaleDateString()}
        </span>

        <span className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold">
          {selectedDate.toLocaleDateString()}
        </span>

        <div className="ml-auto">
          <DatePickerWrapper selectedDate={selectedDate} />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 lg:px-6 flex-1">
        <PoolSelectorWrapper
          pools={topPoolsWithNames}
          selectedPool={selectedPool}
        />

        <Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
        >
          <PoolDataSection pool={selectedPool} date={selectedDate} />
        </Suspense>
      </div>
      <div className="flex flex-col gap-4 px-4 lg:px-6 flex-1">
        <Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
        >
          <ContributorsAndPredictors
            pool={selectedPool}
            date={selectedDate}
          />
        </Suspense>
      </div>
    </div>
  );
}
