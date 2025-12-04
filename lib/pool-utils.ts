import { KNOWN_POOLS, type Pool } from "./known_pools";

export function getPoolFeesForDate(pool: Pool, date: Date) {
  if (!pool.staking_fees) return null;
  let fees = pool.staking_fees.find((fee) => {
    if (fee.until === null) return true;
    return fee.until >= date;
  });

  if (fees?.fees && pool.temporary_fee_reductions) {
    const reductions = pool.temporary_fee_reductions.filter(
      (reduction) => reduction.from <= date && reduction.until >= date
    );
    if (reductions.length > 0) {
      // TODO we handle temporary fee reductions only for percent fees for now
      if (fees.fees.type === "percent") {
        const totalReduction = reductions.reduce(
          (acc, reduction) => acc + reduction.percent,
          0
        );
        if (Array.isArray(fees.fees.percent)) {
          fees = {
            ...fees,
            fees: {
              ...fees.fees,
              percent: fees.fees.percent.map((p) =>
                Math.max(0, p - totalReduction)
              ),
            },
          };
        } else {
          fees = {
            ...fees,
            fees: {
              ...fees.fees,
              percent: Math.max(0, fees.fees.percent - totalReduction),
            },
          };
        }
      }
    }
  }

  return fees ?? null;
}

export type FeeResult = {
  feePercent: number;
  feeAmountPerSatori: number;
  net: number;
  netPerFullStake: number;
};

export type AppliedFees =
  | {
      type: "not_found";
      result: FeeResult;
    }
  | {
      type: "single";
      result: FeeResult;
    }
  | {
      type: "multiple";
      results: FeeResult[];
    };

export function applyFees({
  poolAddress,
  date,
  earnings_per_staking_power,
  current_staked_amount,
  satoriPrice,
  fullStakeAmount,
}: {
  poolAddress: string;
  date: Date;
  earnings_per_staking_power: number;
  current_staked_amount: number;
  satoriPrice: number;
  fullStakeAmount: number;
}): AppliedFees {
  const net = earnings_per_staking_power * current_staked_amount;
  const netPerFullStake = earnings_per_staking_power * fullStakeAmount;

  const pool = KNOWN_POOLS.find((pool) => pool.address === poolAddress);

  if (!pool) {
    return {
      type: "not_found",
      result: {
        feePercent: 0,
        feeAmountPerSatori: 0,
        net,
        netPerFullStake,
      },
    }
  }

  const fees = getPoolFeesForDate(pool, date);

  if (!fees?.fees) {
    return {
      type: "not_found",
      result: {
        feePercent: 0,
        feeAmountPerSatori: 0,
        net,
        netPerFullStake,
      },
    };
  }

  switch (fees.fees.type) {
    case "percent": {
      if (Array.isArray(fees.fees.percent)) {
        return {
          type: "multiple",
          results: fees.fees.percent.map((feePercent) => {
            if (fees.maxPercent) {
              feePercent = Math.min(feePercent, fees.maxPercent);
            }
            return {
              feePercent,
              feeAmountPerSatori:
                (earnings_per_staking_power * feePercent) / satoriPrice,
              net: applyFeePercent(net, feePercent),
              netPerFullStake: applyFeePercent(netPerFullStake, feePercent),
            };
          }),
        };
      }
      let feePercent = fees.fees.percent;
      if (fees.maxPercent) {
        feePercent = Math.min(feePercent, fees.maxPercent);
      }

      return {
        type: "single",
        result: {
          feePercent,
          feeAmountPerSatori:
            (earnings_per_staking_power * feePercent) / satoriPrice,
          net: applyFeePercent(net, feePercent),
          netPerFullStake: applyFeePercent(netPerFullStake, feePercent),
        },
      };
    }
    case "cost": {
      let feeForFullStakeInSatori: number;

      if (fees.fees.amount_type === "satori") {
        if (fees.fees.per === "full_stake") {
          feeForFullStakeInSatori = fees.fees.amount;
        } else {
          // per N satori
          feeForFullStakeInSatori =
            (fees.fees.amount / fees.fees.per) * fullStakeAmount;
        }
      } else {
        // fees in USD
        if (fees.fees.per === "full_stake") {
          feeForFullStakeInSatori = fees.fees.amount / satoriPrice;
        } else {
          feeForFullStakeInSatori =
            ((fees.fees.amount / fees.fees.per) * fullStakeAmount) /
            satoriPrice;
        }
      }

      const feeForCurrentStakeInSatori =
        (current_staked_amount / fullStakeAmount) * feeForFullStakeInSatori;

      let feePercent = feeForCurrentStakeInSatori / net;
      if (fees.maxPercent !== undefined) {
        feePercent = Math.min(feePercent, fees.maxPercent);
      }

      return {
        type: "single",
        result: {
          feePercent,
          feeAmountPerSatori:
            (earnings_per_staking_power * feePercent) / satoriPrice,
          net: applyFeePercent(net, feePercent),
          netPerFullStake: applyFeePercent(netPerFullStake, feePercent),
        },
      };
    }
  }
}

export function getFeeRange(
  pool: Pool,
  date: Date,
  earnings_per_staking_power: number,
  satoriPrice: number,
  fullStakeAmount: number
): { min: number; max: number } {
  const fees = getPoolFeesForDate(pool, date);

  if (!fees) return { min: 0, max: 0 };

  const res = applyFees({
    poolAddress: pool.address,
    date,
    earnings_per_staking_power,
    current_staked_amount: 1,
    satoriPrice,
    fullStakeAmount,
  });

  if (res.type === "single" || res.type === "not_found") {
    return {
      min: res.result.feePercent,
      max: res.result.feePercent,
    };
  }

  return {
    min: Math.min(...res.results.map((r) => r.feePercent)),
    max: Math.max(...res.results.map((r) => r.feePercent)),
  };
}

export function applyFeePercent(num: number, fee: number): number {
  return num * (1 - fee);
}

export function getActiveTemporaryReductions(pool: Pool, date: Date) {
  if (!pool.temporary_fee_reductions) return [];
  return pool.temporary_fee_reductions.filter(
    (reduction) => reduction.from <= date && reduction.until >= date
  );
}
