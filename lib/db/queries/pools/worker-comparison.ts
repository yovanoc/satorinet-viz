import { cacheLife } from "next/cache";
import { KNOWN_POOLS, type Pool, type TopPool } from "@/lib/known_pools";
import { getPoolHistoricalData } from "./historical-data";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { applyFees, FeeResult, type AppliedFees } from "@/lib/pool-utils";
import { getWorkerRewardAverage } from "../predictors/worker-reward-avg";
import { generateDateRangeBackwards, isSameUTCDate } from "@/lib/date";
import { env } from "@/lib/env";

/**
 * Validate data coverage across pools for the given date range
 */
function validateDataCoverage(
  poolsData: Array<{ pool: TopPool; data: Array<{ date: string }> }>,
  dateRange: Date[]
): { missingDatesCount: number; poolsCoverage: Record<string, number> } {
  const poolsCoverage: Record<string, number> = {};
  let totalMissingDates = 0;

  for (const { pool, data } of poolsData) {
    const dataDateSet = new Set(
      data.map((entry) => new Date(entry.date).toISOString().split("T")[0])
    );

    let missingForPool = 0;
    for (const date of dateRange) {
      const dateString = date.toISOString().split("T")[0];
      if (!dataDateSet.has(dateString)) {
        missingForPool++;
      }
    }

    poolsCoverage[pool.address] = missingForPool;
    totalMissingDates = Math.max(totalMissingDates, missingForPool);
  }

  return {
    missingDatesCount: totalMissingDates,
    poolsCoverage,
  };
}

/**
 * Find pool data for a specific date, returning null if not found
 * Uses normalized date comparison for better matching
 */
function findPoolDataForDate(
  poolData: Array<{
    date: string;
    max_delegated_stake: number;
    earnings_per_staking_power: number;
    avg_distance: number;
  }>,
  targetDate: Date
): {
  date: string;
  max_delegated_stake: number;
  earnings_per_staking_power: number;
  avg_distance: number;
} | null {
  return (
    poolData.find((entry) => isSameUTCDate(new Date(entry.date), targetDate)) ??
    null
  );
}

/**
 * Get stake information for a date, with fallback strategies
 */
function getStakeForDate(
  poolsData: Array<{
    pool: TopPool;
    data: Array<{
      date: string;
      max_delegated_stake: number;
      earnings_per_staking_power: number;
      avg_distance: number;
    }>;
  }>,
  targetDate: Date
): { stake: number; source: "exact" | "fallback" | "none" } {
  // First, try to find exact data for this date
  for (const poolData of poolsData) {
    const entry = findPoolDataForDate(poolData.data, targetDate);
    if (entry && entry.max_delegated_stake > 0) {
      return { stake: entry.max_delegated_stake, source: "exact" };
    }
  }

  // Fallback: find the closest date with data (within 7 days)
  const maxFallbackDays = 7;
  for (let dayOffset = 1; dayOffset <= maxFallbackDays; dayOffset++) {
    // Check both before and after the target date
    for (const direction of [-1, 1]) {
      const fallbackDate = new Date(targetDate);
      fallbackDate.setUTCDate(
        fallbackDate.getUTCDate() + dayOffset * direction
      );

      for (const poolData of poolsData) {
        const entry = findPoolDataForDate(poolData.data, fallbackDate);
        if (entry && entry.max_delegated_stake > 0) {
          console.warn(
            `Using fallback stake data from ${
              fallbackDate.toISOString().split("T")[0]
            } for ${targetDate.toISOString().split("T")[0]}`
          );
          return { stake: entry.max_delegated_stake, source: "fallback" };
        }
      }
    }
  }

  return { stake: 0, source: "none" };
}

type EarningsData = {
  total_earnings: number;
  full_stake_earnings: number;
  daily_earnings: number;
  current_amount: number;
  feePercent: number;
  feeAmountPerSatori: number;
};

type PoolEarningsData = {
  poolAddress: string;
  pool?: Pool;
  avg_distance: number;
  min: EarningsData;
  max?: EarningsData;
};

type SelfWorkerRewardsData = {
  reward_avg: number;
  daily_rewards: number;
  total_rewards: number;
  current_amount: number;
  avg_distance: number;
};

export type PoolsVSWorkerData = {
  date: Date;
  stake: number;
  price: number;
  worker: SelfWorkerRewardsData;
  pools: Record<string, PoolEarningsData>;
};

export async function getPoolVsWorkerComparison(
  pools: TopPool[],
  date: Date,
  days: number = 30,
  startingAmount: number = 0
): Promise<PoolsVSWorkerData[]> {
  "use cache";
  cacheLife("max");

  const poolsData = await Promise.all(
    pools.map(async (pool) => ({
      pool,
      data: await getPoolHistoricalData(pool, date, days),
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

  // Create a complete date range based on the requested parameters
  const dates = generateDateRangeBackwards(date, days);

  // Validate that we have sufficient data coverage
  const dataCoverage = validateDataCoverage(poolsData, dates);
  if (dataCoverage.missingDatesCount > days * 0.5) {
    console.warn(
      `High amount of missing data: ${dataCoverage.missingDatesCount}/${days} days missing. Consider using a different date range.`
    );
  }

  // Log data coverage per pool for debugging
  if (env.NODE_ENV === "development") {
    console.log("Data coverage by pool:", {
      totalDays: days,
      coverage: Object.entries(dataCoverage.poolsCoverage).map(
        ([address, missing]) => ({
          pool: address.slice(0, 8) + "...", // Truncate for readability
          missingDays: missing,
          coveragePercent: Math.round(((days - missing) / days) * 100),
        })
      ),
    });
  }

  let selfAmount = startingAmount; // Track self-managed compounded value
  let selfEarnings = 0; // Track total self-managed earnings

  const poolsTracking = pools.reduce(
    (acc, pool) => {
      acc[pool.address] = {
        min: {
          current_amount: startingAmount, // Track pool compounded value
          total_earnings: 0, // Track only earnings in pool
        },
      };
      return acc;
    },
    {} as Record<
      string,
      {
        min: {
          current_amount: number;
          total_earnings: number;
        };
        max?: {
          current_amount: number;
          total_earnings: number;
        };
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
      console.warn(
        `No worker reward data for date ${dailyDate.toDateString()}. Skipping this date.`
      );
      continue;
    }

    // Get stake information with fallback strategies
    const stakeInfo = getStakeForDate(poolsData, dailyDate);

    if (stakeInfo.source === "none") {
      console.warn(
        `No stake data found for date ${dailyDate.toDateString()} even with fallbacks. Skipping this date.`
      );
      continue;
    }

    const stake = stakeInfo.stake;
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
        avg_distance: workerRewardData.avg_distance,
        reward_avg: rewardAvg,
        daily_rewards: newRewards,
        total_rewards: selfEarnings,
        current_amount: selfAmount,
      },
    };

    for (const pool of pools) {
      const knownPool = KNOWN_POOLS.find((p) => p.address === pool.address);

      if (knownPool && knownPool.closed && knownPool.closed <= dailyDate) {
        // console.warn(
        //   `Pool ${pool.name} is closed on date ${dailyDate}. Skipping...`
        // );
        continue;
      }

      const entry = findPoolDataForDate(
        poolsData.find((p) => p.pool.address === pool.address)!.data,
        dailyDate
      );

      if (!entry) {
        console.warn(
          `No data found for pool ${
            pool.address
          } on date ${dailyDate.toDateString()}. Skipping this pool for this date.`
        );
        continue;
      }

      // ! it could be that in this pool everyone has a balance and not the full stake was delegated
      // if (entry.max_delegated_stake !== stake) {
      //   console.error(
      //     `Stake mismatch for pool ${pool.name} on date ${dailyDate.toLocaleString()} - Expected: ${stake}, Found: ${entry.max_delegated_stake}`
      //   );
      //   continue;
      // }

      const poolTracking = poolsTracking[pool.address];
      if (!poolTracking) {
        console.error(`No tracking data found for pool ${pool.address}`);
        continue;
      }

      const appliedFees = new Array<AppliedFees>();

      const res = applyFees({
        poolAddress: pool.address,
        date: dailyDate,
        fullStakeAmount: stake,
        earnings_per_staking_power: entry.earnings_per_staking_power,
        current_staked_amount: poolTracking.min.current_amount,
        satoriPrice: price,
      });

      appliedFees.push(res);

      if (poolTracking.max) {
        const res = applyFees({
          poolAddress: pool.address,
          date: dailyDate,
          fullStakeAmount: stake,
          earnings_per_staking_power: entry.earnings_per_staking_power,
          current_staked_amount: poolTracking.max.current_amount,
          satoriPrice: price,
        });

        appliedFees.push(res);
      }

      if (appliedFees.length === 0) {
        console.error(`No fee data found for pool ${pool.address}`);
        continue;
      }

      const feeResults = new Array<FeeResult>();

      for (const res of appliedFees) {
        if (res.type === "single" || res.type === "not_found") {
          feeResults.push(res.result);
        } else {
          feeResults.push(...res.results);
        }
      }

      if (feeResults.length === 1) {
        const res = feeResults[0]!;
        const { net, netPerFullStake, feeAmountPerSatori, feePercent } = res;

        poolTracking.min.current_amount += net;
        poolTracking.min.total_earnings += net;

        data.pools[pool.address] = {
          poolAddress: pool.address,
          pool: knownPool,
          avg_distance: entry.avg_distance,
          min: {
            total_earnings: poolTracking.min.total_earnings,
            full_stake_earnings: netPerFullStake,
            daily_earnings: net,
            current_amount: poolTracking.min.current_amount,
            feePercent,
            feeAmountPerSatori,
          },
        };
      } else {
        const [min, max] = feeResults.reduce(
          (acc, res) => {
            if (res.net < acc[0].net) {
              acc[0] = res;
            }
            if (res.net > acc[1].net) {
              acc[1] = res;
            }
            return acc;
          },
          [feeResults[0]!, feeResults[0]!] as const
        );

        const {
          net: minNet,
          netPerFullStake: minNetPerFullStake,
          feeAmountPerSatori: minFeeAmountPerSatori,
          feePercent: minFeePercent,
        } = min;
        const {
          net: maxNet,
          netPerFullStake: maxNetPerFullStake,
          feeAmountPerSatori: maxFeeAmountPerSatori,
          feePercent: maxFeePercent,
        } = max;

        const maxCurrentAmount =
          poolTracking.max?.current_amount ?? poolTracking.min.current_amount;
        const maxTotalEarnings =
          poolTracking.max?.total_earnings ?? poolTracking.min.total_earnings;

        poolTracking.max = {
          current_amount: maxCurrentAmount + maxNet,
          total_earnings: maxTotalEarnings + maxNet,
        };

        poolTracking.min.current_amount += minNet;
        poolTracking.min.total_earnings += minNet;

        data.pools[pool.address] = {
          poolAddress: pool.address,
          pool: knownPool,
          avg_distance: entry.avg_distance,
          min: {
            total_earnings: poolTracking.min.total_earnings,
            full_stake_earnings: minNetPerFullStake,
            daily_earnings: minNet,
            current_amount: poolTracking.min.current_amount,
            feePercent: minFeePercent,
            feeAmountPerSatori: minFeeAmountPerSatori,
          },
          max: {
            total_earnings: poolTracking.max.total_earnings,
            full_stake_earnings: maxNetPerFullStake,
            daily_earnings: maxNet,
            current_amount: poolTracking.max.current_amount,
            feePercent: maxFeePercent,
            feeAmountPerSatori: maxFeeAmountPerSatori,
          },
        };
      }
    }

    result.push(data);
  }

  // console.dir(result, { depth: 10 });

  return result;
}
