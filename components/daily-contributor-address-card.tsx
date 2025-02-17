import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface PoolData {
  pool_address: string
  total_staking_power: number
  contributor_count: number
  worker_count?: number
  total_reward?: number
  avg_score?: number
}

interface DailyContributorAddressCardProps {
  poolData: PoolData
}

const DailyContributorAddressCard: FC<DailyContributorAddressCardProps> = ({ poolData }) => {
  return (
    <Card className="bg-blue-200 border-4 border-black">
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">Current Pool Stats</CardTitle>
      </CardHeader>
      <CardContent className="p-2 md:p-4">
        <div className="space-y-1 md:space-y-2">
          <p className="text-xs md:text-sm font-bold">
            Address: {poolData.pool_address}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Staking Power: {poolData.total_staking_power.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs md:text-sm font-bold">Contributors: {poolData.contributor_count}</p>
          {poolData.worker_count && <p className="text-xs md:text-sm font-bold">Workers: {poolData.worker_count}</p>}
          {poolData.total_reward && (
            <p className="text-xs md:text-sm font-bold">
              Daily Reward: {poolData.total_reward.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          )}
          {poolData.avg_score && (
            <p className="text-xs md:text-sm font-bold">Avg Score: {poolData.avg_score.toFixed(2)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default DailyContributorAddressCard

