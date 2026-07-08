"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { EntityTable } from "@/components/network/entity-table";
import { Identity, identityName } from "@/components/network/identity";
import { ActivityBadge, RankCell, RoleBadge } from "@/components/network/badges";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MovementDay, Participant } from "@/lib/db/queries/entities";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

const RANGES = [
  { value: "30d", label: "30D", days: 30 },
  { value: "90d", label: "90D", days: 90 },
  { value: "all", label: "All", days: Infinity },
] as const;

function MovementChart({ movement }: { movement: MovementDay[] }) {
  const [range, setRange] = React.useState<(typeof RANGES)[number]["value"]>("30d");
  const days = RANGES.find((r) => r.value === range)?.days ?? 30;
  const data = Number.isFinite(days) ? movement.slice(-days) : movement;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Participant Movement</CardTitle>
        <CardDescription>Daily lifecycle changes — new, back, and left identities</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={range}
            onValueChange={(v) => {
              if (v) setRange(v as typeof range);
            }}
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer
          config={{
            new_count: { label: "New", color: "var(--chart-3)" },
            returned_count: { label: "Back", color: "var(--chart-5)" },
            left_count: { label: "Left", color: "var(--chart-2)" },
          }}
          className="aspect-auto h-62.5 w-full"
        >
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 12 }} />
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
            <Bar
              dataKey="new_count"
              name="New"
              fill="var(--chart-3)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="returned_count"
              name="Back"
              fill="var(--chart-5)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              dataKey="left_count"
              name="Left"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function MovementPanel({
  title,
  description,
  participants,
  tone,
}: {
  title: string;
  description: string;
  participants: Participant[];
  tone: "success" | "info" | "danger";
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? participants : participants.slice(0, 6);
  const toneClass = {
    success: "border-emerald-500/25",
    info: "border-sky-500/25",
    danger: "border-red-500/25",
  }[tone];

  return (
    <Card className={cn("@container/card", toneClass)}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {formatCurrency(participants.length, 0)}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {visible.map((p) => (
          <span key={p.wallet} className="flex items-center gap-1.5">
            <Identity address={p.wallet} vault={p.vault} />
            {p.is_operator ? <RoleBadge role="operator" /> : null}
            {p.is_lender ? <RoleBadge role="lender" /> : null}
          </span>
        ))}
        {participants.length > 6 ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-fit text-xs"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Show less" : `Show ${participants.length - 6} more`}
          </Button>
        ) : null}
        {participants.length === 0 ? (
          <span className="text-xs text-muted-foreground">None today</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function rolePriority(p: Participant): number {
  return p.is_operator && p.is_lender ? 0 : p.is_operator ? 1 : p.is_lender ? 2 : 3;
}

function primaryRole(p: Participant): string {
  if (p.is_operator && p.is_lender) return "Multi-role";
  if (p.is_operator) return "Operator";
  if (p.is_lender) return "Lender";
  return "Participant";
}

interface ParticipantsViewProps {
  active: Participant[];
  left: Participant[];
  movement: MovementDay[];
}

export function ParticipantsView({ active, left, movement }: ParticipantsViewProps) {
  const [role, setRole] = React.useState("all");
  const [activity, setActivity] = React.useState("all");

  const filtered = React.useMemo(
    () =>
      [...active]
        .sort((a, b) => rolePriority(a) - rolePriority(b))
        .filter((p) => {
        if (role === "operator" && !p.is_operator) return false;
        if (role === "lender" && !p.is_lender) return false;
        if (role === "multi" && !(p.is_operator && p.is_lender)) return false;
        if (activity === "new" && p.activity_state !== "new") return false;
        if (activity === "returned" && p.activity_state !== "returned") return false;
          if (activity === "stable" && p.activity_state != null) return false;
          return true;
        }),
    [active, role, activity]
  );

  const columns = React.useMemo<ColumnDef<Participant, unknown>[]>(
    () => [
      {
        id: "rank",
        header: "#",
        accessorFn: (_p, i) => i + 1,
        enableSorting: false,
        cell: ({ row }) => <RankCell rank={row.index + 1} movement={undefined} />,
      },
      {
        id: "identity",
        header: "Identity",
        accessorFn: (p) => [p.wallet, p.vault, identityName(p.wallet)].filter(Boolean).join(" "),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Identity address={row.original.wallet} vault={row.original.vault} />
            <ActivityBadge
              state={row.original.activity_state as "new" | "returned" | null}
            />
          </span>
        ),
      },
      {
        id: "primary",
        header: "Primary Role",
        accessorFn: (p) => primaryRole(p),
      },
      {
        id: "roles",
        header: "Roles",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex justify-end gap-1">
            {row.original.is_operator ? <RoleBadge role="operator" /> : null}
            {row.original.is_lender ? <RoleBadge role="lender" /> : null}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-4">
      {movement.length > 1 ? <MovementChart movement={movement} /> : null}
      <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-3">
        <MovementPanel
          title="New Participants"
          description="First seen this day"
          participants={active.filter((p) => p.activity_state === "new")}
          tone="success"
        />
        <MovementPanel
          title="Back Participants"
          description="Active again after a pause"
          participants={active.filter((p) => p.activity_state === "returned")}
          tone="info"
        />
        <MovementPanel
          title="Left Participants"
          description="No longer active this day"
          participants={left}
          tone="danger"
        />
      </div>
      <EntityTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search address, vault, or label…"
        pageSize={50}
        emptyMessage="No active participants match the current filters."
        toolbar={
          <>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-8 w-40" size="sm" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="operator">Operators</SelectItem>
                <SelectItem value="lender">Lenders</SelectItem>
                <SelectItem value="multi">Multi-role</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="h-8 w-40" size="sm" aria-label="Filter by activity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All active</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="returned">Back</SelectItem>
                <SelectItem value="stable">Stable</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
    </div>
  );
}
