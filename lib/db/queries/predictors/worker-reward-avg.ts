import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getWorkerRewardAverage(date: Date) {
  "use cache";
  cacheLife("max");

  const res = await db
    .select({
      reward_avg: sql<number>`avg(${dailyPredictorAddress.reward})`,
      sum_rewards: sql<number>`sum(${dailyPredictorAddress.reward})`,
    })
    .from(dailyPredictorAddress)
    .where(sql`${dailyPredictorAddress.date} = ${date}`)
    .execute();

  return res[0] || null;
}

