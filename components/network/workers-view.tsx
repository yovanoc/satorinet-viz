"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";

import { EntityTable } from "@/components/network/entity-table";
import { Identity, identityName, shortAddress } from "@/components/network/identity";
import { ActivityBadge, RankCell, TrendCell } from "@/components/network/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkerRow } from "@/lib/db/queries/entities";
import { formatCurrency } from "@/lib/format";

interface WorkersViewProps {
  workers: WorkerRow[];
  networkAvgReward: number;
}

function searchText(w: WorkerRow) {
  return [
    w.wallet,
    w.vault,
    w.operator_wallet,
    w.operator_vault,
    identityName(w.wallet),
    identityName(w.operator_wallet),
  ]
    .filter(Boolean)
    .join(" ");
}

export function WorkersView({ workers, networkAvgReward }: WorkersViewProps) {
  const [operator, setOperator] = React.useState<string>("all");

  const operators = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workers) {
      if (!w.operator_wallet) continue;
      counts.set(w.operator_wallet, (counts.get(w.operator_wallet) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [workers]);

  const filtered = React.useMemo(
    () => (operator === "all" ? workers : workers.filter((w) => w.operator_wallet === operator)),
    [workers, operator]
  );

  const columns = React.useMemo<ColumnDef<WorkerRow, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "Rank",
        accessorFn: (w) => w.reward_rank,
        cell: ({ row }) => (
          <RankCell rank={row.original.reward_rank} movement={row.original.rank_movement} />
        ),
      },
      {
        id: "identity",
        header: "Identity",
        accessorFn: searchText,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Identity address={row.original.wallet} vault={row.original.vault} />
            <ActivityBadge state={row.original.activity_state} />
          </span>
        ),
      },
      {
        id: "operator",
        header: "Operator",
        accessorFn: (w) => identityName(w.operator_wallet) ?? w.operator_wallet,
        cell: ({ row }) =>
          row.original.operator_wallet ? (
            <Identity
              address={row.original.operator_wallet}
              vault={row.original.operator_vault}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Sovereign</span>
          ),
      },
      {
        id: "reward",
        header: "Reward",
        accessorFn: (w) => w.reward,
        cell: ({ row }) => (
          <span className="flex flex-col items-end">
            <span className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(row.original.reward, 4)}
            </span>
            <TrendCell
              current={row.original.reward}
              previous={row.original.prev_reward}
              digits={4}
              fallback={
                row.original.activity_state === "new"
                  ? "New identity"
                  : row.original.activity_state === "returned"
                    ? "Back today"
                    : undefined
              }
            />
          </span>
        ),
      },
      {
        id: "performance",
        header: "Vs Network Avg",
        accessorFn: (w) => (networkAvgReward > 0 ? w.reward / networkAvgReward : 0),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums text-muted-foreground">
            {networkAvgReward > 0
              ? `${formatCurrency((row.original.reward / networkAvgReward) * 100, 1)}%`
              : "—"}
          </span>
        ),
      },
    ],
    [networkAvgReward]
  );

  return (
    <EntityTable
      columns={columns}
      data={filtered}
      searchPlaceholder="Search wallet, vault, or label…"
      initialSorting={[{ id: "reward", desc: true }]}
      pageSize={50}
      emptyMessage="No workers found for the current filters."
      toolbar={
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="h-8 w-56" size="sm" aria-label="Filter by operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All operators</SelectItem>
            {operators.map(([wallet, count]) => (
              <SelectItem key={wallet} value={wallet}>
                {identityName(wallet) ?? shortAddress(wallet)} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
