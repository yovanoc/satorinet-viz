import { PoolsStakingComparison } from "@/components/old/pools-staking-comparison";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { Card } from "@/components/ui/card";
import DatePickerWrapper from "@/components/old/date-picker-wrapper";
import { Suspense } from "react";
import { getTopPools } from "@/lib/db";
import TopPools from "@/components/top-pools";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCardsPools } from "@/components/section-cards-pools";
import { getPoolAndDate } from "@/lib/get-pool-and-date-params";

async function TopPoolsCard({ date }: { date: Date }) {
  const topPools = await getTopPools(date);
  return <TopPools key={date.toISOString()} pools={topPools} date={date} />;
}

export default async function PoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string; date?: string }>;
}) {
  const params = await searchParams;
  const poolAndDate = await getPoolAndDate(params);

  if (!poolAndDate) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        Pool not found
      </Card>
    );
  }

  const { selectedDate } = poolAndDate;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16 relative">
        {/* Mobile: left-aligned date */}
        <span className="text-xl font-bold lg:hidden">
          {selectedDate.toLocaleDateString()}
        </span>

        {/* Desktop: centered date */}
        <span className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold">
          {selectedDate.toLocaleDateString()}
        </span>
        <div className="ml-auto">
          <DatePickerWrapper selectedDate={selectedDate} />
        </div>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-6">
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <Skeleton className="h-[125px] w-full rounded-xl" />
            <Skeleton className="h-[125px] w-full rounded-xl" />
          </div>
        }
      >
        <SectionCardsPools date={selectedDate} />
      </Suspense>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @7xl/main:grid-cols-2">
        <Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
        >
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-4">Top 15 Pools</h2>
            <TopPoolsCard date={selectedDate} />
          </div>
        </Suspense>
        <Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
        >
          <PoolsStakingComparison pools={KNOWN_POOLS} date={selectedDate} />
        </Suspense>
      </div>
    </div>
  );
}
