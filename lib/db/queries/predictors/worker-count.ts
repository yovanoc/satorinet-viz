import { sql, asc } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getDailyWorkerCounts(date: Date, days = 30) {
  "use cache";
  cacheLife("days");

  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_address_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      diff_from_previous_day: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) - lag(count(distinct ${dailyPredictorAddress.worker_address})) over (order by ${dailyPredictorAddress.date})`,
    })
    .from(dailyPredictorAddress)
    .where(
      sql`${dailyPredictorAddress.date} >= ${date}::timestamp - interval '1 day' * ${days}`
    )
    .groupBy(dailyPredictorAddress.date)
    .orderBy(asc(dailyPredictorAddress.date))
    .execute();
}
