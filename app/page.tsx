import { Suspense } from "react"
import { db } from "@/lib/db"
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

const knownPools = [
  {
    name: "Satorinet",
    address: "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY",
    vault_address: "EKKtydH4pbq86aJmiNuEVR4kP17exCcV25",
  },
  {
    name: "Pool Mudita",
    address: "ELs9eiFDCYAKBREL7g8d3WjQxrYDE7x5eY",
    vault_address: "EHAAy7YivL1Lba6azhMmfbLKRzdcBVAv5x",
  },
  { name: "Dev Pool", address: "EZ7SCvVdDTR1e6B2532C85KDteYZ56KCiC" },
  {
    name: "Lightning",
    address: "EJSHjPzLpRmubnRm9ARNDRtrqNum7EU3mK",
    vault_address: "Ef6VmYt6ywXxpMikjKWQCnETpSBbF4z7yw",
  },
  { name: "Zen Pool", address: "EeV6em8GHU9VeDepzsqbRmvA2NotMrTiK9" },
  {
    name: "Cost Pool",
    address: "EdC6EVXD54mhiVYBFF1Dw5P3xGNjBFiarq",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
  },
  {
    name: "Angel Pool",
    address: "EPLuqZ592JG96kz8a1GCmCNcUAcA9gVikD",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
  }
]

async function getPoolData(poolAddress: string, date: Date) {
  const data = await db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
      contributor_count_with_staking_power: sql<number>`count(distinct ${dailyContributorAddress.contributor}) filter (where ${dailyContributorAddress.staking_power_contribution} > 0)`,
    })
    .from(dailyContributorAddress)
    .where(
      and(eq(dailyContributorAddress.pool_address, poolAddress), eq(dailyContributorAddress.date, sql`${date}`)),
    )
    .groupBy(dailyContributorAddress.pool_address)
    .execute()

  return data[0] || null
}

async function getTopPools(date: Date) {
  return db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = ${date}`)
    .groupBy(dailyContributorAddress.pool_address)
    .orderBy(desc(sql`sum(${dailyContributorAddress.staking_power_contribution})`))
    .limit(20)
    .execute()
}

async function getDailyWorkerCounts() {
  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_address_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      diff_from_previous_day: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) - lag(count(distinct ${dailyPredictorAddress.worker_address})) over (order by ${dailyPredictorAddress.date})`,
    })
    .from(dailyPredictorAddress)
    .where(sql`${dailyPredictorAddress.date} >= current_date - interval '1 day' * 25`)
    .groupBy(dailyPredictorAddress.date)
    .orderBy(desc(dailyPredictorAddress.date))
    .execute()
}

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
  const selectedPool = poolStr ? knownPools.find((pool) => pool.address === poolStr) ?? knownPools[0] : knownPools[0];

  const dateStr = params.date;
  let selectedDate = new Date();
  if (dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    selectedDate = new Date(Date.UTC(year, month - 1, day));
  }

  return (
    <div className="flex-grow flex flex-col lg:flex-row gap-4 md:gap-8">
      <div className="lg:w-1/3 space-y-4">
        <PoolSelectorWrapper pools={knownPools} selectedPool={selectedPool.address} />
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

