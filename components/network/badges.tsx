import { IconArrowDown, IconArrowUp, IconMinus } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export function ActivityBadge({
  state,
}: {
  state: "new" | "returned" | "left" | null | undefined;
}) {
  if (!state) return null;
  const styles = {
    new: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
    returned: "border-sky-500/40 text-sky-600 dark:text-sky-400",
    left: "border-red-500/40 text-red-600 dark:text-red-400",
  } as const;
  const labels = { new: "New", returned: "Back", left: "Left" } as const;
  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px] uppercase", styles[state])}>
      {labels[state]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: "operator" | "lender" | "worker" | "pool" }) {
  const styles = {
    operator: "border-amber-500/40 text-amber-600 dark:text-amber-400",
    lender: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
    worker: "border-indigo-500/40 text-indigo-600 dark:text-indigo-400",
    pool: "border-teal-500/40 text-teal-600 dark:text-teal-400",
  } as const;
  const labels = {
    operator: "Operator",
    lender: "Lender",
    worker: "Worker",
    pool: "Pool",
  } as const;
  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px] uppercase", styles[role])}>
      {labels[role]}
    </Badge>
  );
}

/** Rank number with an up/down movement indicator vs the previous day. */
export function RankCell({
  rank,
  movement,
}: {
  rank: number;
  movement: number | null | undefined;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="font-semibold">#{rank}</span>
      {movement == null ? null : movement === 0 ? (
        <IconMinus className="size-3 text-muted-foreground" />
      ) : movement > 0 ? (
        <span className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400">
          <IconArrowUp className="size-3" />
          {movement}
        </span>
      ) : (
        <span className="inline-flex items-center text-xs text-red-600 dark:text-red-400">
          <IconArrowDown className="size-3" />
          {-movement}
        </span>
      )}
    </span>
  );
}

/** Small inline delta vs previous day, for table cells. */
export function TrendCell({
  current,
  previous,
  digits = 2,
  fallback,
}: {
  current: number;
  previous: number | null | undefined;
  digits?: number;
  fallback?: string;
}) {
  if (previous == null || !Number.isFinite(previous)) {
    return fallback ? (
      <span className="text-[11px] text-muted-foreground">{fallback}</span>
    ) : null;
  }
  const delta = current - previous;
  if (Math.abs(delta) < 10 ** -(digits + 2)) {
    return <span className="text-[11px] text-muted-foreground">±0</span>;
  }
  return (
    <span
      className={cn(
        "text-[11px] tabular-nums",
        delta > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      )}
    >
      {delta > 0 ? "+" : "−"}
      {formatCurrency(Math.abs(delta), digits)}
    </span>
  );
}
