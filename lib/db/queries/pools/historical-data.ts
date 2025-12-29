import { sql, and, or, eq, gte, lte } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress, dailyContributorAddress } from "../../schema";
import { KNOWN_POOLS, type TopPool } from "@/lib/known_pools";
import { getPoolFeesForDate } from "@/lib/pool-utils";
import { getVaultsForWallet } from "@/lib/evr/wallet-vault";

export async function getPoolHistoricalData(
  pool: TopPool,
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("max");

  const knownPool = KNOWN_POOLS.find((p) => p.address === pool.address);

  const fees = knownPool ? getPoolFeesForDate(knownPool, date) : null;
  const workerGivenPercent = fees?.workerGivenPercent ?? 0;

  const vaultAddress =
    pool?.vault_address ??
    knownPool?.vault_address ??
    (await getVaultsForWallet(pool.address))[0]; // ! nearly everyone has a single vault address

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
      avg_distance: sql<number>`AVG(${dailyPredictorAddress.score})`.as(
        "avg_distance"
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
          eq(dailyPredictorAddress.reward_address, pool.address),
          vaultAddress
            ? eq(dailyPredictorAddress.reward_address, vaultAddress)
            : undefined
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
      avg_distance: sql<number>`AVG(${predictorAgg.avg_distance})`,
      contributor_count: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor})`,
      pools_own_staking_power: sql<number>`AVG(${dailyContributorAddress.pools_own_staking_power})`,
      pool_balance: sql<number>`${predictorAgg.pool_balance}`,
      contributor_count_with_staking_power: sql<number>`COUNT(DISTINCT ${dailyContributorAddress.contributor}) FILTER (WHERE ${dailyContributorAddress.staking_power_contribution} > 0)`,
      earnings_per_staking_power: sql<number>`COALESCE(
            ((${predictorAgg.total_reward} - ${
        predictorAgg.total_miner_earned
      }) * (1 - ${sql`${workerGivenPercent}::double precision`})) /
            -- NULLIF(SUM(${
              dailyContributorAddress.staking_power_contribution
            }), 0),
            NULLIF(SUM(${
              dailyContributorAddress.staking_power_contribution
            }) + AVG(COALESCE(${
        dailyContributorAddress.pools_own_staking_power
      }, 0)), 0),
            -- NULLIF(${predictorAgg.total_delegated_stake}, 0),
          0)`,
    })
    .from(dailyContributorAddress)
    .leftJoin(predictorAgg, eq(dailyContributorAddress.date, predictorAgg.date))
    .where(
      and(
        eq(dailyContributorAddress.pool_address, pool.address),
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
