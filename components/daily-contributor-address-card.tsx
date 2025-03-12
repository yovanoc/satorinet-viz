import type { FC } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import type { WorkerReward } from "@/lib/satorinet/central";

export interface PoolData {
  workerReward: WorkerReward | null;
  pool_address: string;
  total_staking_power: number;
  contributor_count?: number;
  contributor_count_with_staking_power?: number;
  worker_count?: number;
  worker_count_with_earnings?: number;
  total_reward?: number;
  total_miner_earned?: number;
  avg_score?: number;
  earnings_per_staking_power?: number;
  pool_miner_percent?: number;
}

interface DailyContributorAddressCardProps {
  poolData: PoolData;
  poolName: string;
  date: Date;
}

const DailyContributorAddressCard: FC<DailyContributorAddressCardProps> = ({
  poolData,
  poolName,
  date,
}) => {
  return (
    <Card className="col-span-12 md:col-span-6">
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">
          <span>{poolName} Stats</span>
          <p className="text-xs md:text-sm font-bold float-right">
            {date.toLocaleDateString()}
          </p>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 md:p-4">
        <div className="space-y-1 md:space-y-2">
          <p className="text-xs md:text-sm font-bold">
            Address: {poolData.pool_address}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Staking Power:{" "}
            {poolData.total_staking_power.toLocaleString(undefined, {
              maximumFractionDigits: 8,
            })}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Contributors: {poolData.contributor_count ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Contributors with Staking Power:{" "}
            {poolData.contributor_count_with_staking_power ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Workers: {poolData.worker_count ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Public Workers with Earnings: {poolData.worker_count_with_earnings ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Private Workers: {(poolData.worker_count ?? 0) - (poolData.worker_count_with_earnings ?? 0)}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Daily Rewards:{" "}
            {poolData.total_reward?.toLocaleString(undefined, {
              maximumFractionDigits: 8,
            }) ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Total Public Workers Earned:{" "}
            {poolData.total_miner_earned?.toLocaleString(undefined, {
              maximumFractionDigits: 8,
            }) ?? 0}
          </p>
          <p className="text-xs md:text-sm font-bold">
            Pool Miner Percent:{" "}
            {poolData.pool_miner_percent?.toLocaleString(undefined, {
              maximumFractionDigits: 8,
            }) ?? 0}
            %{
              poolData.workerReward ? (
                <span className="text-xs md:text-sm font-bold">
                  &nbsp;(Currently at {poolData.workerReward.offer.toLocaleString(undefined, {
                    maximumFractionDigits: 8,
                  })}%)
                </span>
              ) : null
            }
          </p>
          <p className="text-xs md:text-sm font-bold">
            Avg Score:{" "}
            {poolData.avg_score?.toLocaleString(undefined, {
              maximumFractionDigits: 8,
            }) ?? 0}
          </p>

          <p className="text-xs md:text-sm font-bold">
            Average Earnings per Staking Power:&nbsp;
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  {poolData.earnings_per_staking_power?.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 8 }
                  ) ?? 0}
                </TooltipTrigger>
                <TooltipContent>
                  (daily reward - total miner earned) / total staking power
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyContributorAddressCard;
