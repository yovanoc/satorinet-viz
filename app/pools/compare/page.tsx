import MultiPoolWorkerComparison from "@/components/pools/multi-pool-worker-comparison";
import { getPoolAndDate } from "@/lib/get-pool-and-date-params";
import { cacheLife } from "next/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function PoolsCompare() {
  'use cache';
  cacheLife('hours');

  const { topPoolsWithNames, selectedDate, requestedDate, hasData, didFallback } =
    await getPoolAndDate({});

  if (!hasData) {
    return (
      <div className="flex flex-col py-4 gap-4 px-4 lg:px-6 h-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">No pool data for this day</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We don’t have pool snapshots for {ymd(selectedDate)} yet. Try again later.
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col py-4 gap-4 px-4 lg:px-6 h-full">
      {didFallback ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            No data for {ymd(requestedDate)} yet — showing the most recent day with data ({ymd(selectedDate)}).
          </CardContent>
        </Card>
      ) : null}
      <MultiPoolWorkerComparison date={selectedDate} topPools={topPoolsWithNames} />
    </div>
  );
}
