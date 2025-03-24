'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from "@/components/ui/switch"
import type { Pool } from "@/lib/known_pools"
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface PoolsStakingComparisonProps {
  data: Record<string, number | Date>[]
  pools: Pool[]
}

const MIN = 0.001;
const MAX = 0.006;

export function PoolsStakingComparisonChart({ data, pools }: PoolsStakingComparisonProps) {
  const [showNetEarnings, setShowNetEarnings] = useState(true);

  function getFeeRange(pool: Pool): { min: number; max: number } {
    if (!pool.staking_fees_percent?.length) return { min: 0, max: 0 };
    return {
      min: Math.min(...pool.staking_fees_percent),
      max: Math.max(...pool.staking_fees_percent),
    };
  }

  function getAvgFee(pool: Pool): number {
    return pool.staking_fees_percent?.length
      ? pool.staking_fees_percent.reduce((a, b) => a + b, 0) / pool.staking_fees_percent.length
      : 0;
  }

  function applyFee(grossEarnings: number, fee: number): number {
    return grossEarnings * (1 - fee);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <Label>Staking Earnings Comparison</Label>
          <div className="float-right flex items-center gap-2 mb-4">
            <Label>{showNetEarnings ? "Net Earnings" : "Gross Earnings"}</Label>
            <Switch checked={showNetEarnings} onCheckedChange={setShowNetEarnings} />
          </div>
        </CardTitle>
        <CardDescription>
          How many SATORI tokens you would have earned if you staked 1 SATORI in each pool these days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={600}>
          <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 8 })}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Legend />

            {pools.filter(p => p.vault_address !== undefined).map((pool) => {
              const { min, max } = getFeeRange(pool);
              const avgFee = getAvgFee(pool) * 100; // Convert to percentage
              const hasMultipleFees = pool.staking_fees_percent?.length > 1;

              return hasMultipleFees && showNetEarnings ? (
                <Area
                  key={`${pool.address}-area`}
                  yAxisId="left"
                  dataKey={(entry) => {
                    const gross = entry[pool.address] as number;
                    return [applyFee(gross, max), applyFee(gross, min)];
                  }}
                  name={`${pool.name} (${(min * 100).toFixed(2)}% - ${(max * 100).toFixed(2)}%)`}
                  stroke={pool.color}
                  fill={pool.color}
                  fillOpacity={0.2}
                  strokeWidth={3}
                />
              ) : (
                <Line
                  key={pool.address}
                  yAxisId="left"
                  type="monotone"
                  dataKey={(entry) => {
                    const gross = entry[pool.address] as number;
                    const value = showNetEarnings ? applyFee(gross, getAvgFee(pool)) : gross;
                    return value >= MIN && value <= MAX ? value : null;
                  }}
                  name={`${pool.name} (${hasMultipleFees ?
                    `${(min * 100).toFixed(2)}% - ${(max * 100).toFixed(2)}%` :
                    `${avgFee.toFixed(2)}%`
                    })`}
                  stroke={pool.color}
                  strokeWidth={3}
                  dot={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
