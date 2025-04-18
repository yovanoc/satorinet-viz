"use client";

import { formatCurrency, formatSatori } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { PoolsVSWorkerData } from "@/lib/db/queries/pools/worker-comparison";

const SELF_COLOR = "#388E3C";

interface PoolComparisonChartProps {
  data: PoolsVSWorkerData[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: PoolsVSWorkerData }[];
}

// TODO
const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  worker_address_count: {
    label: "Neurons",
  },
  diff_from_previous_day: {
    label: "Change",
  },
} satisfies ChartConfig;

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0]!.payload;
  const { date, stake, worker, price } = entry;

  const poolKeys = Object.keys(entry.pools);
  if (poolKeys.length === 0) return null;

  return (
    <div className="bg-secondary-foreground p-4 rounded-xl shadow-lg text-sm space-y-2 max-w-md">
      <div className="font-bold text-md text-center text-secondary">
        {new Date(date).toLocaleDateString()} - ${formatCurrency(price)}
      </div>

      <div>
        <p className="text-xs text-secondary">Stake Required this day</p>
        <p className="font-semibold text-accent">{stake}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div>
          <p className="text-xs text-secondary">Self Earnings from start</p>
          <p className="font-semibold text-accent">{formatSatori(worker.total_rewards)}</p>
        </div>
        <div>
          <p className="text-xs text-secondary">Self rewards this day</p>
          <p className="font-semibold text-accent">{formatSatori(worker.daily_rewards)}</p>
        </div>
        <div>
          <p className="text-xs text-secondary">
            Avg Rewards per Neuron this day
          </p>
          <p className="font-semibold text-accent">{formatSatori(worker.reward_avg)}</p>
        </div>
        <div>
          <p className="text-xs text-secondary">Current Self Amount</p>
          <p className="font-semibold text-accent">{formatSatori(worker.current_amount)}</p>
        </div>
      </div>

      {poolKeys.map((key) => {
        const pool = entry.pools[key]!;
        const difference = pool.total_earnings - worker.total_rewards;
        const betterInPool = difference > 0 ? pool.pool.name : "Self";
        const percentMore =
          Math.abs(difference) /
          (difference > 0 ? worker.total_rewards : pool.total_earnings);
        const diffText = `Better in ${betterInPool} by ${formatSatori(
          Math.abs(difference)
        )} (${(percentMore * 100).toFixed(2)}%) from start until this day`;

        const betterColor = difference > 0 ? pool.pool.color : SELF_COLOR;

        return (
          <div key={key} className="mt-2 border-t pt-2">
            <p className="font-bold text-sm text-secondary mb-1">
              Pool: {pool.pool.name}
            </p>
            <div className="flex flex-wrap gap-2">
              <div>
                <p className="text-xs text-secondary">
                  Pool Earnings from start
                </p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.total_earnings)}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Pool earnings this day</p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.daily_earnings)}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">
                  Pool earnings per full stake this day (
                  {(pool.feePercent * 100).toFixed(2)}% fee)
                </p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.full_stake_earnings)}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Current Pool Amount</p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.current_amount)}
                </p>
              </div>
            </div>
            <div
              className="text-xs font-semibold text-secondary mt-1"
              style={{ color: betterColor }}
            >
              {diffText}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export function PoolComparisonChart({ data }: PoolComparisonChartProps) {
  const poolKeys = Array.from(
    new Set(data.flatMap((entry) => Object.keys(entry.pools)))
  );

  const pools = data.flatMap((entry) =>
    Object.values(entry.pools).map((pool) => pool.pool)
  );

  const poolColors: Record<string, string> = {};
  for (const entry of data) {
    for (const [key, pool] of Object.entries(entry.pools)) {
      if (!poolColors[key]) {
        poolColors[key] = pool.pool.color;
      }
    }
  }

  const formattedData = data.map((entry) => {
    const poolEarnings: Record<string, number> = {};
    for (const key of Object.keys(entry.pools)) {
      poolEarnings[`pool_${key}`] = entry.pools[key]!.total_earnings;
    }

    return {
      ...entry,
      ...poolEarnings,
    };
  });

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-full w-full"
    >
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

        {poolKeys.map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={`pool_${key}`}
            name={`Pool: ${pools.find((pool) => pool.address === key)?.name}`}
            stroke={poolColors[key]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
          />
        ))}

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
    </ChartContainer>
  );
}
