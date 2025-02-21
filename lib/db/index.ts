import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../env';
import * as schema from './schema';
import { desc, sql, eq, and, gte, lte } from "drizzle-orm";
import { dailyContributorAddress, dailyPredictorAddress } from './schema';

export const db = drizzle(env.DATABASE_URL, {
  schema,
});

export async function getPoolHistoricalData(poolAddress: string, date: Date, days = 30) {
  return db
    .select({
      date: dailyContributorAddress.date,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
      contributor_count_with_staking_power: sql<number>`count(distinct ${dailyContributorAddress.contributor}) filter (where ${dailyContributorAddress.staking_power_contribution} > 0)`,
    })
    .from(dailyContributorAddress)
    .where(
      sql`${dailyContributorAddress.pool_address} = ${poolAddress}
      AND ${dailyContributorAddress.date} >= ${date}::timestamp - interval '1 day' * ${days}
      AND ${dailyContributorAddress.date} <= ${date}`,
    )
    .groupBy(dailyContributorAddress.date)
    .orderBy(dailyContributorAddress.date)
    .execute()
}

export async function getPoolWorkerStats(poolAddress: string, date: Date, days = 30) {
  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      worker_count_with_earnings: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) filter (where ${dailyPredictorAddress.miner_earned} > 0)`,
      worker_count_with_rewards: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) filter (where ${dailyPredictorAddress.reward} > 0)`,
      total_reward: sql<number>`sum(${dailyPredictorAddress.reward})`,
      total_miner_earned: sql<number>`sum(${dailyPredictorAddress.miner_earned})`,
      avg_score: sql<number>`avg(${dailyPredictorAddress.score}) filter (where ${dailyPredictorAddress.score} > 0)`,
    })
    .from(dailyPredictorAddress)
    .where(
      and(
        eq(dailyPredictorAddress.reward_address, poolAddress),
        gte(dailyPredictorAddress.date, sql`${date}::timestamp - ${days} * interval '1 day'`),
        lte(dailyPredictorAddress.date, sql`${date}`),
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

