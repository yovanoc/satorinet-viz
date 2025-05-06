import { unstable_cacheLife as cacheLife } from "next/cache";
import { KNOWN_POOLS, type Pool, type TopPool } from "@/lib/known_pools";
import { getPoolHistoricalData } from "./historical-data";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { applyFees, FeeResult, type AppliedFees } from "@/lib/pool-utils";
import { getWorkerRewardAverage } from "../predictors/worker-reward-avg";

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
  min: EarningsData;
  max?: EarningsData;
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
        const poolEntry = poolData.data[i];
        if (poolEntry && poolEntry.date !== entry.date) {
          console.error(
            `Dates are not the same for all pools. Pool: ${poolData.pool.address} - Date: ${poolEntry.date} - Expected: ${entry.date}`
          );
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
      throw new Error(
        `Failed to fetch worker reward data for date ${dailyDate}.`
      );
    }

    const firstPoolEntry = poolsData[0]!.data.find(
      (entry) => new Date(entry.date).getTime() === dailyDate.getTime()
    );

    if (!firstPoolEntry) {
      console.error(
        `No data found for pool ${pools[0]?.address} on date ${dailyDate}`
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
      const knownPool = KNOWN_POOLS.find((p) => p.address === pool.address);

      if (knownPool && knownPool.closed && knownPool.closed <= dailyDate) {
        // console.warn(
        //   `Pool ${pool.name} is closed on date ${dailyDate}. Skipping...`
        // );
        continue;
      }

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
