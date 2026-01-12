import { PoolsStakingComparison } from "@/components/pools/pools-staking-comparison";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DatePickerWrapper from "@/components/date-picker-wrapper";
import { Suspense } from "react";
import TopPools from "@/components/top-pools";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCardsPools } from "@/components/section-cards-pools";
import { getPoolAndDate } from "@/lib/get-pool-and-date-params";
import { getTopPools } from "@/lib/db/queries/contributors";

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function TopPoolsCard({ date }: { date: Date }) {
  const topPools = await getTopPools(date);
  return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="font-bold text-2xl">Top {topPools.length} Pools</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="-mx-6">
            <TopPools key={date.toISOString()} pools={topPools} date={date} />
          </div>
        </CardContent>
      </Card>
  );
}

export default async function PoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string; date?: string }>;
}) {
  const params = await searchParams;
  const poolAndDate = await getPoolAndDate(params);

  const { selectedDate, topPoolsWithNames, requestedDate, hasData, didFallback } = poolAndDate;

  if (!hasData) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16 relative">
          <span className="text-xl font-bold lg:hidden">
            {selectedDate.toLocaleDateString()}
          </span>

          <span className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold">
            {selectedDate.toLocaleDateString()}
          </span>

          <div className="ml-auto">
            <DatePickerWrapper selectedDate={selectedDate} />
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">No pool data for this day</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              We don’t have pool snapshots for {ymd(selectedDate)} yet. Try selecting the previous day, or check back later.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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

      {didFallback ? (
        <div className="px-4 lg:px-6">
          <Card>
            <CardContent className="py-4 text-sm text-muted-foreground">
              No data for {ymd(requestedDate)} yet — showing the most recent day with data ({ymd(selectedDate)}).
            </CardContent>
          </Card>
        </div>
      ) : null}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[125px] w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <SectionCardsPools date={selectedDate} />
      </Suspense>
      <div className="grid grid-cols-1 items-start gap-4 px-4 lg:px-6 @7xl/main:grid-cols-[2fr_3fr]">
        <Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
        >
          <TopPoolsCard date={selectedDate} />
        </Suspense>
        <Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
        >
          <PoolsStakingComparison topPools={topPoolsWithNames} date={selectedDate} />
        </Suspense>
      </div>
    </div>
  );
}
