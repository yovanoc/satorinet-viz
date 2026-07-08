"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "90d", label: "90D", days: 90 },
  { value: "180d", label: "180D", days: 180 },
  { value: "all", label: "All", days: Infinity },
] as const;

type RangeValue = (typeof RANGES)[number]["value"];

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS color, e.g. `var(--chart-1)` so it follows the theme. */
  color: string;
  yAxis?: "left" | "right";
  dashed?: boolean;
}

interface NetworkChartCardProps {
  title: string;
  description?: string;
  /** Rows sorted ascending by `date` (YYYY-MM-DD). */
  data: Record<string, number | string>[];
  series: ChartSeries[];
  leftDigits?: number;
  rightDigits?: number;
  defaultRange?: RangeValue;
  className?: string;
}

function compactFormatter(digits: number) {
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const plain = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  });
  return (value: number) =>
    Math.abs(value) >= 10_000 ? compact.format(value) : plain.format(value);
}

function formatDateTick(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NetworkChartCard({
  title,
  description,
  data,
  series,
  leftDigits = 0,
  rightDigits = 2,
  defaultRange = "30d",
  className,
}: NetworkChartCardProps) {
  const [range, setRange] = React.useState<RangeValue>(defaultRange);
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      // Never allow hiding the last visible series.
      if (next.has(key)) next.delete(key);
      else if (next.size < series.length - 1) next.add(key);
      return next;
    });
  };

  const days = RANGES.find((r) => r.value === range)?.days ?? 30;
  const filtered = Number.isFinite(days) ? data.slice(-days) : data;

  const hasRightAxis = series.some((s) => s.yAxis === "right");
  const formatLeft = React.useMemo(() => compactFormatter(leftDigits), [leftDigits]);
  const formatRight = React.useMemo(() => compactFormatter(rightDigits), [rightDigits]);

  const chartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig;

  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={range}
            onValueChange={(value) => {
              if (value) setRange(value as RangeValue);
            }}
            className="hidden *:data-[slot=toggle-group-item]:!px-3 @[540px]/card:flex"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={(v) => setRange(v as RangeValue)}>
            <SelectTrigger
              className="flex w-24 @[540px]/card:hidden"
              size="sm"
              aria-label={`${title} time range`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="rounded-lg">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-2 sm:px-6">
        {series.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5 px-2 sm:px-0">
            {series.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                aria-pressed={!hidden.has(s.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity",
                  hidden.has(s.key)
                    ? "opacity-40"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
        <ChartContainer config={chartConfig} className="aspect-auto h-62.5 w-full">
          <LineChart data={filtered} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatDateTick}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 12 }}
              domain={["auto", "auto"]}
              tickFormatter={formatLeft}
            />
            {hasRightAxis ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fontSize: 12 }}
                domain={["auto", "auto"]}
                tickFormatter={formatRight}
              />
            ) : null}
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
              }
            />
            {series
              .filter((s) => !hidden.has(s.key))
              .map((s) => (
                <Line
                  key={s.key}
                  yAxisId={s.yAxis ?? "left"}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeDasharray={s.dashed ? "5 5" : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
