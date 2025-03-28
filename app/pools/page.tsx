import TabsLayout from "@/components/TabsLayout"
import { DailyStatsCard } from "@/components/daily-stats-card"
import { PoolsStakingComparison } from "@/components/pools-staking-comparison"
import { KNOWN_POOLS, type Pool } from "@/lib/known_pools"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DatePickerWrapper from "@/components/date-picker-wrapper"
import Loading from "../loading"
import { Suspense } from "react"
import PoolSelectorWrapper from "@/components/pool-selector-wrapper"
import { getPoolHistoricalData, getPoolWorkerStats, getTopPools } from "@/lib/db"
import { getWorkerReward, type WorkerReward } from "@/lib/satorinet/central"
import type { PoolData } from "@/components/daily-contributor-address-card"
import DailyContributorAddressCard from "@/components/daily-contributor-address-card"
import PoolHistoricalData from "@/components/pool-historical-data"
import TopPools from "@/components/top-pools"
import { RealtimeInfoCard } from "@/components/realtime-info"
import PoolWorkerComparison from "@/components/pool-vs-worker-comparison"

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

async function PoolDataSection({ date, pool }: { date: Date, pool: Pool }) {
  try {
    const [historicalData, workerStats, workerReward] = await Promise.all([
      pool.vault_address ? getPoolHistoricalData(pool.address, pool.vault_address, date) : null,
      pool.vault_address ? getPoolWorkerStats(pool.address, pool.vault_address, date) : null,
      tryGetWorkerReward(pool.address)
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
      pool_address: pool.address,
      total_staking_power: latestHistoricalData?.total_staking_power ?? 0,
      total_delegated_stake: latestWorkerStats?.total_delegated_stake,
      total_balance: latestWorkerStats?.total_balance,
      pool_balance: latestHistoricalData?.pool_balance,
      pools_own_staking_power: latestHistoricalData?.pools_own_staking_power,
      earnings_per_staking_power: latestHistoricalData?.earnings_per_staking_power,
      pool_miner_percent: latestWorkerStats?.pool_miner_percent,
    }

    return (
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <DailyContributorAddressCard poolData={enrichedPoolData} date={date} poolName={pool.name} />
        </div>
        <div className="col-span-12 md:col-span-6">
          <PoolHistoricalData historicalData={historicalData ?? []} workerStats={workerStats ?? []} date={date} poolName={pool.name} />
        </div>
        <div className="col-span-12">
          <PoolWorkerComparison pool={pool} date={date} />
        </div>
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

export default async function PoolsPage({ searchParams }: { searchParams: Promise<{ pool?: string, date?: string }> }) {
  const params = await searchParams;

  const poolStr = params.pool;
  const selectedPool = poolStr ? KNOWN_POOLS.find((pool) => pool.address === poolStr) ?? KNOWN_POOLS[0] : KNOWN_POOLS[0];

  if (!selectedPool) {
    return <Card className="h-[500px] flex items-center justify-center">Pool not found</Card>
  }

  const dateStr = params.date;
  let selectedDate = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
    0, 0, 0
  ));

  if (dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);

    if (year && month && day) {
      selectedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    }
  }

  return (
    <TabsLayout>
      <Tabs defaultValue="global" className="w-full">
        <div className="flex items-center justify-between w-full">
          <TabsList className="grid grid-cols-2 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-4 w-full mr-2">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
          </TabsList>
          <DatePickerWrapper selectedDate={selectedDate} />
        </div>
        <TabsContent value="global" className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6 lg:col-span-4 space-y-4">
            <Suspense
              fallback={
                <Card className="h-[200px] flex items-center justify-center">
                  <Loading />
                </Card>
              }
            >
              <RealtimeInfoCard />
            </Suspense>
            <Suspense
              fallback={
                <Card className="h-[200px] flex items-center justify-center">
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
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-8">
            <Suspense
              fallback={
                <Card className="h-[500px] flex items-center justify-center">
                  <Loading />
                </Card>
              }
            >
              <PoolsStakingComparison pools={KNOWN_POOLS} date={selectedDate} />
            </Suspense>
          </div>
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
            </Suspense>
          </div>
        </TabsContent>
      </Tabs>
    </TabsLayout>
  )
}
