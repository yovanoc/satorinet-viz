import { Suspense } from "react";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import DatePickerWrapper from "@/components/date-picker-wrapper";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/network/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDateParam } from "@/lib/date-param";
import { getLeaderboardPage, SATORI_API_EARLIEST_DATE } from "@/lib/satorinet/api";
import { formatCurrency } from "@/lib/format";
import { LeaderboardTable } from "./leaderboard-table";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Satori neuron ranking from the daily leaderboard",
};

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

async function LeaderboardContent({ dateParam, offsetParam }: { dateParam?: string; offsetParam?: string }) {
  const date = parseDateParam(dateParam);
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  if (date < SATORI_API_EARLIEST_DATE) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground text-center">
            No leaderboard data before {SATORI_API_EARLIEST_DATE.toISOString().split("T")[0]}.
          </CardContent>
        </Card>
      </div>
    );
  }

  const page = await getLeaderboardPage(date, isNaN(offset) ? 0 : offset);

  if (!page || page.predictors.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground text-center">
            No leaderboard data found for this day.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className={CARDS_GRID}>
        <MetricCard
          label="Predictors"
          value={formatCurrency(page.predictor_count, 0)}
          helper={`On ${date.toISOString().split("T")[0]}`}
        />
        <MetricCard
          label="Total Distributed"
          value={formatCurrency(page.total_distributed, 2)}
          helper="SATORI"
        />
        <MetricCard
          label="Observation TS"
          value={new Date(page.observation_ts).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          helper="Snapshot time"
        />
        <MetricCard
          label="Scoring Weights"
          value={`${formatCurrency(page.scoring_weights.bitcoin_skill ?? 0, 2)} / ${formatCurrency(page.scoring_weights.accuracy ?? 0, 2)}`}
          helper="BTC Skill / Accuracy"
        />
      </div>
      <div className="px-4 lg:px-6">
        <LeaderboardTable page={page} dateParam={dateParam} />
      </div>
    </>
  );
}

function LeaderboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-31.25 w-full rounded-xl" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-150 w-full rounded-xl" />
      </div>
    </>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; offset?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Leaderboard"
        subtitle="Satori neuron ranking and performance scores"
      >
        <Suspense>
          <DatePickerWrapper selectedDate={parseDateParam(params.date)} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardContent dateParam={params.date} offsetParam={params.offset} />
      </Suspense>
    </div>
  );
}
