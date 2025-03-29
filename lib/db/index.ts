import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import * as schema from "./schema";
import { desc, sql, eq, and, gte, gt, lte, or } from "drizzle-orm";
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

export async function getWorkerRewardAverage(date: Date) {
  "use cache";
  cacheLife("default");

  const res = await db
    .select({
      reward_avg: sql<number>`avg(${dailyPredictorAddress.reward})`,
    })
    .from(dailyPredictorAddress)
    .where(sql`${dailyPredictorAddress.date} = ${date}`)
    .execute();

  return res[0] || null;
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
      max_delegated_stake: sql<number>`MAX(${dailyPredictorAddress.delegated_stake})`.as('max_delegated_stake'),
      total_reward: sql<number>`SUM(${dailyPredictorAddress.reward})`.as(
        "total_reward"
      ),
      total_miner_earned:
        sql<number>`SUM(${dailyPredictorAddress.miner_earned})`.as(
          "total_miner_earned"
        ),
      total_delegated_stake:
        sql<number>`SUM(${dailyPredictorAddress.delegated_stake})`.as(
          "total_delegated_stake"
        ),
      total_balance:
        sql<number>`SUM(${dailyPredictorAddress.balance})`.as(
          "total_balance"
        ),
      pool_balance: sql<number>`
        SUM(
          CASE
            WHEN ${dailyPredictorAddress.reward_address} = ${dailyPredictorAddress.worker_address}
            OR ${dailyPredictorAddress.reward_address} = ${dailyPredictorAddress.worker_vault_address}
            THEN ${dailyPredictorAddress.balance}
            ELSE 0
          END
        )`.as("pool_balance"),
    })
    .from(dailyPredictorAddress)
    .where(and(
      // ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_address),
      // or(
      //   isNull(dailyPredictorAddress.worker_vault_address),
      //   ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_vault_address),
      // ),
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
      max_delegated_stake: sql<number>`MAX(${predictorAgg.max_delegated_stake})`,
      contributor_count: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor})`,
      pools_own_staking_power: sql<number>`AVG(${dailyContributorAddress.pools_own_staking_power})`,
      pool_balance: sql<number>`${predictorAgg.pool_balance}`,
      contributor_count_with_staking_power: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor}) FILTER (WHERE ${dailyContributorAddress.staking_power_contribution} > 0)`,
      earnings_per_staking_power: sql<number>`COALESCE(
            (${predictorAgg.total_reward} - ${predictorAgg.total_miner_earned}) /
            -- NULLIF(SUM(${dailyContributorAddress.staking_power_contribution}), 0),
            NULLIF(${predictorAgg.total_delegated_stake}, 0),
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
      predictorAgg.total_miner_earned,
      predictorAgg.total_delegated_stake,
      predictorAgg.pool_balance,
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

export type PoolVSWorkerData = {
  date: Date;
  rewardAvg: number;
  poolRewardPerFullStake: number;
  pool_earnings: number;
  self_earnings: number;
  newRewards: number;
  newPoolEarnings: number;
  poolAmount: number;
  selfAmount: number;
  difference: number;
  stake: number;
  avgFee: number;
};

export async function getPoolVsWorkerComparison(
  poolAddress: string,
  poolVaultAddress: string,
  date: Date,
  days: number = 30,
  startingAmount: number = 0,
  staking_fees_percent: number[] = []
): Promise<PoolVSWorkerData[]> {
  "use cache";
  cacheLife("default");

  const poolData = await getPoolHistoricalData(poolAddress, poolVaultAddress, date, days);

  let selfAmount = startingAmount; // Track self-managed compounded value
  let selfEarnings = 0; // Track total self-managed earnings
  let poolAmount = startingAmount; // Track pool compounded value
  let poolEarnings = 0; // Track only earnings in pool

  const result: PoolVSWorkerData[] = [];

  const avgFee = staking_fees_percent.length
    ? staking_fees_percent.reduce((a, b) => a + b, 0) / staking_fees_percent.length
    : 0;

  for (const entry of poolData) {
    const dailyDate = new Date(entry.date);
    const workerRewardData = await getWorkerRewardAverage(dailyDate);
    if (!workerRewardData) {
      throw new Error(`Failed to fetch worker reward data for date ${dailyDate}.`);
    }
    const stake = entry.max_delegated_stake;
    const rewardAvg = workerRewardData.reward_avg;

    const grossPoolEarnings = entry.earnings_per_staking_power * poolAmount;
    const newPoolEarnings = grossPoolEarnings * (1 - avgFee);
    poolAmount += newPoolEarnings;
    poolEarnings += newPoolEarnings;

    const newRewards = Math.floor(selfAmount / stake) * rewardAvg;
    selfAmount += newRewards;
    selfEarnings += newRewards;

    const difference = poolEarnings - selfEarnings;

    result.push({
      date: dailyDate,
      avgFee,
      stake,
      rewardAvg,
      poolRewardPerFullStake: (entry.earnings_per_staking_power * stake) * (1 - avgFee),
      pool_earnings: poolEarnings,
      self_earnings: selfEarnings,
      newRewards,
      newPoolEarnings,
      poolAmount,
      selfAmount,
      difference,
    });
  }

  return result;
}
