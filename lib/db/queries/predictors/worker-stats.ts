import { and, or, eq, gte, lte, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getPoolWorkerStats(
  poolAddress: string,
  poolVaultAddress: string | undefined,
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("max");

  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      worker_count_with_earnings: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) filter (where ${dailyPredictorAddress.miner_earned} > 0)`,
      total_reward: sql<number>`sum(${dailyPredictorAddress.reward})`,
      total_miner_earned: sql<number>`sum(${dailyPredictorAddress.miner_earned})`,
      total_delegated_stake: sql<number>`sum(${dailyPredictorAddress.delegated_stake})`,
      total_balance: sql<number>`sum(${dailyPredictorAddress.balance})`,
      avg_score: sql<number>`avg(${dailyPredictorAddress.score}) filter (where ${dailyPredictorAddress.score} > 0)`,
      pool_miner_percent: sql<number>`avg(${dailyPredictorAddress.pool_miner_percent}) filter (where ${dailyPredictorAddress.miner_earned} > 0)`,
    })
    .from(dailyPredictorAddress)
    .where(
      and(
        // ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_address),
        // or(
        //   isNull(dailyPredictorAddress.worker_vault_address),
        //   ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_vault_address),
        // ),
        or(
          eq(dailyPredictorAddress.reward_address, poolAddress),
          poolVaultAddress ? eq(dailyPredictorAddress.reward_address, poolVaultAddress) : undefined,
        ),
        gte(
          dailyPredictorAddress.date,
          sql`${date}::timestamp - ${days} * interval '1 day'`
        ),
        lte(dailyPredictorAddress.date, sql`${date}`)
      )
    )
    .groupBy(dailyPredictorAddress.date)
    .orderBy(dailyPredictorAddress.date)
    .execute();
}
