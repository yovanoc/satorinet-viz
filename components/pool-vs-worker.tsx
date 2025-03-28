"use client";

import type { PoolVSWorkerData } from "@/lib/db";
import { formatSatori } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const POOL_COLOR = "#4CAF50";
const SELF_COLOR = "#2196F3";

interface PoolComparisonChartProps {
  data: PoolVSWorkerData[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: PoolVSWorkerData }[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0]!.payload;

  // Calculate the difference and determine which is better
  const diff = entry.pool_earnings - entry.self_earnings;
  const betterInPool = diff > 0 ? "Pool" : "Self";
  const diffText = `Better ${betterInPool} by ${formatSatori(
    Math.abs(diff)
  )} from start until this day`;

  // Set color based on which is better
  const betterColor = diff > 0 ? POOL_COLOR : SELF_COLOR;

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg text-sm space-y-2">
      <div className="font-bold text-md text-center text-gray-800">
        {entry.date.toLocaleDateString()}
      </div>

      <div>
        <p className="text-xs text-gray-500">Stake Required this day</p>
        <p className="font-semibold">{entry.stake}</p>
      </div>

      <div className="text-xs font-semibold text-gray-700">
        <p style={{ color: betterColor }}>{diffText}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-500">Self Earnings from start</p>
          <p className="font-semibold">{formatSatori(entry.self_earnings)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pool Earnings from start</p>
          <p className="font-semibold">{formatSatori(entry.pool_earnings)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">
            Avg Rewards per Neuron this day
          </p>
          <p className="font-semibold">{formatSatori(entry.rewardAvg)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">
            Pool earnings per full stake this day
          </p>
          <p className="font-semibold">
            {formatSatori(entry.poolRewardPerFullStake)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Self rewards this day</p>
          <p className="font-semibold">{formatSatori(entry.newRewards)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pool earnings this day</p>
          <p className="font-semibold">{formatSatori(entry.newPoolEarnings)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Current Self Amount</p>
          <p className="font-semibold">{formatSatori(entry.selfAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Current Pool Amount</p>
          <p className="font-semibold">{formatSatori(entry.poolAmount)}</p>
        </div>
      </div>
    </div>
  );
};

export function PoolComparisonChart({
  data,
}: PoolComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <XAxis
          dataKey="date"
          tickFormatter={(date) => new Date(date).toLocaleDateString()}
          angle={-45}
          textAnchor="end"
          padding={{ left: 20, right: 20 }}
        />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="top" height={36} iconType="circle" />

        {/* Line for Pool Earnings */}
        <Line
          type="monotone"
          dataKey="pool_earnings"
          name="Pool Earnings"
          stroke={POOL_COLOR}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, stroke: POOL_COLOR, strokeWidth: 2 }}
        />
        {/* Line for Self Earnings */}
        <Line
          type="monotone"
          dataKey="self_earnings"
          name="Self Earnings"
          stroke={SELF_COLOR}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, stroke: SELF_COLOR, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
