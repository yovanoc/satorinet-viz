import { Suspense } from "react";

import DatePickerWrapper from "@/components/date-picker-wrapper";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/network/metric-card";
import { LendersView } from "@/components/network/lenders-view";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLendersSnapshot } from "@/lib/db/queries/entities";
import { formatCurrency } from "@/lib/format";
import { parseDateParam } from "@/lib/date-param";

export const metadata = {
  title: "Lenders",
  description: "Capital allocation across Satori operators — contributions and lending rewards",
};

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4";

async function LendersContent({ dateParam }: { dateParam?: string }) {
  const snapshot = await getLendersSnapshot(parseDateParam(dateParam));

  if (!snapshot || snapshot.lenders.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No lender data found for this day.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { lenders } = snapshot;
  const uniqueWallets = new Set(lenders.map((l) => l.wallet)).size;
  const totalContribution = lenders.reduce((acc, l) => acc + l.contribution, 0);
  const totalRewards = lenders.reduce((acc, l) => acc + l.reward, 0);
  const operatorLinked = lenders.filter((l) => l.is_operator);
  const operatorLinkedContribution = operatorLinked.reduce(
    (acc, l) => acc + l.contribution,
    0
  );
  const stable = lenders.filter((l) => l.prev_contribution != null);
  const prevContributionOfStable = stable.reduce(
    (acc, l) => acc + (l.prev_contribution ?? 0),
    0
  );
  const contributionOfStable = stable.reduce((acc, l) => acc + l.contribution, 0);

  return (
    <>
      <div className={CARDS_GRID}>
        <MetricCard
          label="Active Lenders"
          value={formatCurrency(uniqueWallets, 0)}
          helper={`${formatCurrency(lenders.length, 0)} allocations on ${snapshot.date}`}
        />
        <MetricCard
          label="Total Contributed"
          value={formatCurrency(totalContribution, 0)}
          helper="SATORI currently allocated"
          current={contributionOfStable}
          previous={prevContributionOfStable}
        />
        <MetricCard
          label="Lending Rewards"
          value={formatCurrency(totalRewards, 4)}
          helper="SATORI distributed this day"
        />
        <MetricCard
          label="Operator-linked"
          value={formatCurrency(operatorLinkedContribution, 0)}
          helper={`${formatCurrency(operatorLinked.length, 0)} operator-linked allocations`}
        />
      </div>
      <div className="px-4 lg:px-6">
        <LendersView lenders={lenders} />
      </div>
    </>
  );
}

function LendersSkeleton() {
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

export default async function LendersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Lenders"
        subtitle="Capital allocation across operators — contributions, shares, and lending rewards"
      >
        <Suspense>
          <DatePickerWrapper selectedDate={parseDateParam(params.date)} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<LendersSkeleton />}>
        <LendersContent dateParam={params.date} />
      </Suspense>
    </div>
  );
}
