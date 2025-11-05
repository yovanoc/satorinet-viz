"use client";

import { formatCurrency, formatSatori } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { PoolsVSWorkerData } from "@/lib/db/queries/pools/worker-comparison";

const SELF_COLOR = "#388E3C";

function getRandomHexColor(): string {
  const hex = Math.floor(Math.random() * 0xffffff).toString(16);
  return `#${hex.padStart(6, "0")}`;
}

interface PoolComparisonChartProps {
  data: PoolsVSWorkerData[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: PoolsVSWorkerData }[];
  poolColors: Record<string, string>;
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

const CustomTooltip = ({ active, payload, poolColors }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0]!.payload;
  const { date, stake, worker, price } = entry;

  const poolKeys = Object.keys(entry.pools);
  if (poolKeys.length === 0) return null;

  return (
    <div className="p-4 rounded-xl shadow-lg text-sm space-y-2 max-w-md bg-popover text-popover-foreground">
      <div className="font-bold text-md text-center">
        {new Date(date).toLocaleDateString()} - ${formatCurrency(price)}
      </div>

      <div>
        <p className="text-xs opacity-80">Stake Required this day</p>
        <p className="font-semibold text-accent">{stake}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div>
          <p className="text-xs opacity-80">Self Earnings from start</p>
          <p className="font-semibold text-accent">
            {formatSatori(worker.total_rewards)}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-80">Self rewards this day</p>
          <p className="font-semibold text-accent">
            {formatSatori(worker.daily_rewards)}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-80">Avg Rewards per Neuron this day</p>
          <p className="font-semibold text-accent">
            {formatSatori(worker.reward_avg)}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-80">Current Self Amount</p>
          <p className="font-semibold text-accent">
            {formatSatori(worker.current_amount)}
          </p>
        </div>
      </div>

      {poolKeys.map((key) => {
        const pool = entry.pools[key]!;
        const poolColor = poolColors[key]!;
        const poolName = pool.pool?.name ?? pool.poolAddress;
        // For min
        const minDifference = pool.min.total_earnings - worker.total_rewards;
        const minBetterInPool =
          minDifference > 0
            ? `Better in ${poolName}`
            : "Better with self workers";
        const minPercentMore =
          Math.abs(minDifference) /
          (minDifference > 0 ? worker.total_rewards : pool.min.total_earnings);
        const minDiffText = `${minBetterInPool} by ${formatSatori(
          Math.abs(minDifference)
        )} (${(minPercentMore * 100).toFixed(2)}%) from start until this day`;
        // For max (if exists)
        let maxDiffText: string | null = null;
        if (pool.max) {
          const maxDifference = pool.max.total_earnings - worker.total_rewards;
          const maxBetterInPool =
            maxDifference > 0
              ? `Better in ${poolName}`
              : "Better with self workers";
          const maxPercentMore =
            Math.abs(maxDifference) /
            (maxDifference > 0
              ? worker.total_rewards
              : pool.max.total_earnings);
          maxDiffText = `${maxBetterInPool} by ${formatSatori(
            Math.abs(maxDifference)
          )} (${(maxPercentMore * 100).toFixed(2)}%) from start until this day`;
        }
        const betterColor = minDifference > 0 ? poolColor : SELF_COLOR;
        const maxBetterColor =
          pool.max && pool.max.total_earnings - worker.total_rewards > 0
            ? poolColor
            : SELF_COLOR;
        return (
          <div key={key} className="mt-2 border-t pt-2">
            <p
              className="font-bold text-sm mb-1 flex items-center gap-2"
              style={{ color: poolColor }}
            >
              Pool: {poolName}
              {pool.max && (
                <span className="text-xs font-normal text-muted-foreground">
                  (Min & Max)
                </span>
              )}
            </p>
            <div
              className={
                pool.max ? "grid grid-cols-2 gap-4" : "flex flex-wrap gap-2"
              }
            >
              <div>
                {pool.max && (
                  <p className="text-xs opacity-80 font-semibold mb-1">Min:</p>
                )}
                <p className="text-xs opacity-80">Pool Earnings from start</p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.min.total_earnings)}
                </p>
                <p className="text-xs opacity-80">Pool earnings this day</p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.min.daily_earnings)}
                </p>
                <p className="text-xs opacity-80">
                  Pool earnings per full stake this day (
                  <span
                    className="font-bold text-sm"
                    style={{ color: poolColor }}
                  >
                    {(pool.min.feePercent * 100).toFixed(2)}%
                  </span>{" "}
                  fee)
                </p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.min.full_stake_earnings)}
                </p>
                <p className="text-xs opacity-80">Current Pool Amount</p>
                <p className="font-semibold text-accent">
                  {formatSatori(pool.min.current_amount)}
                </p>
                {pool.max && (
                  <div
                    className="text-xs font-semibold mt-1"
                    style={{ color: betterColor }}
                  >
                    {minDiffText}
                  </div>
                )}
              </div>
              {pool.max && (
                <div>
                  <p className="text-xs opacity-80 font-semibold mb-1">Max:</p>
                  <p className="text-xs opacity-80">Pool Earnings from start</p>
                  <p className="font-semibold text-accent">
                    {formatSatori(pool.max.total_earnings)}
                  </p>
                  <p className="text-xs opacity-80">Pool earnings this day</p>
                  <p className="font-semibold text-accent">
                    {formatSatori(pool.max.daily_earnings)}
                  </p>
                  <p className="text-xs opacity-80">
                    Pool earnings per full stake this day (
                    <span
                      className="font-bold text-sm"
                      style={{ color: poolColor }}
                    >
                      {(pool.max.feePercent * 100).toFixed(2)}%
                    </span>{" "}
                    fee)
                  </p>
                  <p className="font-semibold text-accent">
                    {formatSatori(pool.max.full_stake_earnings)}
                  </p>
                  <p className="text-xs opacity-80">Current Pool Amount</p>
                  <p className="font-semibold text-accent">
                    {formatSatori(pool.max.current_amount)}
                  </p>
                  <div
                    className="text-xs font-semibold mt-1"
                    style={{ color: maxBetterColor }}
                  >
                    {maxDiffText}
                  </div>
                </div>
              )}
            </div>
            {!pool.max && (
              <div
                className="text-xs font-semibold mt-1"
                style={{ color: betterColor }}
              >
                {minDiffText}
              </div>
            )}
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
    Object.values(entry.pools).map((pool) => pool.pool ?? pool.poolAddress)
  );

  const poolColors: Record<string, string> = {};
  for (const entry of data) {
    for (const [key, pool] of Object.entries(entry.pools)) {
      if (!poolColors[key]) {
        poolColors[key] = pool.pool?.color ?? getRandomHexColor();
      }
    }
  }

  // Prepare data for AreaChart: for each pool, add min and max if available
  type R = Record<`pool_${string}_${"min" | "max"}`, number>;
  type Data = PoolsVSWorkerData & R;
  const formattedData: Array<Data> = data.map((entry) => {
    const poolEarnings: R = {};
    for (const key of Object.keys(entry.pools)) {
      const pool = entry.pools[key]!;
      if (pool.max) {
        poolEarnings[`pool_${key}_min`] = pool.min.total_earnings;
        poolEarnings[`pool_${key}_max`] = pool.max.total_earnings;
      } else {
        poolEarnings[`pool_${key}_min`] = pool.min.total_earnings;
      }
    }
    const d: Data = {
      ...entry,
      ...poolEarnings,
    };

    return d;
  });

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
      <AreaChart
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
        <YAxis
          domain={([dataMin, dataMax]) => {
            const range = dataMax - dataMin;
            if (!isFinite(range) || range === 0)
              return [dataMin - 1, dataMax + 1];
            return [dataMin - range * 0.05, dataMax + range * 0.05];
          }}
          tick={{ fontSize: 12, fill: "#888" }}
          width={70}
          tickFormatter={(value) =>
            value?.toLocaleString?.(undefined, { maximumFractionDigits: 2 }) ??
            value
          }
          allowDecimals={true}
          axisLine={true}
          tickLine={true}
        />
        <Tooltip content={<CustomTooltip poolColors={poolColors} />} />
        <Legend verticalAlign="top" height={36} iconType="circle" />

        {/* Render Self Earnings line AFTER areas to ensure it is drawn on top */}
        {poolKeys.map((key) => {
          const color = poolColors[key];
          const pool = pools.find((pool) =>
            typeof pool === "string" ? pool === key : pool.address === key
          );
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={(entry: Data) => {
                const min = entry[`pool_${key}_min`];
                const max = entry[`pool_${key}_max`];
                if (min && max) return [min, max];
                if (min) return [min, min];
                return null;
              }}
              isRange
              name={`Pool: ${
                pool ? (typeof pool === "string" ? pool : pool.name) : key
              }`}
              stroke={color}
              fill={color}
              fillOpacity={0.4}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          );
        })}
        {/* Self worker as degenerate area (line) */}
        <Area
          type="monotone"
          dataKey={(entry: Data) => {
            const v = entry.worker.total_rewards;
            return [v, v];
          }}
          isRange
          name="Self Earnings"
          stroke={SELF_COLOR}
          fill={SELF_COLOR}
          fillOpacity={0.7}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, stroke: SELF_COLOR, strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
