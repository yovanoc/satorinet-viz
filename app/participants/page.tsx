import { Suspense } from "react";

import DatePickerWrapper from "@/components/date-picker-wrapper";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/network/metric-card";
import { ParticipantsView } from "@/components/network/participants-view";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getParticipantsMovementHistory,
  getParticipantsSnapshot,
} from "@/lib/db/queries/entities";
import { formatCurrency } from "@/lib/format";
import { parseDateParam } from "@/lib/date-param";

export const metadata = {
  title: "Participants",
  description: "Daily identity movement across Satori operators and lenders",
};

const CARDS_GRID =
  "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5";

async function ParticipantsContent({ dateParam }: { dateParam?: string }) {
  const [snapshot, movement] = await Promise.all([
    getParticipantsSnapshot(parseDateParam(dateParam)),
    getParticipantsMovementHistory(),
  ]);

  if (!snapshot || snapshot.active.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No participant data found for this day.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { active, left } = snapshot;
  const operators = active.filter((p) => p.is_operator).length;
  const lenders = active.filter((p) => p.is_lender).length;
  const multiRole = active.filter((p) => p.is_operator && p.is_lender).length;
  const newCount = active.filter((p) => p.activity_state === "new").length;
  const returnedCount = active.filter((p) => p.activity_state === "returned").length;

  return (
    <>
      <div className={CARDS_GRID}>
        <MetricCard
          label="Active Participants"
          value={formatCurrency(active.length, 0)}
          helper={`Snapshot of ${snapshot.date}`}
        />
        <MetricCard
          label="Movement Events"
          value={formatCurrency(newCount + returnedCount + left.length, 0)}
          helper="New, back, and left this day"
        />
        <MetricCard
          label="Operators"
          value={formatCurrency(operators, 0)}
          helper="Active operator identities"
        />
        <MetricCard
          label="Lenders"
          value={formatCurrency(lenders, 0)}
          helper="Active lender identities"
        />
        <MetricCard
          label="Multi-role"
          value={formatCurrency(multiRole, 0)}
          helper="More than one active role"
        />
      </div>
      <div className="px-4 lg:px-6">
        <ParticipantsView active={active} left={left} movement={movement} />
      </div>
    </>
  );
}

function ParticipantsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-31.25 w-full rounded-xl" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-150 w-full rounded-xl" />
      </div>
    </>
  );
}

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader
        title="Participants"
        subtitle="Daily identity movement across operators and lenders"
      >
        <Suspense>
          <DatePickerWrapper selectedDate={parseDateParam(params.date)} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<ParticipantsSkeleton />}>
        <ParticipantsContent dateParam={params.date} />
      </Suspense>
    </div>
  );
}
