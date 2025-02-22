import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../env';
import * as schema from './schema';
import { desc, sql, eq, and, gte, lte } from "drizzle-orm";
import { dailyContributorAddress, dailyPredictorAddress } from './schema';
import { unstable_cacheLife as cacheLife } from 'next/cache'

export const db = drizzle(env.DATABASE_URL, {
  schema,
});

export async function getTopPools(date: Date) {
  'use cache';
  cacheLife('days');

  return db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = ${date}`)
    .groupBy(dailyContributorAddress.pool_address)
    .orderBy(desc(sql`sum(${dailyContributorAddress.staking_power_contribution})`))
    .limit(20)
    .execute()
}

export async function getPoolHistoricalData(
  poolAddress: string,
  poolVaultAddress: string | undefined,
  date: Date,
  days = 30
) {
  'use cache';
  cacheLife('days');

  return db
    .select({
      date: dailyContributorAddress.date,
      total_staking_power: sql<number>`SUM(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor})`,
      contributor_count_with_staking_power: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor}) FILTER (WHERE ${dailyContributorAddress.staking_power_contribution} > 0)`,
      earnings_per_staking_power: poolVaultAddress
        ? sql<number>`COALESCE(
            SUM(${dailyPredictorAddress.reward}) - SUM(${dailyPredictorAddress.miner_earned}),
            0
          ) / NULLIF(SUM(${dailyContributorAddress.staking_power_contribution}), 0)`
        : sql<number>`0`
    })
    .from(dailyContributorAddress)
    .leftJoin(
      poolVaultAddress
        ? dailyPredictorAddress
        : sql`(SELECT 1 AS id)`, // If no poolVaultAddress, use dummy table to avoid unnecessary join
      sql`TRUE`
    )
    .where(
      and(
        eq(dailyContributorAddress.pool_address, poolAddress),
        gte(dailyContributorAddress.date, sql`${date}::timestamp - ${days} * interval '1 day'`),
        lte(dailyContributorAddress.date, sql`${date}`)
      )
    )
    .groupBy(dailyContributorAddress.date)
    .orderBy(dailyContributorAddress.date)
    .execute();
}

export async function getPoolWorkerStats(poolVaultAddress: string, date: Date, days = 30) {
  'use cache';
  cacheLife('days');

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
        eq(dailyPredictorAddress.reward_address, poolVaultAddress),
        gte(dailyPredictorAddress.date, sql`${date}::timestamp - ${days} * interval '1 day'`),
        lte(dailyPredictorAddress.date, sql`${date}`),
      )
    )
    .groupBy(dailyPredictorAddress.date)
    .orderBy(dailyPredictorAddress.date)
    .execute();
}

export async function getDailyWorkerCounts() {
  'use cache';
  cacheLife('days');

  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_address_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      diff_from_previous_day: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) - lag(count(distinct ${dailyPredictorAddress.worker_address})) over (order by ${dailyPredictorAddress.date})`,
    })
    .from(dailyPredictorAddress)
    .where(sql`${dailyPredictorAddress.date} >= current_date - interval '1 day' * 25`)
    .groupBy(dailyPredictorAddress.date)
    .orderBy(desc(dailyPredictorAddress.date))
    .execute()
}

