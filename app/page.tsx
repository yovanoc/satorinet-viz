import { Suspense } from "react"
import { db, getDailyWorkerCounts, getPoolData, getTopPools } from "@/lib/db"
import { eq, desc, sql, and } from "drizzle-orm"
import Loading from "./loading"
import { Card } from "@/components/ui/card"
import { getPoolHistoricalData, getPoolWorkerStats } from "@/lib/db"
import { dailyContributorAddress, dailyPredictorAddress } from "@/lib/db/schema"
import DailyContributorAddressCard from "@/components/daily-contributor-address-card"
import PoolHistoricalData from "@/components/pool-historical-data"
import PoolSelectorWrapper from "@/components/pool-selector-wrapper"
import TopPools from "@/components/top-pools"
import DailyWorkerCounts from "@/components/daily-worker-counts"
import DatePickerWrapper from "@/components/date-picker-wrapper"
import { KNOWN_POOLS } from "@/lib/known-pools"

async function PoolDataSection({ date, pool: { address, vault_address } }: { date: Date, pool: { address: string, vault_address?: string } }) {
  const [poolData, historicalData, workerStats] = await Promise.all([
    getPoolData(address, date),
    getPoolHistoricalData(address, date),
    vault_address ? getPoolWorkerStats(vault_address, date) : null,
  ])

  if (!poolData) {
    return <Card className="h-[200px] flex items-center justify-center">No data available for this pool</Card>
  }

  const latestWorkerStats = workerStats ? workerStats[workerStats.length - 1] : null;
  const enrichedPoolData = {
    ...poolData,
    worker_count: latestWorkerStats?.worker_count,
    worker_count_with_rewards: latestWorkerStats?.worker_count_with_rewards,
    worker_count_with_earnings: latestWorkerStats?.worker_count_with_earnings,
    total_reward: latestWorkerStats?.total_reward,
    total_miner_earned: latestWorkerStats?.total_miner_earned,
    avg_score: latestWorkerStats?.avg_score,
  }

  return (
    <div className="space-y-4">
      <DailyContributorAddressCard poolData={enrichedPoolData} />
      <PoolHistoricalData historicalData={historicalData} workerStats={workerStats ?? []} />
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
  return <TopPools pools={topPools} />
}

async function DailyWorkerCountsCard() {
  const dailyCounts = await getDailyWorkerCounts()
  return <DailyWorkerCounts dailyCounts={dailyCounts} />
}

