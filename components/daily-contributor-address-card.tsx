import type { FC } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

interface PoolData {
  pool_address: string
  total_staking_power: number
  contributor_count: number
  contributor_count_with_staking_power: number
  worker_count?: number
  worker_count_with_earnings?: number
  worker_count_with_rewards?: number
  total_reward?: number
  total_miner_earned?: number
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
            Staking Power: {poolData.total_staking_power.toLocaleString(undefined, { maximumFractionDigits: 8 })}
          </p>
          <p className="text-xs md:text-sm font-bold">Contributors: {poolData.contributor_count}</p>
          <p className="text-xs md:text-sm font-bold">
            Contributors with Staking Power: {poolData.contributor_count_with_staking_power}
          </p>
          <p className="text-xs md:text-sm font-bold">Workers: {poolData.worker_count ?? 0}</p>
          <p className="text-xs md:text-sm font-bold">
            Workers with Earnings: {poolData.worker_count_with_earnings ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Workers with Rewards: {poolData.worker_count_with_rewards ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Total Miner Earned: {poolData.total_miner_earned?.toLocaleString(undefined, { maximumFractionDigits: 8 }) ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Daily Reward: {poolData.total_reward?.toLocaleString(undefined, { maximumFractionDigits: 8 }) ?? 0}
          </p>
          {poolData.avg_score && (
            <p className="text-xs md:text-sm font-bold">Avg Score: {poolData.avg_score.toFixed(8)}</p>
          )}

          <p className="text-xs md:text-sm font-bold">
            Earn per satori stake:&nbsp;
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger> {poolData.total_staking_power > 0 ? (
                  <span>
                    {(
                      ((poolData.total_reward ?? 0) - (poolData.total_miner_earned ?? 0)) /
                      poolData.total_staking_power
                    ).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </span>
                ) : (
                  <span>0</span>
                )}</TooltipTrigger>
                <TooltipContent>
                  (daily reward - total miner earned) / total staking power

                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default DailyContributorAddressCard

