"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Pool } from "@/lib/known_pools";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  DefaultLegendContent,
} from "recharts";
import {
  applyFeePercent,
  applyFees,
  getActiveTemporaryReductions,
  getFeeRange,
  getPoolFeesForDate,
} from "@/lib/pool-utils";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
// import { useIsMobile } from "@/hooks/use-mobile";

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

export type Entry = {
  date: Date;
  satoriPrice: number;
  fullStakeAmount: number;
  poolEarnings: Record<
    string,
    {
      pool: Pool;
      earnings_per_staking_power: number;
      fees: ReturnType<typeof getPoolFeesForDate>;
    }
  >;
};

interface PoolsStakingComparisonProps {
  data: Entry[];
  pools: Pool[];
  satoriPrice: number;
  fullStakeAmount: number;
}

export function PoolsStakingComparisonChart({
  data,
  pools,
  satoriPrice,
  fullStakeAmount,
}: PoolsStakingComparisonProps) {
  const [showNetEarnings, setShowNetEarnings] = useState(true);
  // const isMobile = useIsMobile();

  const poolInfos = useMemo(() => {
    return pools
      .filter((p) => p.vault_address !== undefined)
      .reduce((acc, pool) => {
        const mean =
          data.reduce((sum, entry) => {
            const gross =
              entry.poolEarnings[pool.address]?.earnings_per_staking_power ?? 0;
            let value = gross;
            if (showNetEarnings) {
              const res = applyFees({
                date: entry.date,
                poolAddress: pool.address,
                earnings_per_staking_power: gross,
                current_staked_amount: 1,
                satoriPrice: entry.satoriPrice,
                fullStakeAmount: entry.fullStakeAmount,
              });
              if (res.type === "single" || res.type === "not_found") {
                value = res.result.net;
              } else {
                value =
                  res.results.reduce((acc, r) => acc + r.net, 0) /
                  res.results.length;
              }
            }
            return sum + value;
          }, 0) / data.length;

        acc[pool.address] = {
          mean,
          last_gross_rewards:
            data.at(-1)?.poolEarnings[pool.address]
              ?.earnings_per_staking_power ?? 0,
        };
        return acc;
      }, {} as Record<string, { mean: number; last_gross_rewards: number }>);
  }, [data, pools, showNetEarnings]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>
          <Label>Staking Earnings Comparison</Label>
          <div className="float-right flex items-center gap-2 mb-4">
            <Label>{showNetEarnings ? "Net Earnings" : "Gross Earnings"}</Label>
            <Switch
              checked={showNetEarnings}
              onCheckedChange={setShowNetEarnings}
            />
          </div>
        </CardTitle>
        <CardDescription>
          How many <span className="font-medium">SATORI</span> tokens earned by
          staking <span className="font-medium">1 SATORI</span> in each pool
          over these days.
          <div className="mt-2 text-sm">
            <div className="font-semibold">Formula used:</div>
            <div className="mt-1 font-mono">
              (Daily Rewards - Total Public Workers Earned) / (Staking Power
              Received + Pool&apos;s Own Staking Power)
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[450px] w-full"
        >
          <ComposedChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value.toLocaleDateString()}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              domain={["auto", "auto"]}
            />
            {/* <ChartTooltip
              cursor={false}
              defaultIndex={isMobile ? -1 : 10}
              content={
                <ChartTooltipContent

                />
              }
            /> */}
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
              }}
              labelFormatter={(value) => {
                return value.toLocaleDateString();
              }}
              formatter={(
                value,
                _name,
                item: { payload?: Entry; color?: string }
              ) => {
                if (!item.payload) {
                  return [];
                }
                const entry: Entry = item.payload;
                const allPools = entry.poolEarnings;

                // TODO didn't find a better way to get the pool data
                const poolData = Object.values(allPools).find(
                  (pool) => pool.pool.color === item.color
                );

                if (!poolData) {
                  return [];
                }

                const { pool } = poolData;

                let valueStr = "BAD INPUT";
                if (Array.isArray(value) && value[0] && value[1]) {
                  const first =
                    typeof value[0] === "number"
                      ? value[0]
                      : parseFloat(value[0]);
                  const second =
                    typeof value[1] === "number"
                      ? value[1]
                      : parseFloat(value[1]);

                  if (first !== second) {
                    valueStr = `[${first.toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })}, ${second.toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })}]`;
                  } else {
                    valueStr = `${first.toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })}`;
                  }
                }

                let finalName = `${pool.name}`;

                const { min, max } = getFeeRange(
                  pool,
                  entry.date,
                  entry.poolEarnings[pool.address]!.earnings_per_staking_power,
                  entry.satoriPrice,
                  entry.fullStakeAmount
                );

                if (min !== max) {
                  finalName += ` (${(min * 100).toFixed(2)}% - ${(
                    max * 100
                  ).toFixed(2)}%)`;
                } else {
                  finalName += ` (${(min * 100).toFixed(2)}%)`;
                }

                const activeReductions = getActiveTemporaryReductions(
                  pool,
                  entry.date
                );
                if (activeReductions.length > 0) {
                  const totalReduction = activeReductions.reduce(
                    (acc, r) => acc + r.percent,
                    0
                  );
                  const reasons = activeReductions
                    .map((r) => r.reason)
                    .join(", ");
                  finalName += ` 🎁 -${(totalReduction * 100).toFixed(
                    0
                  )}% (${reasons})`;
                }

                return [valueStr, finalName];
              }}
            />
            <Legend
              content={(props) => {
                const { ref, ...legendProps } = props;
                const customPayload = pools
                  .filter((p) => p.vault_address !== undefined)
                  .map((pool) => {
                    const actualDate = new Date();

                    const poolInfo = poolInfos[pool.address];

                    if (!poolInfo) {
                      return {
                        value: `${pool.name} (0%)`,
                        type: "circle" as const,
                        color: pool.color,
                      };
                    }

                    if (pool.closed && pool.closed < actualDate) {
                      return {
                        value: `${
                          pool.name
                        } (CLOSED since ${pool.closed.toLocaleDateString()})`,
                        type: "circle" as const,
                        color: pool.color,
                      };
                    }

                    const { min, max } = getFeeRange(
                      pool,
                      actualDate,
                      poolInfo.last_gross_rewards,
                      satoriPrice,
                      fullStakeAmount
                    );

                    const feeDisplay =
                      min !== max
                        ? `${(min * 100).toFixed(2)}% - ${(max * 100).toFixed(
                            2
                          )}%`
                        : `${(min * 100).toFixed(2)}%`;

                    const activeReductions = getActiveTemporaryReductions(
                      pool,
                      actualDate
                    );
                    const reductionDisplay =
                      activeReductions.length > 0
                        ? ` 🎁 -${(
                            activeReductions.reduce(
                              (acc, r) => acc + r.percent,
                              0
                            ) * 100
                          ).toFixed(0)}%`
                        : "";

                    return {
                      value: `${
                        pool.name
                      } (${feeDisplay})${reductionDisplay} (Mean: ${poolInfo.mean.toLocaleString(
                        undefined,
                        {
                          maximumFractionDigits: 8,
                        }
                      )})`,
                      type: "circle" as const,
                      color: pool.color,
                    };
                  });

                return (
                  <DefaultLegendContent
                    {...legendProps}
                    payload={customPayload}
                  />
                );
              }}
            />

            {pools
              .filter((p) => p.vault_address !== undefined)
              .map((pool) => (
                <Area
                  key={`${pool.address}-area`}
                  yAxisId="left"
                  dataKey={(entry: Entry) => {
                    if (pool.closed && pool.closed <= entry.date) {
                      return null;
                    }

                    const gross =
                      entry.poolEarnings[pool.address]
                        ?.earnings_per_staking_power ?? 0;

                    if (!showNetEarnings) {
                      return [gross, gross];
                    }

                    const { min, max } = getFeeRange(
                      pool,
                      entry.date,
                      gross,
                      satoriPrice,
                      fullStakeAmount
                    );

                    return [
                      applyFeePercent(gross, max),
                      applyFeePercent(gross, min),
                    ];
                  }}
                  stroke={pool.color}
                  fill={pool.color}
                  fillOpacity={0.2}
                  strokeWidth={3}
                />
              ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
