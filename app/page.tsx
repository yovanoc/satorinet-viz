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
import { getWorkerReward, type WorkerReward } from "@/lib/satorinet"
import { DailyStatsCard } from "@/components/daily-stats-card";
import { PoolsStakingComparison } from "@/components/pools-staking-comparison"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const tryGetWorkerReward = async (address: string): Promise<WorkerReward | null> => {
  try {
    const res = await getWorkerReward(address);
    return res;
  }
  catch (e) {
    console.error(e)
    return null
  }
}

async function PoolDataSection({ date, pool: { address, vault_address, name } }: { date: Date, pool: Pool }) {
  try {
    const [historicalData, workerStats, workerReward] = await Promise.all([
      vault_address ? getPoolHistoricalData(address, vault_address, date) : null,
      vault_address ? getPoolWorkerStats(vault_address, date) : null,
      tryGetWorkerReward(address)
    ])

    const latestWorkerStats = workerStats ? workerStats[workerStats.length - 1] : null;
    const latestHistoricalData = historicalData ? historicalData[historicalData.length - 1] : null;
    const enrichedPoolData: PoolData = {
      workerReward,
      worker_count: latestWorkerStats?.worker_count,
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
      <div className="grid grid-cols-12 gap-4">
        <DailyContributorAddressCard poolData={enrichedPoolData} date={date} poolName={name} />
        <PoolHistoricalData historicalData={historicalData ?? []} workerStats={workerStats ?? []} date={date} poolName={name} />
      </div>
    )
  } catch (e) {
    console.error(e)
    return <Card className="h-[500px] flex items-center justify-center">Error loading pool data</Card>
  }
}

async function TopPoolsCard({ date }: { date: Date }) {
  const topPools = await getTopPools(date)
  return <TopPools pools={topPools} date={date} />
}

async function DailyWorkerCountsCard() {
  const dailyCounts = await getDailyWorkerCounts()
  return <DailyWorkerCounts dailyCounts={dailyCounts} />
}


export default async function Home({ searchParams }: { searchParams: Promise<{ pool?: string, date?: string }> }) {
  const params = await searchParams;

  const poolStr = params.pool;
  const selectedPool = poolStr ? KNOWN_POOLS.find((pool) => pool.address === poolStr) ?? KNOWN_POOLS[0] : KNOWN_POOLS[0];

  if (!selectedPool) {
    return <Card className="h-[500px] flex items-center justify-center">Pool not found</Card>
  }

  const dateStr = params.date;
  let selectedDate = new Date();
  if (dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);

    if (year && month && day) {
      selectedDate = new Date(Date.UTC(year, month - 1, day));
    }
  }

  return (
    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="pools">Pools</TabsTrigger>
        <TabsTrigger value="compare" disabled>Compare (Soon™)</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="grid grid-cols-12 gap-4">
        <Suspense
          fallback={
            <Card className="h-[500px] flex items-center justify-center">
              <Loading />
            </Card>
          }
        >
          <DailyWorkerCountsCard />
        </Suspense>
      </TabsContent>
      <TabsContent value="pools">
        <Tabs defaultValue="global" className="w-full">
          <div className="flex items-center justify-between w-full">
            <TabsList className="grid grid-cols-2 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-4 w-full mr-2">
              <TabsTrigger value="global">Global</TabsTrigger>
              <TabsTrigger value="individual">Individual</TabsTrigger>
            </TabsList>
            <DatePickerWrapper selectedDate={selectedDate} />
          </div>
          <TabsContent value="global" className="grid grid-cols-12 gap-4">
            <Suspense
              fallback={
                <Card className="h-[500px] flex items-center justify-center">
                  <Loading />
                </Card>
              }
            >
              <DailyStatsCard date={selectedDate} />
            </Suspense>
            <Suspense
              fallback={
                <Card className="h-[500px] flex items-center justify-center">
                  <Loading />
                </Card>
              }
            >
              <TopPoolsCard date={selectedDate} />
            </Suspense>
          </TabsContent>
          <TabsContent value="individual">
            <div>
              <PoolSelectorWrapper pools={KNOWN_POOLS} selectedPool={selectedPool.address} />
              <Suspense
                fallback={
                  <Card className="h-[500px] flex items-center justify-center">
                    <Loading />
                  </Card>
                }
              >
                <PoolDataSection pool={selectedPool} date={selectedDate} />
                <PoolsStakingComparison pools={KNOWN_POOLS} date={selectedDate} />
              </Suspense>
            </div>
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  )
}
