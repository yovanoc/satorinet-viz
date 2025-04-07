"use client";

import type { PoolsVSWorkerData } from "@/lib/db";
import { formatCurrency, formatSatori } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const POOL_COLOR = "#388E3C";
const SELF_COLOR = "#1976D2";

interface PoolComparisonChartProps {
  data: PoolsVSWorkerData[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: PoolsVSWorkerData }[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const { date, stake, pools, worker, price } = payload[0]!.payload;

  const key = Object.keys(pools);
  if (key.length === 0) return null;
  // Get the first pool
  const pool = pools[key[0]!]!;
  const difference = pool.total_earnings - worker.total_rewards;

  // Calculate the difference and determine which is better
  const betterInPool = difference > 0 ? "Pool" : "Self";
  const percentMore = Math.abs(difference) / (difference > 0 ? worker.total_rewards : pool.total_earnings);
  const diffText = `Better in ${betterInPool} by ${formatSatori(
    Math.abs(difference)
  )} (${(percentMore * 100).toFixed(2)}%) from start until this day`;

  // Set color based on which is better
  const betterColor = difference > 0 ? POOL_COLOR : SELF_COLOR;

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg text-sm space-y-2">
      <div className="font-bold text-md text-center text-gray-800">
        {date.toLocaleDateString()} - ${formatCurrency(price)}
      </div>

      <div>
        <p className="text-xs text-gray-500">Stake Required this day</p>
        <p className="font-semibold">{stake}</p>
      </div>

      <div className="text-xs font-semibold text-gray-700">
        <p style={{ color: betterColor }}>{diffText}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-500">Self Earnings from start</p>
          <p className="font-semibold">{formatSatori(worker.total_rewards)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pool Earnings from start</p>
          <p className="font-semibold">{formatSatori(pool.total_earnings)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">
            Avg Rewards per Neuron this day
          </p>
          <p className="font-semibold">{formatSatori(worker.reward_avg)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">
            Pool earnings per full stake this day ({(pool.avg_fee * 100).toFixed(2)}% fee)
          </p>
          <p className="font-semibold">
            {formatSatori(pool.full_stake_earnings)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Self rewards this day</p>
          <p className="font-semibold">{formatSatori(worker.daily_rewards)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pool earnings this day</p>
          <p className="font-semibold">{formatSatori(pool.daily_earnings)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Current Self Amount</p>
          <p className="font-semibold">{formatSatori(worker.current_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Current Pool Amount</p>
          <p className="font-semibold">{formatSatori(pool.current_amount)}</p>
        </div>
      </div>
    </div>
  );
};

export function PoolComparisonChart({
  data,
}: PoolComparisonChartProps) {
  const formattedData = data.map((entry) => {
    const firstPool = Object.values(entry.pools)[0]!;
    return ({
      ...entry,
      pool: firstPool,
    })
  });

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={formattedData}
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
          dataKey="pool.total_earnings"
          name="Pool Earnings"
          stroke={POOL_COLOR}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, stroke: POOL_COLOR, strokeWidth: 2 }}
        />
        {/* Line for Self Earnings */}
        <Line
          type="monotone"
          dataKey="worker.total_rewards"
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
