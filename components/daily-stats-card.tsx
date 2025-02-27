import type { FC } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { getDailyMiningEarnings } from "@/lib/db";

interface DailyStatsCardProps {
  date: Date;
}

const formatCurrency = (value: number, fractionDigits: number = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatSatori = (value: number, fractionDigits: number = 8) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatUsd = (value: number, decimals = 2) =>
  `$${value.toFixed(decimals)}`;

export const DailyStatsCard: FC<DailyStatsCardProps> = async ({ date }) => {
  const [price, earningsData] = await Promise.all([
    getSatoriPriceForDate(date),
    getDailyMiningEarnings(date),
  ]);

  if (!earningsData) {
    return (
      <Card className="bg-green-200 border-4 border-black rounded-lg shadow-lg">
        <CardHeader className="p-4 flex justify-between items-center">
          <CardTitle className="text-xl md:text-2xl font-bold uppercase text-left">
            Daily Mining Stats
          </CardTitle>
          <p className="text-xs md:text-sm font-bold text-right">
            {date.toLocaleDateString()}
          </p>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Satori Price */}
          <div className="text-xs md:text-sm font-semibold text-gray-700">
            <p>
              <span>Satori Price: </span>
              <span className="text-green-600">${formatCurrency(price)}</span>
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
    <Card className="bg-green-200 border-4 border-black rounded-lg shadow-lg">
      <CardHeader className="p-4 flex justify-between items-center">
        <CardTitle className="text-xl md:text-2xl font-bold uppercase text-left">
          Daily Mining Stats
        </CardTitle>
        <p className="text-xs md:text-sm font-bold text-right">
          {date.toLocaleDateString()}
        </p>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Satori Price */}
        <div className="text-xs md:text-sm font-semibold text-gray-700">
          <p>
            <span>Satori Price: </span>
            <span className="text-green-600">${formatCurrency(price)}</span>
          </p>
        </div>

        {/* Total Earned */}
        <div className="space-y-1">
          <p className="font-semibold text-xs md:text-sm">
            Total Earned Today:{" "}
            <span className="text-green-600">
              {formatSatori(total_miner_earned)}
            </span>{" "}
            SATORI{" "}
            <span className="text-green-600">
              ({formatUsd(totalEarnedUSD)})
            </span>
          </p>
        </div>

        {/* Average Earned */}
        <div className="space-y-1">
          <p className="font-semibold text-xs md:text-sm">
            Average Earned Today:{" "}
            <span className="text-green-600">
              {formatSatori(avg_miner_earned)}
            </span>{" "}
            SATORI{" "}
            <span className="text-green-600">
              ({formatUsd(avgEarnedUSD, 8)})
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
