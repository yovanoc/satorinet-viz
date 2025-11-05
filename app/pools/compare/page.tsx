import MultiPoolWorkerComparison from "@/components/pools/multi-pool-worker-comparison";
import { getTodayMidnightUTC } from "@/lib/date";
import { getPoolAndDate } from "@/lib/get-pool-and-date-params";
import { cacheLife } from "next/cache";

export default async function PoolsCompare() {
  'use cache';
  cacheLife('hours');

  const date = getTodayMidnightUTC();
  const { topPoolsWithNames } = await getPoolAndDate({});
  return (
    <div className="flex flex-col py-4 gap-4 px-4 lg:px-6 h-full">
      <MultiPoolWorkerComparison date={date} topPools={topPoolsWithNames} />
    </div>
  );
}
