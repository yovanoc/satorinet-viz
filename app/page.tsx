import { Suspense } from "react"
import { db } from "@/lib/db"
import { eq, desc, sql, and } from "drizzle-orm"
import { Card } from "@/components/ui/card"
import { dailyContributorAddress, dailyPredictorAddress } from "@/lib/db/schema"
import Loading from "./loading"
import DailyContributorAddressCard from "@/components/daily-contributor-address-card"
import TopPools from "@/components/top-pools"
import DailyWorkerCounts from "@/components/daily-workers-count"
import PoolSelectorWrapper from "@/components/pool-selector-wrapper"

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
  {
    name: "Lightning",
    address: "EJSHjPzLpRmubnRm9ARNDRtrqNum7EU3mK",
    vault_address: "Ef6VmYt6ywXxpMikjKWQCnETpSBbF4z7yw",
  },
  { name: "Dev Pool", address: "EZ7SCvVdDTR1e6B2532C85KDteYZ56KCiC" },
  {
    name: "Cost Pool",
    address: "EdC6EVXD54mhiVYBFF1Dw5P3xGNjBFiarq",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
  },
  { name: "Zen Pool", address: "EeV6em8GHU9VeDepzsqbRmvA2NotMrTiK9" },
  {
    name: "Angel Pool",
    address: "EPLuqZ592JG96kz8a1GCmCNcUAcA9gVikD",
    vault_address: "EVednaMKprwVQzwAE1KFRYLx3vTbwUbXNk",
  }
]

async function getPoolData(poolAddress: string) {
  const data = await db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(and(eq(dailyContributorAddress.pool_address, poolAddress), eq(dailyContributorAddress.date, sql`current_date`)))
    .groupBy(dailyContributorAddress.pool_address)
    .execute()

  return data[0] || null
}

async function getTopPools() {
  return db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = current_date`)
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
    .where(sql`${dailyPredictorAddress.date} >= current_date - interval '20 days'`)
    .groupBy(dailyPredictorAddress.date)
    .orderBy(desc(dailyPredictorAddress.date))
    .execute()
}

export default async function Home({ searchParams }: { searchParams: Promise<{ pool?: string }> }) {
  const selectedPool = (await searchParams).pool || knownPools[0].address

  console.log("selectedPool", selectedPool)

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="md:w-1/4">
        <div className="mb-8">
          <PoolSelectorWrapper pools={knownPools} selectedPool={selectedPool} />
        </div>
        <Suspense fallback={<Card className="h-[200px] flex items-center justify-center"><Loading /></Card>}>
          <PoolDataCard poolAddress={selectedPool} />
        </Suspense>
      </div>
      <div className="md:w-3/4">
        <div className="grid gap-8">
          <Suspense fallback={<Card className="h-[400px] flex items-center justify-center"><Loading /></Card>}>
            <TopPoolsCard />
          </Suspense>
          <Suspense fallback={<Card className="h-[400px] flex items-center justify-center"><Loading /></Card>}>
            <DailyWorkerCountsCard />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

async function PoolDataCard({ poolAddress }: { poolAddress: string }) {
  const poolData = await getPoolData(poolAddress)
  if (!poolData) {
    return <Card className="h-[300px] flex items-center justify-center">No data available for this pool</Card>
  }
  return <DailyContributorAddressCard poolData={poolData} />
}

async function TopPoolsCard() {
  const topPools = await getTopPools()
  return <TopPools pools={topPools} />
}

async function DailyWorkerCountsCard() {
  const dailyCounts = await getDailyWorkerCounts()
  return <DailyWorkerCounts dailyCounts={dailyCounts} />
}

