"use client";

import React, { useState, useTransition, useEffect } from "react";
import { getPriceRange } from "@/app/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

const RANGE_OPTIONS = [
  { value: "hourly", label: "1h" },
  { value: "daily", label: "24h" },
  { value: "weekly", label: "7d" },
  { value: "monthly", label: "30d" },
  { value: "yearly", label: "1y" },
];

  const chartConfig: ChartConfig = {
    rate: { label: "Price" },
  };

export function PriceHistoryChart() {
  const [range, setRange] = useState<"hourly" | "daily" | "weekly" | "monthly" | "yearly">("daily");
  const [data, setData] = useState<{ date: number; rate: number }[]>([]);
  const [isPending, startTransition] = useTransition();

  const fetchData = (period: "hourly" | "daily" | "weekly" | "monthly" | "yearly") => {
    startTransition(async () => {
      const result = await getPriceRange(period);
      setData(result.history);
    });
  };

  useEffect(() => {
    fetchData(range);
  }, [range]);

  const handleRangeChange = (val: string) => {
    if (val === range) return;
    setRange(val as typeof range);
  };

  return (
    <Card className="@container/card h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base font-semibold">Satori Price History</CardTitle>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={handleRangeChange}
          variant="outline"
          className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
        >
          {RANGE_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              variant="outline"
              size="default"
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={range} onValueChange={handleRangeChange}>
          <SelectTrigger
            className="flex w-32 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
            size="sm"
            aria-label="Select a range"
          >
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="rounded-lg">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="relative aspect-auto h-[250px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart
              accessibilityLayer
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  if (range === "hourly") {
                    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
                  }
                  if (range === "daily") {
                    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  }
                  if (range === "weekly" || range === "monthly") {
                    return d.toLocaleDateString();
                  }
                  if (range === "yearly") {
                    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
                  }
                  return d.toLocaleDateString();
                }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis dataKey="rate" domain={["auto", "auto"]} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const p = payload[0];
                      return p?.payload.date
                        ? new Date(p.payload.date).toLocaleString()
                        : "";
                    }}
                    indicator="line"
                  />
                }
              />
              <Area type="monotone" dataKey="rate" stroke="#6366f1" fillOpacity={1} fill="url(#colorPrice)" />
            </AreaChart>
          </ChartContainer>
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-xs text-muted-foreground bg-background/80 rounded px-3 py-1 shadow">Loading…</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
