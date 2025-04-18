import { sql, and, eq, gt } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getDailyMiningEarnings(date: Date) {
  "use cache";
  cacheLife("max");

  const result = await db
    .select({
      total_miner_earned: sql<number>`sum(${dailyPredictorAddress.miner_earned})`,
      avg_miner_earned: sql<number>`avg(${dailyPredictorAddress.miner_earned})`,
    })
    .from(dailyPredictorAddress)
    .where(
      and(
        eq(dailyPredictorAddress.date, sql`${date}`),
        gt(dailyPredictorAddress.miner_earned, 0)
      )
    )
    .groupBy(dailyPredictorAddress.date)
    .execute();

  // If the result array has any values, return the first element
  return result[0] || null; // Return null if no result is found
}
