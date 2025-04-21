import { unstable_cacheLife as cacheLife } from "next/cache";
import type { Pool } from "@/lib/known_pools";
import { getPoolHistoricalData } from "./historical-data";
import { getSatoriPriceForDate } from "@/lib/livecoinwatch";
import { applyFees } from "@/lib/pool-utils";
import { getWorkerRewardAverage } from "../predictors/worker-reward-avg";

type PoolEarningsData = {
  pool: Pool;
  total_earnings: number;
  full_stake_earnings: number;
  daily_earnings: number;
  current_amount: number;
  feePercent: number;
  feeAmountPerSatori: number;
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
  cacheLife("max");

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
        const poolEntry = poolData.data[i];
        if (poolEntry && poolEntry.date !== entry.date) {
          console.error(
            `Dates are not the same for all pools. Pool: ${poolData.pool.name} - Date: ${poolEntry.date} - Expected: ${entry.date}`
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
      if (pool.closed && pool.closed <= dailyDate) {
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

      const res = applyFees({
        pool,
        date: dailyDate,
        fullStakeAmount: stake,
        earnings_per_staking_power: entry.earnings_per_staking_power,
        current_staked_amount: poolTracking.current_amount,
        satoriPrice: price,
      });

      if (!res) {
        console.error(`No fee data found for pool ${pool.address}`);
        continue;
      }

      if (res.type === "single") {
        const { net, netPerFullStake, feeAmountPerSatori, feePercent } =
          res.result;

        const newPoolEarnings = net;
        poolTracking.current_amount += newPoolEarnings;
        poolTracking.total_earnings += newPoolEarnings;

        data.pools[pool.address] = {
          pool,
          total_earnings: poolTracking.total_earnings,
          full_stake_earnings: netPerFullStake,
          daily_earnings: newPoolEarnings,
          current_amount: poolTracking.current_amount,
          feePercent,
          feeAmountPerSatori,
        };
      } else {
        const { net, netPerFullStake, feeAmountPerSatori, feePercent } =
          res.results.reduce(
            (acc, r) => {
              acc.net += r.net;
              acc.netPerFullStake += r.netPerFullStake;
              acc.feeAmountPerSatori += r.feeAmountPerSatori;
              acc.feePercent += r.feePercent;
              return acc;
            },
            { net: 0, netPerFullStake: 0, feeAmountPerSatori: 0, feePercent: 0 }
          );

        const newPoolEarnings = net / res.results.length;
        poolTracking.current_amount += newPoolEarnings;
        poolTracking.total_earnings += newPoolEarnings;

        data.pools[pool.address] = {
          pool,
          total_earnings: poolTracking.total_earnings,
          full_stake_earnings: netPerFullStake / res.results.length,
          daily_earnings: newPoolEarnings,
          current_amount: poolTracking.current_amount,
          feePercent: feePercent / res.results.length,
          feeAmountPerSatori: feeAmountPerSatori / res.results.length,
        };
      }
    }

    result.push(data);
  }

  // console.dir(result, { depth: 10 });

  return result;
}
