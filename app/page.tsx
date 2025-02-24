import { Suspense } from "react"
import { getDailyWorkerCounts, getTopPools } from "@/lib/db"
import Loading from "./loading"
import { Card } from "@/components/ui/card"
import { getPoolHistoricalData, getPoolWorkerStats } from "@/lib/db"
import DailyContributorAddressCard, { type PoolData } from "@/components/daily-contributor-address-card"
import PoolHistoricalData from "@/components/pool-historical-data"
import PoolSelectorWrapper from "@/components/pool-selector-wrapper"
import TopPools from "@/components/top-pools"
import DailyWorkerCounts from "@/components/daily-worker-counts"
import DatePickerWrapper from "@/components/date-picker-wrapper"
import { KNOWN_POOLS, type Pool } from "@/lib/known-pools"

async function PoolDataSection({ date, pool: { address, vault_address, name } }: { date: Date, pool: Pool }) {
  const [historicalData, workerStats] = await Promise.all([
    vault_address ? getPoolHistoricalData(address, vault_address, date) : null,
    vault_address ? getPoolWorkerStats(vault_address, date) : null,
  ])

  const latestWorkerStats = workerStats ? workerStats[workerStats.length - 1] : null;
  const latestHistoricalData = historicalData ? historicalData[historicalData.length - 1] : null;
  const enrichedPoolData: PoolData = {
    worker_count: latestWorkerStats?.worker_count,
    worker_count_with_rewards: latestWorkerStats?.worker_count_with_rewards,
    worker_count_with_earnings: latestWorkerStats?.worker_count_with_earnings,
    total_reward: latestWorkerStats?.total_reward,
    total_miner_earned: latestWorkerStats?.total_miner_earned,
    avg_score: latestWorkerStats?.avg_score,
    contributor_count: latestHistoricalData?.contributor_count,
    contributor_count_with_staking_power: latestHistoricalData?.contributor_count_with_staking_power,
    pool_address: address,
    total_staking_power: latestHistoricalData?.total_staking_power ?? 0,
    earnings_per_staking_power: latestHistoricalData?.earnings_per_staking_power,
    pool_miner_percent: latestWorkerStats?.pool_miner_percent,
  }

  return (
    <div className="space-y-4">
      <DailyContributorAddressCard poolData={enrichedPoolData} date={date} poolName={name} />
      <PoolHistoricalData historicalData={historicalData ?? []} workerStats={workerStats ?? []} date={date} poolName={name} />
    </div>
  )
}

export default async function Home({ searchParams }: { searchParams: Promise<{ pool?: string, date?: string }> }) {
  const params = await searchParams;

  const poolStr = params.pool;
  const selectedPool = poolStr ? KNOWN_POOLS.find((pool) => pool.address === poolStr) ?? KNOWN_POOLS[0] : KNOWN_POOLS[0];

  const dateStr = params.date;
  let selectedDate = new Date();
  if (dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    selectedDate = new Date(Date.UTC(year, month - 1, day));
  }

  return (
    <div className="flex-grow flex flex-col lg:flex-row gap-4 md:gap-8">
      <div className="lg:w-1/3 space-y-4">
        <PoolSelectorWrapper pools={KNOWN_POOLS} selectedPool={selectedPool.address} />
        <DatePickerWrapper selectedDate={selectedDate} />
        <Suspense
          fallback={
            <Card className="h-[500px] flex items-center justify-center">
              <Loading />
            </Card>
          }
        >
          <PoolDataSection pool={selectedPool} date={selectedDate} />
        </Suspense>
      </div>
      <div className="lg:w-1/3 space-y-4">
        <Suspense
          fallback={
            <Card className="h-[500px] flex items-center justify-center">
              <Loading />
            </Card>
          }
        >
          <TopPoolsCard  date={selectedDate} />
        </Suspense>
      </div>
      <div className="lg:w-1/3 space-y-4">
        <Suspense
          fallback={
            <Card className="h-[500px] flex items-center justify-center">
              <Loading />
            </Card>
          }
        >
          <DailyWorkerCountsCard />
        </Suspense>
      </div>
    </div>
  )
}

async function TopPoolsCard({ date }: { date: Date }) {
  const topPools = await getTopPools(date)
  return <TopPools pools={topPools} date={date} />
}

async function DailyWorkerCountsCard() {
  const dailyCounts = await getDailyWorkerCounts()
  return <DailyWorkerCounts dailyCounts={dailyCounts} />
}

