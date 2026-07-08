import { Suspense } from "react";

import DatePickerWrapper from "@/components/date-picker-wrapper";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/network/metric-card";
import { OperatorsView } from "@/components/network/operators-view";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOperatorsSnapshot } from "@/lib/db/queries/entities";
import { formatCurrency } from "@/lib/format";
import { parseDateParam } from "@/lib/date-param";

export const metadata = {
  title: "Operators",
  description: "Operator capacity, rewards, and efficiency across the Satori network",
};

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

async function OperatorsContent({ dateParam }: { dateParam?: string }) {
  const snapshot = await getOperatorsSnapshot(parseDateParam(dateParam));

  if (!snapshot || snapshot.operators.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No operator data found for this day.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { operators } = snapshot;
  const sum = (fn: (o: (typeof operators)[number]) => number) =>
    operators.reduce((acc, o) => acc + fn(o), 0);
  const prevSum = (fn: (o: (typeof operators)[number]) => number | null) => {
    let total = 0;
    let any = false;
    for (const o of operators) {
      const v = fn(o);
      if (v != null) {
        total += v;
        any = true;
      }
    }
    return any ? total : null;
  };

  return (
    <>
      <div className={CARDS_GRID}>
        <MetricCard
          label="Active Operators"
          value={formatCurrency(operators.length, 0)}
          helper={`Snapshot of ${snapshot.date}`}
        />
        <MetricCard
          label="Total Workers"
          value={formatCurrency(sum((o) => o.worker_count), 0)}
          helper="Workers currently allocated"
          current={sum((o) => o.worker_count)}
          previous={prevSum((o) => o.prev_worker_count)}
        />
        <MetricCard
          label="Total Rewards"
          value={formatCurrency(sum((o) => o.total_rewards), 2)}
          helper="SATORI distributed this day"
          current={sum((o) => o.total_rewards)}
          previous={prevSum((o) => o.prev_total_rewards)}
        />
        <MetricCard
          label="Total Stake Power"
          value={formatCurrency(sum((o) => o.stake_power), 0)}
          helper="SATORI providing worker capacity"
          current={sum((o) => o.stake_power)}
          previous={prevSum((o) => o.prev_stake_power)}
        />
      </div>
      <div className="px-4 lg:px-6">
        <OperatorsView
          operators={operators}
          networkAvgReward={snapshot.network_avg_reward}
          prevNetworkAvgReward={snapshot.prev_network_avg_reward}
          stakePerWorker={snapshot.stake_per_worker}
        />
      </div>
    </>
  );
}

function OperatorsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-31.25 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-75 w-full rounded-xl" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-100 w-full rounded-xl" />
      </div>
    </>
  );
}

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Operators"
        subtitle="Daily operator capacity, rewards, and efficiency across the network"
      >
        <Suspense>
          <DatePickerWrapper selectedDate={parseDateParam(params.date)} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<OperatorsSkeleton />}>
        <OperatorsContent dateParam={params.date} />
      </Suspense>
    </div>
  );
}
