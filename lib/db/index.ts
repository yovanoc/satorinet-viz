import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import * as schema from "./schema";
import { desc, sql, eq, and, gte, gt, lte, or, ne, isNull } from "drizzle-orm";
import { dailyContributorAddress, dailyPredictorAddress } from "./schema";
import { unstable_cacheLife as cacheLife } from "next/cache";

export const db = drizzle(env.DATABASE_URL, {
  schema,
});

export async function getTopPools(date: Date) {
  "use cache";
  cacheLife("default");

  return db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = ${date}`)
    .groupBy(dailyContributorAddress.pool_address)
    .orderBy(
      desc(sql`sum(${dailyContributorAddress.staking_power_contribution})`)
    )
    .limit(20)
    .execute();
}

export async function getPoolHistoricalData(
  poolAddress: string,
  poolVaultAddress: string,
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("default");

  // Subquery: Pre-aggregate daily_predictor_address with explicit aliases
  const predictorAgg = db
    .select({
      date: dailyPredictorAddress.date,
      total_reward: sql<number>`SUM(${dailyPredictorAddress.reward})`.as(
        "total_reward"
      ),
      total_miner_earned:
        sql<number>`SUM(${dailyPredictorAddress.miner_earned})`.as(
          "total_miner_earned"
        ),
    })
    .from(dailyPredictorAddress)
    .where(and(
      ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_address),
      or(
        isNull(dailyPredictorAddress.worker_vault_address),
        ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_vault_address),
      ),
      or(
        eq(dailyPredictorAddress.reward_address, poolAddress),
        eq(dailyPredictorAddress.reward_address, poolVaultAddress)
      ),
    ))
    .groupBy(dailyPredictorAddress.date)
    .as("predictor_agg");

  // Main Query
  const query = db
    .select({
      date: dailyContributorAddress.date,
      total_staking_power: sql<number>`SUM(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor})`,
      contributor_count_with_staking_power: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor}) FILTER (WHERE ${dailyContributorAddress.staking_power_contribution} > 0)`,
      earnings_per_staking_power: sql<number>`COALESCE(
            (${predictorAgg.total_reward} - ${predictorAgg.total_miner_earned}) /
            NULLIF(SUM(${dailyContributorAddress.staking_power_contribution}), 0),
          0)`,
    })
    .from(dailyContributorAddress)
    .leftJoin(predictorAgg, eq(dailyContributorAddress.date, predictorAgg.date))
    .where(
      and(
        eq(dailyContributorAddress.pool_address, poolAddress),
        gte(
          dailyContributorAddress.date,
          sql`${date}::timestamp - ${days} * interval '1 day'`
        ),
        lte(dailyContributorAddress.date, sql`${date}`)
      )
    )
    .groupBy(
      dailyContributorAddress.date,
      predictorAgg.total_reward,
      predictorAgg.total_miner_earned
    )
    .orderBy(dailyContributorAddress.date);

  // Log Raw Query for Debugging
  // const sqlQuery = query.toSQL();
  // console.log("raw query", interpolateQuery(sqlQuery.sql, sqlQuery.params));

  return query.execute();
}

export async function getPoolWorkerStats(
  poolAddress: string,
  poolVaultAddress: string,
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("default");

  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      worker_count_with_earnings: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) filter (where ${dailyPredictorAddress.miner_earned} > 0)`,
      total_reward: sql<number>`sum(${dailyPredictorAddress.reward})`,
      total_miner_earned: sql<number>`sum(${dailyPredictorAddress.miner_earned})`,
      avg_score: sql<number>`avg(${dailyPredictorAddress.score}) filter (where ${dailyPredictorAddress.score} > 0)`,
      pool_miner_percent: sql<number>`avg(${dailyPredictorAddress.pool_miner_percent}) filter (where ${dailyPredictorAddress.miner_earned} > 0)`,
    })
    .from(dailyPredictorAddress)
    .where(
      and(
        ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_address),
        or(
          isNull(dailyPredictorAddress.worker_vault_address),
          ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_vault_address),
        ),
        or(
          eq(dailyPredictorAddress.reward_address, poolAddress),
          eq(dailyPredictorAddress.reward_address, poolVaultAddress)
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

export async function getDailyWorkerCounts() {
  "use cache";
  cacheLife("default");

  return db
    .select({
      date: dailyPredictorAddress.date,
      worker_address_count: sql<number>`count(distinct ${dailyPredictorAddress.worker_address})`,
      diff_from_previous_day: sql<number>`count(distinct ${dailyPredictorAddress.worker_address}) - lag(count(distinct ${dailyPredictorAddress.worker_address})) over (order by ${dailyPredictorAddress.date})`,
    })
    .from(dailyPredictorAddress)
    .where(
      sql`${dailyPredictorAddress.date} >= current_date - interval '1 day' * 25`
    )
    .groupBy(dailyPredictorAddress.date)
    .orderBy(desc(dailyPredictorAddress.date))
    .execute();
}

export async function getDailyMiningEarnings(date: Date) {
  "use cache";
  cacheLife("default");

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

export async function getPoolsHistoricalEarnings(
  pools: { address: string; vault_address: string }[], // Array of pool address and vault address pairs
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("default");

  // TODO use a proper query

  return Promise.all(
    pools.map(async (pool) =>
    ({
      pool_address: pool.address,
      data: await getPoolHistoricalData(pool.address, pool.vault_address, date, days)
    })
    )
  );
}
