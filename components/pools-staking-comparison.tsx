import { getPoolsHistoricalEarnings } from "@/lib/db"
import type { Pool } from "@/lib/known-pools"

interface PoolsStakingComparisonProps {
  pools: Array<Pool>
  date: Date
}

export async function PoolsStakingComparison({ pools, date }: PoolsStakingComparisonProps) {
  const validPools = pools.filter(pool => typeof pool.vault_address === 'string');
  const data = await getPoolsHistoricalEarnings(validPools, date)

  // console.log(data)

  return (
    <div className="w-full">
      <pre>
        <code>
          {JSON.stringify(data, null, 2)}
        </code>
      </pre>
    </div>
  )
}

