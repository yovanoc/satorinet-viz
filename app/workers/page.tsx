import { Suspense } from "react";

import DatePickerWrapper from "@/components/date-picker-wrapper";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/network/metric-card";
import { WorkersView } from "@/components/network/workers-view";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkersSnapshot } from "@/lib/db/queries/entities";
import { formatCurrency } from "@/lib/format";
import { parseDateParam } from "@/lib/date-param";

export const metadata = {
  title: "Workers",
  description: "Daily worker rewards, ranks, and operators on the Satori network",
};

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function WorkersContent({ dateParam }: { dateParam?: string }) {
  const snapshot = await getWorkersSnapshot(parseDateParam(dateParam));

  if (!snapshot || snapshot.workers.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No worker data found for this day.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { workers, network_avg_reward } = snapshot;
  const totalRewards = workers.reduce((acc, w) => acc + w.reward, 0);
  const stable = workers.filter((w) => w.prev_reward != null);
  const prevTotalOfStable = stable.reduce((acc, w) => acc + (w.prev_reward ?? 0), 0);
  const totalOfStable = stable.reduce((acc, w) => acc + w.reward, 0);

  return (
    <>
      <div className={CARDS_GRID}>
        <MetricCard
          label="Active Workers"
          value={formatCurrency(workers.length, 0)}
          helper={`Snapshot of ${snapshot.date}`}
        />
        <MetricCard
          label="Total Rewards"
          value={formatCurrency(totalRewards, 2)}
          helper="SATORI earned this day"
        />
        <MetricCard
          label="Avg Reward"
          value={formatCurrency(network_avg_reward, 4)}
          helper="SATORI per worker"
          current={totalOfStable / Math.max(stable.length, 1)}
          previous={prevTotalOfStable / Math.max(stable.length, 1)}
        />
        <MetricCard
          label="Median Reward"
          value={formatCurrency(median(workers.map((w) => w.reward)), 4)}
          helper="Middle worker reward"
        />
      </div>
      <div className="px-4 lg:px-6">
        <WorkersView workers={workers} networkAvgReward={network_avg_reward} />
      </div>
    </>
  );
}

function WorkersSkeleton() {
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

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Workers"
        subtitle="Neurons predicting data streams — daily rewards, ranks, and operators"
      >
        <Suspense>
          <DatePickerWrapper selectedDate={parseDateParam(params.date)} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<WorkersSkeleton />}>
        <WorkersContent dateParam={params.date} />
      </Suspense>
    </div>
  );
}
