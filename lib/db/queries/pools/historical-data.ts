import { sql, and, or, eq, gte, lte } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress, dailyContributorAddress } from "../../schema";
import { KNOWN_POOLS } from "@/lib/known_pools";
import { getPoolFeesForDate } from "@/lib/pool-utils";

export async function getPoolHistoricalData(
  pool_address: string,
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("max");

  const pool = KNOWN_POOLS.find(
    (pool) => pool.address === pool_address
  );

  const fees = pool ? getPoolFeesForDate(pool, date) : null;
  const workerGivenPercent = fees?.workerGivenPercent ?? 0;

  // Subquery: Pre-aggregate daily_predictor_address with explicit aliases
  const predictorAgg = db
    .select({
      date: dailyPredictorAddress.date,
      max_delegated_stake:
        sql<number>`MAX(${dailyPredictorAddress.delegated_stake})`.as(
          "max_delegated_stake"
        ),
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
      total_balance: sql<number>`SUM(${dailyPredictorAddress.balance})`.as(
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
    .where(
      and(
        // ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_address),
        // or(
        //   isNull(dailyPredictorAddress.worker_vault_address),
        //   ne(dailyPredictorAddress.reward_address, dailyPredictorAddress.worker_vault_address),
        // ),
        or(
          eq(dailyPredictorAddress.reward_address, pool_address),
            pool?.vault_address ? eq(dailyPredictorAddress.reward_address, pool.vault_address) : undefined,
        )
      )
    )
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
            ((${predictorAgg.total_reward} - ${predictorAgg.total_miner_earned}) * (1 - ${sql`${workerGivenPercent}::double precision`})) /
            -- NULLIF(SUM(${dailyContributorAddress.staking_power_contribution}), 0),
            NULLIF(SUM(${dailyContributorAddress.staking_power_contribution}) + AVG(COALESCE(${dailyContributorAddress.pools_own_staking_power}, 0)), 0),
            -- NULLIF(${predictorAgg.total_delegated_stake}, 0),
          0)`,
    })
    .from(dailyContributorAddress)
    .leftJoin(predictorAgg, eq(dailyContributorAddress.date, predictorAgg.date))
    .where(
      and(
        eq(dailyContributorAddress.pool_address, pool_address),
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
      predictorAgg.pool_balance
    )
    .orderBy(dailyContributorAddress.date);

  // Log Raw Query for Debugging
  // const sqlQuery = query.toSQL();
  // console.log("raw query", interpolateQuery(sqlQuery.sql, sqlQuery.params));

  return query.execute();
}
