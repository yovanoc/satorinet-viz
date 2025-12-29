"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import type { Pool } from "@/lib/known_pools";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  DefaultLegendContent,
} from "recharts";

const MIN_AVG_DISTANCE_DATE = new Date("2025-12-28T00:00:00Z");

export type DistanceEntry = {
  date: Date;
  poolDistances: Record<
    string,
    {
      avg_distance: number;
    }
  >;
};

interface PoolsAvgDistanceComparisonChartProps {
  data: DistanceEntry[];
  pools: Pool[];
}

export function PoolsAvgDistanceComparisonChart({
  data,
  pools,
}: PoolsAvgDistanceComparisonChartProps) {
  const filteredData = useMemo(() => {
    return data.filter((entry) => entry.date >= MIN_AVG_DISTANCE_DATE);
  }, [data]);

  const poolInfos = useMemo(() => {
    return pools.reduce((acc, pool) => {
      const values = filteredData
        .map((entry) => entry.poolDistances[pool.address]?.avg_distance)
        .filter((v): v is number => typeof v === "number" && v > 0);

      const mean =
        values.length > 0
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : null;

      const last = values.length > 0 ? values.at(-1) ?? null : null;

      acc[pool.address] = { mean, last };
      return acc;
    }, {} as Record<string, { mean: number | null; last: number | null }>);
  }, [filteredData, pools]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Avg Distance Comparison</CardTitle>
        <CardDescription>
          Average predictor distance/score by pool since 2025-12-28. Lower is
          better (axis is inverted).
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={{}} className="aspect-auto h-[450px] w-full">
          <LineChart
            data={filteredData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value.toLocaleDateString()}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={["auto", "auto"]} reversed />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--background)" }}
              labelFormatter={(value) => value.toLocaleDateString()}
              formatter={(value, name) => {
                if (typeof value !== "number") return [];
                return [
                  value.toLocaleString(undefined, { maximumFractionDigits: 4 }),
                  name,
                ];
              }}
            />
            <Legend
              content={(props) => {
                const { ref, ...legendProps } = props;
                const customPayload = pools.map((pool) => {
                  const info = poolInfos[pool.address];
                  const meanDisplay =
                    info?.mean == null
                      ? "Mean: n/a"
                      : `Mean: ${info.mean.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}`;

                  return {
                    value: `${pool.name} (${meanDisplay})`,
                    type: "circle" as const,
                    color: pool.color,
                  };
                });

                return (
                  <DefaultLegendContent {...legendProps} payload={customPayload} />
                );
              }}
            />

            {pools.map((pool) => (
              <Line
                key={`${pool.address}-distance`}
                yAxisId="left"
                name={pool.name}
                type="monotone"
                dataKey={(entry: DistanceEntry) => {
                  if (pool.closed && pool.closed <= entry.date) {
                    return null;
                  }
                  return entry.poolDistances[pool.address]?.avg_distance ?? null;
                }}
                stroke={pool.color}
                strokeWidth={3}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
