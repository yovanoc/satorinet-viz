import { sql, and, eq, gt } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getWorkerCountWithEarnings(date: Date): Promise<number> {
  "use cache";
  cacheLife("max");

  const result = await db
    .select({
      worker_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
    })
    .from(dailyPredictorAddress)
    .where(
      and(
        eq(dailyPredictorAddress.date, sql`${date}`),
        gt(dailyPredictorAddress.miner_earned, 0)
      )
    )
    .execute();

  return result[0]?.worker_count ?? 0;
}
