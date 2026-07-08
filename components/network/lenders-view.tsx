"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";

import { EntityTable } from "@/components/network/entity-table";
import { Identity, identityName, shortAddress } from "@/components/network/identity";
import { ActivityBadge, RankCell, RoleBadge, TrendCell } from "@/components/network/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LenderRow } from "@/lib/db/queries/entities";
import { formatCurrency } from "@/lib/format";

interface LendersViewProps {
  lenders: LenderRow[];
}

export function LendersView({ lenders }: LendersViewProps) {
  const [operator, setOperator] = React.useState<string>("all");

  const operators = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lenders) {
      counts.set(l.operator_wallet, (counts.get(l.operator_wallet) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [lenders]);

  const filtered = React.useMemo(
    () =>
      operator === "all" ? lenders : lenders.filter((l) => l.operator_wallet === operator),
    [lenders, operator]
  );

  const columns = React.useMemo<ColumnDef<LenderRow, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "Rank",
        accessorFn: (l) => l.contribution_rank,
        cell: ({ row }) => (
          <RankCell
            rank={row.original.contribution_rank}
            movement={row.original.rank_movement}
          />
        ),
      },
      {
        id: "identity",
        header: "Identity",
        accessorFn: (l) =>
          [l.wallet, l.vault, identityName(l.wallet)].filter(Boolean).join(" "),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Identity address={row.original.wallet} vault={row.original.vault} />
            {row.original.is_operator ? <RoleBadge role="operator" /> : null}
            <ActivityBadge state={row.original.activity_state} />
          </span>
        ),
      },
      {
        id: "operator",
        header: "Operator",
        accessorFn: (l) => identityName(l.operator_wallet) ?? l.operator_wallet,
        cell: ({ row }) => (
          <Identity
            address={row.original.operator_wallet}
            vault={row.original.operator_vault}
          />
        ),
      },
      {
        id: "contribution",
        header: "Contribution",
        accessorFn: (l) => l.contribution,
        cell: ({ row }) => (
          <span className="flex flex-col items-end tabular-nums">
            <span className="font-medium text-sky-600 dark:text-sky-400">
              {formatCurrency(row.original.contribution, 2)}
            </span>
            <TrendCell
              current={row.original.contribution}
              previous={row.original.prev_contribution}
              digits={2}
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
        id: "share",
        header: "Pool Share",
        accessorFn: (l) => l.share,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums text-muted-foreground">
            {formatCurrency(row.original.share, 2)}%
          </span>
        ),
      },
      {
        id: "reward",
        header: "Lending Reward",
        accessorFn: (l) => l.reward,
        cell: ({ row }) => (
          <span className="flex flex-col items-end tabular-nums">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(row.original.reward, 4)}
            </span>
            <TrendCell
              current={row.original.reward}
              previous={row.original.prev_reward}
              digits={4}
            />
          </span>
        ),
      },
    ],
    []
  );

  return (
    <EntityTable
      columns={columns}
      data={filtered}
      searchPlaceholder="Search wallet, vault, or label…"
      initialSorting={[{ id: "contribution", desc: true }]}
      pageSize={50}
      emptyMessage="No lenders found for the current filters."
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
