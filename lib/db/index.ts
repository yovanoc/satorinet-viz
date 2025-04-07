import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import * as schema from "./schema";
import { desc, sql, eq, and, gte, gt, lte, or } from "drizzle-orm";
import { dailyContributorAddress, dailyPredictorAddress } from "./schema";
import { unstable_cacheLife as cacheLife } from "next/cache";
import type { Pool } from "../known_pools";
import { getSatoriPriceForDate } from "../livecoinwatch";
import { applyFee, getAvgFee } from "../pool-utils";

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
          eq(dailyPredictorAddress.reward_address, poolAddress),
          eq(dailyPredictorAddress.reward_address, poolVaultAddress)
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
            (${predictorAgg.total_reward} - ${predictorAgg.total_miner_earned}) /
            -- NULLIF(SUM(${dailyContributorAddress.staking_power_contribution}), 0),
            NULLIF(SUM(${dailyContributorAddress.staking_power_contribution}) + AVG(COALESCE(${dailyContributorAddress.pools_own_staking_power}, 0)), 0),
            -- NULLIF(${predictorAgg.total_delegated_stake}, 0),
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
      predictorAgg.pool_balance
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
  pools: Pool[], // Array of pool address and vault address pairs
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("default");

  // TODO use a proper query

  return Promise.all(
    pools.map(async (pool) => ({
      pool,
      data: pool.vault_address
        ? await getPoolHistoricalData(
            pool.address,
            pool.vault_address,
            date,
            days
          )
        : null,
    }))
  );
}

type PoolEarningsData = {
  pool: Pool;
  total_earnings: number;
  full_stake_earnings: number;
  daily_earnings: number;
  current_amount: number;
  avg_fee: number;
};

type SelfWorkerRewardsData = {
  reward_avg: number;
  daily_rewards: number;
  total_rewards: number;
  current_amount: number;
};

export type PoolsVSWorkerData = {
  date: Date;
  stake: number;
  price: number;
  worker: SelfWorkerRewardsData;
  pools: Record<string, PoolEarningsData>;
};

export async function getPoolVsWorkerComparison(
  pools: Pool[],
  date: Date,
  days: number = 30,
  startingAmount: number = 0
): Promise<PoolsVSWorkerData[]> {
  "use cache";
  cacheLife("default");

  if (pools.some((pool) => !pool.vault_address)) {
    console.error("Pool vault address is not defined.");
    return [];
  }

  const poolsData = await Promise.all(
    pools.map(async (pool) => ({
      pool,
      data: await getPoolHistoricalData(
        pool.address,
        pool.vault_address!,
        date,
        days
      ),
    }))
  );

  if (!poolsData.length) {
    console.error("No data found for the given date and days.");
    return [];
  }

  // check if they have the same length
  const poolData = poolsData[0]!;
  if (poolData.data.length === 0) {
    console.error("No data found for the given date and days.");
    return [];
  }

  const dates = new Array<Date>();

  // Check if all pools have the same length, and same dates at the same places, that dates are one day apart each time, then populate the dates array
  for (let i = 0; i < poolData.data.length; i++) {
    const entry = poolData.data[i]!;
    const currentDate = new Date(entry.date);
    if (i === 0) {
      dates.push(currentDate);
    } else {
      const lastDate = dates[dates.length - 1]!;
      if (currentDate.getTime() !== lastDate.getTime() + 86400000) {
        console.error("Dates are not one day apart.");
        return [];
      }

      // check every pool has the same date
      for (const poolData of poolsData) {
        const poolEntry = poolData.data[i]!;
        if (poolEntry.date !== entry.date) {
          console.error("Dates are not the same for all pools.");
          return [];
        }
      }

      dates.push(currentDate);
    }
  }

  let selfAmount = startingAmount; // Track self-managed compounded value
  let selfEarnings = 0; // Track total self-managed earnings

  const poolsTracking = pools.reduce(
    (acc, pool) => {
      acc[pool.address] = {
        current_amount: startingAmount, // Track pool compounded value
        total_earnings: 0, // Track only earnings in pool
      };
      return acc;
    },
    {} as Record<
      string,
      {
        current_amount: number;
        total_earnings: number;
      }
    >
  );

  const result: PoolsVSWorkerData[] = [];

  for (const dailyDate of dates) {
    const [workerRewardData, price] = await Promise.all([
      getWorkerRewardAverage(dailyDate),
      getSatoriPriceForDate(dailyDate),
    ]);
    if (!workerRewardData) {
      throw new Error(
        `Failed to fetch worker reward data for date ${dailyDate}.`
      );
    }

    const firstPoolEntry = poolsData[0]!.data.find(
      (entry) => new Date(entry.date).getTime() === dailyDate.getTime()
    );

    if (!firstPoolEntry) {
      console.error(
        `No data found for pool ${pools[0]!.address} on date ${dailyDate}`
      );
      continue;
    }

    const stake = firstPoolEntry.max_delegated_stake;
    const rewardAvg = workerRewardData.reward_avg;
    const newRewards = Math.floor(selfAmount / stake) * rewardAvg;
    selfAmount += newRewards;
    selfEarnings += newRewards;

    const data: PoolsVSWorkerData = {
      date: dailyDate,
      price,
      stake,
      pools: {},
      worker: {
        reward_avg: rewardAvg,
        daily_rewards: newRewards,
        total_rewards: selfEarnings,
        current_amount: selfAmount,
      },
    };

    for (const pool of pools) {
      const entry = poolsData
        .find((p) => p.pool.address === pool.address)!
        .data.find(
          (entry) => new Date(entry.date).getTime() === dailyDate.getTime()
        );
      if (!entry) {
        console.error(
          `No data found for pool ${pool.address} on date ${dailyDate}`
        );
        continue;
      }

      if (entry.max_delegated_stake !== stake) {
        console.error(
          `Stake mismatch for pool ${pool.address} on date ${dailyDate}`
        );
        continue;
      }

      const avgFee = getAvgFee(pool, dailyDate);

      const poolTracking = poolsTracking[pool.address];
      if (!poolTracking) {
        console.error(`No tracking data found for pool ${pool.address}`);
        continue;
      }

      const grossPoolEarnings =
        entry.earnings_per_staking_power * poolTracking.current_amount;
      const newPoolEarnings = applyFee(grossPoolEarnings, avgFee);
      poolTracking.current_amount += newPoolEarnings;
      poolTracking.total_earnings += newPoolEarnings;

      data.pools[pool.address] = {
        pool,
        total_earnings: poolTracking.total_earnings,
        full_stake_earnings:
        applyFee(entry.earnings_per_staking_power * stake, avgFee),
        daily_earnings: newPoolEarnings,
        current_amount: poolTracking.current_amount,
        avg_fee: avgFee,
      };
    }

    result.push(data);
  }

  // console.dir(result, { depth: 10 });

  return result;
}
