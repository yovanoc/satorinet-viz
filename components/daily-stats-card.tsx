import type { FC } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { getDailyMiningEarnings, getWorkerRewardAverage } from "@/lib/db";
import { formatCurrency, formatSatori, formatUsd } from "@/lib/format";

interface DailyStatsCardProps {
  date: Date;
}

export const DailyStatsCard: FC<DailyStatsCardProps> = async ({ date }) => {
  const [price, earningsData, averageReward] = await Promise.all([
    getSatoriPriceForDate(date),
    getDailyMiningEarnings(date),
    getWorkerRewardAverage(date),
  ]);

  if (!earningsData) {
    return (
      <Card className="w-full h-[200px]">
        <CardHeader className="p-2 md:p-4">
          <CardTitle className="text-xl md:text-2xl font-bold uppercase">
            <span>Daily Mining Stats</span>
            <p className="text-xs md:text-sm font-bold float-right">
              {date.toLocaleDateString()}
            </p>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-2">
          {/* Satori Price */}
          <div className="text-xs md:text-sm font-semibold">
            <p>
              <span>Satori Price: </span>
              <span className="text-emerald-900">${formatCurrency(price)}</span>
            </p>
          </div>

          <p className="font-semibold text-xs md:text-sm">
            No data available for this date
          </p>
        </CardContent>
      </Card>
    );
  }

  const { total_miner_earned, avg_miner_earned } = earningsData;
  const totalEarnedUSD = total_miner_earned * price;
  const avgEarnedUSD = avg_miner_earned * price;

  return (
    <Card className="w-full h-[200px]">
      <CardHeader className="p-2 md:p-4">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase">
          <span>Daily Mining Stats</span>
          <p className="text-xs md:text-sm font-bold float-right">
            {date.toLocaleDateString()}
          </p>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Satori Price */}
        <div className="text-xs md:text-sm font-semibold">
          <p>
            <span>Satori Price: </span>
            <span className="text-emerald-900">${formatCurrency(price)}</span>
          </p>
        </div>

        {/* Total Earned */}
        <div className="space-y-1">
          <p className="font-semibold text-xs md:text-sm">
            Total Earned Today:{" "}
            <span className="text-emerald-900">
              {formatSatori(total_miner_earned)}
            </span>{" "}
            SATORI{" "}
            <span className="text-emerald-900">
              ({formatUsd(totalEarnedUSD)})
            </span>
          </p>
        </div>

        {averageReward && (
          <div className="space-y-1">
            <p className="font-semibold text-xs md:text-sm">
              Average Reward Per Worker:{" "}
              <span className="text-emerald-900">
                {formatSatori(averageReward.reward_avg)}
              </span>{" "}
              SATORI
            </p>
          </div>
        )}

        {/* Average Earned */}
        <div className="space-y-1">
          <p className="font-semibold text-xs md:text-sm">
            Average Earned Today:{" "}
            <span className="text-emerald-900">
              {formatSatori(avg_miner_earned)}
            </span>{" "}
            SATORI{" "}
            <span className="text-emerald-900">
              ({formatUsd(avgEarnedUSD, 8)})
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
