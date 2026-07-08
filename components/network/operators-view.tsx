"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { EntityTable } from "@/components/network/entity-table";
import { Identity, identityName, shortAddress } from "@/components/network/identity";
import { ActivityBadge, RoleBadge, TrendCell } from "@/components/network/badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { OperatorRow } from "@/lib/db/queries/entities";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { formatCurrency } from "@/lib/format";

const SHARE_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.7 0.12 195)",
  "oklch(0.68 0.15 25)",
  "oklch(0.75 0.1 130)",
];

interface OperatorsViewProps {
  operators: OperatorRow[];
  networkAvgReward: number;
  prevNetworkAvgReward: number | null;
  stakePerWorker: number;
}

function shareData(
  operators: OperatorRow[],
  value: (o: OperatorRow) => number,
  threshold: number
) {
  const total = operators.reduce((acc, o) => acc + value(o), 0);
  const major = operators.filter((o) => value(o) >= threshold);
  const rest = operators.filter((o) => value(o) < threshold);
  const data = major
    .map((o) => ({
      name: identityName(o.wallet) ?? shortAddress(o.wallet),
      value: value(o),
      share: total > 0 ? (value(o) / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const othersValue = rest.reduce((acc, o) => acc + value(o), 0);
  if (othersValue > 0) {
    data.push({
      name: `Others (${rest.length})`,
      value: othersValue,
      share: total > 0 ? (othersValue / total) * 100 : 0,
    });
  }
  return data;
}

function ShareBarChart({
  title,
  description,
  data,
  digits,
}: {
  title: string;
  description: string;
  data: { name: string; value: number; share: number }[];
  digits: number;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer
          config={{ value: { label: title } }}
          className="aspect-auto w-full"
          style={{ height: Math.max(data.length * 36 + 30, 120) }}
        >
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <span className="flex w-full items-baseline justify-between gap-4 tabular-nums">
                      <span>{formatCurrency(Number(value), digits)}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.payload.share, 1)}%
                      </span>
                    </span>
                  )}
                />
              }
            />
            <Bar dataKey="value" radius={[4, 4, 4, 4]} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.name.startsWith("Others")
                      ? "var(--muted-foreground)"
                      : SHARE_COLORS[index % SHARE_COLORS.length]
                  }
                  fillOpacity={entry.name.startsWith("Others") ? 0.4 : 0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function OperatorsView({
  operators,
  networkAvgReward,
  prevNetworkAvgReward,
  stakePerWorker,
}: OperatorsViewProps) {
  const knownPoolAddresses = React.useMemo(
    () =>
      new Set(
        KNOWN_POOLS.flatMap((p) => [p.address, p.vault_address]).filter(Boolean) as string[]
      ),
    []
  );

  const workerShare = React.useMemo(
    () => shareData(operators, (o) => o.worker_count, 51),
    [operators]
  );
  const rewardShare = React.useMemo(() => {
    const total = operators.reduce((acc, o) => acc + o.total_rewards, 0);
    return shareData(operators, (o) => o.total_rewards, total * 0.025);
  }, [operators]);

  const capacity = React.useCallback(
    (o: OperatorRow) =>
      stakePerWorker > 0 ? Math.max(Math.floor(o.stake_power / stakePerWorker), 1) : 1,
    [stakePerWorker]
  );

  const efficiency = React.useCallback(
    (rewards: number, workers: number, avg: number | null) =>
      avg && avg > 0 && workers > 0 ? (rewards / workers / avg) * 100 : null,
    []
  );

  const columns = React.useMemo<ColumnDef<OperatorRow, unknown>[]>(
    () => [
      {
        id: "identity",
        header: "Operator",
        accessorFn: (o) =>
          [o.wallet, o.vault, identityName(o.wallet)].filter(Boolean).join(" "),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Identity address={row.original.wallet} vault={row.original.vault} />
            {knownPoolAddresses.has(row.original.wallet) ? <RoleBadge role="pool" /> : null}
            <ActivityBadge state={row.original.activity_state} />
          </span>
        ),
      },
      {
        id: "workers",
        header: "Workers",
        accessorFn: (o) => o.worker_count,
        cell: ({ row }) => (
          <span className="flex flex-col items-end tabular-nums">
            {formatCurrency(row.original.worker_count, 0)}
            <TrendCell
              current={row.original.worker_count}
              previous={row.original.prev_worker_count}
              digits={0}
            />
          </span>
        ),
      },
      {
        id: "lenders",
        header: "Lenders",
        accessorFn: (o) => o.lender_count,
        cell: ({ row }) => (
          <span className="flex flex-col items-end tabular-nums">
            {formatCurrency(row.original.lender_count, 0)}
            <TrendCell
              current={row.original.lender_count}
              previous={row.original.prev_lender_count}
              digits={0}
            />
          </span>
        ),
      },
      {
        id: "stake",
        header: "Stake Power",
        accessorFn: (o) => o.stake_power,
        cell: ({ row }) => (
          <span className="flex flex-col items-end tabular-nums">
            <span className="font-medium text-sky-600 dark:text-sky-400">
              {formatCurrency(row.original.stake_power, 0)}
            </span>
            <TrendCell
              current={row.original.stake_power}
              previous={row.original.prev_stake_power}
              digits={0}
            />
          </span>
        ),
      },
      {
        id: "usage",
        header: "Stake Usage",
        accessorFn: (o) => o.worker_count / capacity(o),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums text-muted-foreground">
            {formatCurrency((row.original.worker_count / capacity(row.original)) * 100, 1)}%
          </span>
        ),
      },
      {
        id: "rewards",
        header: "Daily Rewards",
        accessorFn: (o) => o.total_rewards,
        cell: ({ row }) => (
          <span className="flex flex-col items-end tabular-nums">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(row.original.total_rewards, 2)}
            </span>
            <TrendCell
              current={row.original.total_rewards}
              previous={row.original.prev_total_rewards}
              digits={2}
            />
          </span>
        ),
      },
      {
        id: "efficiency",
        header: "Efficiency vs Avg",
        accessorFn: (o) =>
          efficiency(o.total_rewards, o.worker_count, networkAvgReward) ?? 0,
        cell: ({ row }) => {
          const current = efficiency(
            row.original.total_rewards,
            row.original.worker_count,
            networkAvgReward
          );
          const previous =
            row.original.prev_total_rewards != null &&
            row.original.prev_worker_count != null
              ? efficiency(
                  row.original.prev_total_rewards,
                  row.original.prev_worker_count,
                  prevNetworkAvgReward
                )
              : null;
          return (
            <span className="flex flex-col items-end tabular-nums">
              {current != null ? `${formatCurrency(current, 1)}%` : "—"}
              {current != null && previous != null ? (
                <TrendCell current={current} previous={previous} digits={1} />
              ) : null}
            </span>
          );
        },
      },
    ],
    [capacity, efficiency, knownPoolAddresses, networkAvgReward, prevNetworkAvgReward]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 @5xl/main:grid-cols-2">
        <ShareBarChart
          title="Worker Share"
          description="Workers allocated per operator"
          data={workerShare}
          digits={0}
        />
        <ShareBarChart
          title="Reward Share"
          description="Daily rewards distributed per operator"
          data={rewardShare}
          digits={2}
        />
      </div>
      <EntityTable
        columns={columns}
        data={operators}
        searchPlaceholder="Search operator wallet or label…"
        initialSorting={[{ id: "workers", desc: true }]}
        pageSize={50}
        emptyMessage="No operators found for this day."
      />
    </div>
  );
}
