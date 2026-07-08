"use client";

import * as React from "react";
import Link from "next/link";
import { IconStarFilled } from "@tabler/icons-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { applyFees } from "@/lib/pool-utils";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

const PERIODS = [7, 30, 60, 90] as const;

export interface PoolReturnSeries {
  address: string;
  name: string;
  /** Ascending daily gross earnings per staking power. */
  days: { date: string; eps: number }[];
}

interface PoolReturnsTableProps {
  series: PoolReturnSeries[];
  satoriPrice: number | null;
  fullStakeAmount: number;
}

type Computed = {
  address: string;
  name: string;
  observedDays: number;
  projected: boolean;
  feePercent: number;
  returnPct: number;
  finalBalance: number;
};

function compound(
  pool: PoolReturnSeries,
  periodDays: number,
  balance: number,
  net: boolean,
  satoriPrice: number | null,
  fullStakeAmount: number
): Computed | null {
  const window = pool.days.slice(-periodDays);
  if (window.length === 0) return null;

  let current = balance;
  let feePercent = 0;
  for (const day of window) {
    if (net) {
      const applied = applyFees({
        poolAddress: pool.address,
        date: new Date(`${day.date}T00:00:00Z`),
        earnings_per_staking_power: day.eps,
        current_staked_amount: current,
        satoriPrice: satoriPrice ?? 0,
        fullStakeAmount,
      });
      const result = applied.type === "multiple" ? applied.results[0]! : applied.result;
      current += Math.max(result.net, 0);
      feePercent = result.feePercent;
    } else {
      current += Math.max(day.eps * current, 0);
    }
  }

  const observedDays = window.length;
  const projected = observedDays < periodDays;
  let finalBalance = current;
  if (projected && current > balance && balance > 0) {
    // Project the observed geometric growth onto the full period.
    finalBalance = balance * Math.pow(current / balance, periodDays / observedDays);
  }

  return {
    address: pool.address,
    name: pool.name,
    observedDays,
    projected,
    feePercent,
    returnPct: balance > 0 ? (finalBalance / balance - 1) * 100 : 0,
    finalBalance,
  };
}

export function PoolReturnsTable({
  series,
  satoriPrice,
  fullStakeAmount,
}: PoolReturnsTableProps) {
  const [period, setPeriod] = React.useState<(typeof PERIODS)[number]>(30);
  const [mode, setMode] = React.useState<"net" | "gross">("net");
  const [balanceInput, setBalanceInput] = React.useState("1000");

  const balance = Math.min(Math.max(Number(balanceInput) || 0, 0), 10_000_000);

  const rows = React.useMemo(
    () =>
      series
        .map((pool) =>
          compound(pool, period, balance || 1000, mode === "net", satoriPrice, fullStakeAmount)
        )
        .filter((r): r is Computed => r !== null)
        .sort((a, b) => b.returnPct - a.returnPct),
    [series, period, balance, mode, satoriPrice, fullStakeAmount]
  );

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Pool Returns</CardTitle>
        <CardDescription>
          Compounded {mode === "net" ? "net (after pool fees)" : "gross (before fees)"} return
          over the selected period, per pool
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={mode}
            onValueChange={(v) => {
              if (v) setMode(v as "net" | "gross");
            }}
            aria-label="Net or gross returns"
          >
            <ToggleGroupItem value="net">Net</ToggleGroupItem>
            <ToggleGroupItem value="gross">Gross</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={String(period)}
            onValueChange={(v) => {
              if (v) setPeriod(Number(v) as (typeof PERIODS)[number]);
            }}
            aria-label="Return period"
          >
            {PERIODS.map((p) => (
              <ToggleGroupItem key={p} value={String(p)}>
                {p}D
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="pool-returns-balance" className="text-xs text-muted-foreground">
            Balance to project
          </Label>
          <Input
            id="pool-returns-balance"
            type="number"
            min={0}
            max={10_000_000}
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            className="h-8 w-32 tabular-nums"
          />
          <span className="text-xs text-muted-foreground">SATORI over {period} days</span>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                  Pool
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Commission
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  {period}D Return
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Final Balance
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Data
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.address}>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {index === 0 && row.returnPct > 0 ? (
                        <IconStarFilled className="size-3.5 text-amber-500" />
                      ) : null}
                      <Link
                        href={`/pools/single?pool=${row.address}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {mode === "net"
                      ? `${formatCurrency(Math.min(row.feePercent, 1) * 100, 1)}%`
                      : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      row.returnPct >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {row.returnPct >= 0 ? "+" : ""}
                    {formatCurrency(row.returnPct, 2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.finalBalance, 2)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {row.projected
                      ? `Projected from ${row.observedDays}d`
                      : `${row.observedDays}d observed`}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                    No pool history available for this period.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Compounds each pool&apos;s daily earnings per staking power
          {mode === "net" ? ", applying its fee schedule per day" : ""}. Multi-tier fee pools
          use their first tier. Past performance does not guarantee future returns.
        </p>
      </CardContent>
    </Card>
  );
}
