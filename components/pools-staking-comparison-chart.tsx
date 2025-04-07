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
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  applyFee,
  getAvgFee,
  getFeeRange,
  getPoolFeesForDate,
  poolHasMultipleFees,
} from "@/lib/pool-utils";

type Entry = [
  date: Date,
  poolEarnings: Record<
    string,
    {
      pool: Pool;
      earnings_per_staking_power: number;
      fees: ReturnType<typeof getPoolFeesForDate>;
    }
  >
];

interface PoolsStakingComparisonProps {
  data: Entry[];
  pools: Pool[];
}

export function PoolsStakingComparisonChart({
  data,
  pools,
}: PoolsStakingComparisonProps) {
  const [showNetEarnings, setShowNetEarnings] = useState(true);

  const meanValues = useMemo(() => {
    return pools
      .filter((p) => p.vault_address !== undefined)
      .reduce((acc, pool) => {
        const mean =
          data.reduce((sum, entry) => {
            const gross = entry[1][pool.address]!.earnings_per_staking_power;
            const avgFee = getAvgFee(pool, entry[0]);
            const value = showNetEarnings ? applyFee(gross, avgFee) : gross;
            return sum + value;
          }, 0) / data.length;

        acc[pool.address] = { value: mean };
        return acc;
      }, {} as Record<string, { value: number }>);
  }, [data, pools, showNetEarnings]);

  return (
    <Card className="w-full">
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
          How many <span className="font-medium">SATORI</span> tokens you would
          have earned by staking <span className="font-medium">1 SATORI</span>{" "}
          in each pool over these days.
          <div className="mt-2 text-sm text-gray-500">
            <div className="font-semibold text-gray-700">Formula used:</div>
            <div className="mt-1 font-mono">
              (Daily Rewards - Total Public Workers Earned) / (Staking Power
              Received + Pool&apos;s Own Staking Power)
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={600}>
          <ComposedChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              dataKey="[0]"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value.toLocaleDateString()}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(value, name, props) => {
                const entry: Entry = props.payload;
                const allPools = entry[1];

                // TODO didn't find a better way to get the pool data
                const poolData = Object.values(allPools).find(
                  (pool) => pool.pool.color === props.color
                );

                if (!poolData) {
                  return [value, name];
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

                const hasMultipleFees = poolHasMultipleFees(pool, entry[0]);

                if (hasMultipleFees) {
                  const { min, max } = getFeeRange(pool, entry[0]);
                  finalName += ` (${(min * 100).toFixed(2)}% - ${(
                    max * 100
                  ).toFixed(2)}%)`;
                } else {
                  const avgFee = getAvgFee(pool, entry[0]) * 100; // Convert to percentage
                  finalName += ` (${avgFee.toFixed(2)}%)`;
                }

                return [valueStr, finalName];
              }}
              labelFormatter={(label) => {
                return label.toLocaleDateString();
              }}
            />
            <Legend
              payload={pools
                .filter((p) => p.vault_address !== undefined)
                .map((pool) => {
                  const actualDate = new Date();
                  const { min, max } = getFeeRange(pool, actualDate);
                  const avgFee = getAvgFee(pool, actualDate) * 100; // Convert to percentage
                  const hasMultipleFees = poolHasMultipleFees(pool, actualDate);
                  const feeDisplay = hasMultipleFees
                    ? `${(min * 100).toFixed(2)}% - ${(max * 100).toFixed(2)}%`
                    : `${avgFee.toFixed(2)}%`;

                  return {
                    value: `${pool.name} (${feeDisplay}) (Mean: ${meanValues[
                      pool.address
                    ]?.value.toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })})`,
                    type: "circle",
                    color: pool.color,
                  };
                })}
            />

            {pools
              .filter((p) => p.vault_address !== undefined)
              .map((pool) => (
                <Area
                  key={`${pool.address}-area`}
                  yAxisId="left"
                  dataKey={(entry: Entry) => {
                    const gross =
                      entry[1][pool.address]!.earnings_per_staking_power;
                    const hasMultipleFees = poolHasMultipleFees(pool, entry[0]);

                    if (hasMultipleFees) {
                      if (!showNetEarnings) {
                        return [gross, gross];
                      }

                      const { min, max } = getFeeRange(pool, entry[0]);
                      return [applyFee(gross, max), applyFee(gross, min)];
                    }

                    if (showNetEarnings) {
                      const net = applyFee(gross, getAvgFee(pool, entry[0]));
                      return [net, net];
                    }

                    return [gross, gross];
                  }}
                  stroke={pool.color}
                  fill={pool.color}
                  fillOpacity={0.2}
                  strokeWidth={3}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
