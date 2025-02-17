import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../env';
import * as schema from './schema';
import { desc, sql } from 'drizzle-orm';
import { dailyContributorAddress, dailyPredictorAddress } from './schema';

export const db = drizzle(env.DATABASE_URL, {
  schema,
});

export async function getPoolHistoricalData(poolAddress: string, days = 30) {
  return db
    .select({
      date: dailyContributorAddress.date,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(
      sql`${dailyContributorAddress.pool_address} = ${poolAddress}
      AND ${dailyContributorAddress.date} >= current_date - interval '1 day' * ${days}`,
    )
    .groupBy(dailyContributorAddress.date)
    .orderBy(dailyContributorAddress.date)
    .execute()
}

import { eq, and, gte } from "drizzle-orm";

export async function getPoolWorkerStats(poolAddress: string, days = 30) {
  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      total_reward: sql<number>`sum(${dailyPredictorAddress.reward})`,
      total_miner_earned: sql<number>`sum(${dailyPredictorAddress.miner_earned})`,
      avg_score: sql<number>`avg(${dailyPredictorAddress.score})`,
    })
    .from(dailyPredictorAddress)
    .where(
      and(
        eq(dailyPredictorAddress.reward_address, poolAddress),
        gte(dailyPredictorAddress.date, sql`current_date - ${days} * interval '1 day'`)
      )
    )
    .groupBy(dailyPredictorAddress.date)
    .orderBy(dailyPredictorAddress.date)
    .execute();
}

export async function getDailyWorkerCounts() {
  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_address_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      diff_from_previous_day: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) - lag(count(distinct ${dailyPredictorAddress.worker_address})) over (order by ${dailyPredictorAddress.date})`,
    })
    .from(dailyPredictorAddress)
    .where(sql`${dailyPredictorAddress.date} >= current_date - interval '1 day' * 18`)
    .groupBy(dailyPredictorAddress.date)
    .orderBy(desc(dailyPredictorAddress.date))
    .execute()
}

