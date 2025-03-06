'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from "@/components/ui/switch"
import type { Pool } from "@/lib/known-pools"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface PoolsStakingComparisonProps {
  data: Record<string, number | Date>[]
  pools: Pool[]
}

export function PoolsStakingComparisonChart({ data, pools }: PoolsStakingComparisonProps) {
  const [showNetEarnings, setShowNetEarnings] = useState(true);

  function getAvgFee(pool: Pool): number {
    return pool.staking_fees_percent?.length
      ? pool.staking_fees_percent.reduce((a, b) => a + b, 0) / pool.staking_fees_percent.length
      : 0;
  }

  function getNetEarnings(pool: Pool, grossEarnings: number): number {
    return grossEarnings * (1 - getAvgFee(pool));
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <Label>Staking Earnings Comparison</Label>
        </CardTitle>
        <CardDescription>
          How many SATORI tokens you would have earned if you staked in each pool.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Label>Show Net Earnings</Label>
          <Switch checked={showNetEarnings} onCheckedChange={setShowNetEarnings} />
        </div>

        <ResponsiveContainer width="100%" height={600}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
              const avgFee = getAvgFee(pool) * 100; // Convert to percentage
              return (
                <Line
                  key={pool.address}
                  yAxisId="left"
                  type="monotone"
                  dataKey={(entry) => {
                    const gross = entry[pool.address] as number;
                    return showNetEarnings ? getNetEarnings(pool, gross) : gross;
                  }}
                  name={`${pool.name} (${avgFee.toFixed(2)}%)`}
                  stroke={pool.color}
                  strokeWidth={4}
                  dot={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
