import type { Pool } from "./known_pools";

export function getPoolFeesForDate(pool: Pool, date: Date) {
  if (!pool.staking_fees) return null;
  const fees = pool.staking_fees.find((fee) => {
    if (fee.until === null) return true;
    return new Date(fee.until) >= date;
  });

  return fees ?? null;
}

export type FeeResult = {
  feePercent: number;
  feeAmountPerSatori: number;
  net: number;
  netPerFullStake: number;
};

export function applyFees({
  pool,
  date,
  earnings_per_staking_power,
  current_staked_amount,
  satoriPrice,
  fullStakeAmount,
}: {
  pool: Pool;
  date: Date;
  earnings_per_staking_power: number;
  current_staked_amount: number;
  satoriPrice: number;
  fullStakeAmount: number;
}):
  | {
      type: "single";
      result: FeeResult;
    }
  | {
      type: "multiple";
      results: FeeResult[];
    }
  | null {
  const fees = getPoolFeesForDate(pool, date);
  if (!fees) {
    return null;
  }

  switch (fees.fees.type) {
    case "percent": {
      if (Array.isArray(fees.fees.percent)) {
        return {
          type: "multiple",
          results: fees.fees.percent.map((feePercent) => {
            return {
              feePercent,
              feeAmountPerSatori:
                (earnings_per_staking_power * feePercent) / satoriPrice,
              net: applyFeePercent(earnings_per_staking_power * current_staked_amount, feePercent),
              netPerFullStake: applyFeePercent(
                earnings_per_staking_power * fullStakeAmount,
                feePercent
              ),
            };
          }),
        };
      }
      const feePercent = fees.fees.percent;

      return {
        type: "single",
        result: {
          feePercent,
          feeAmountPerSatori:
            (earnings_per_staking_power * feePercent) / satoriPrice,
          net: applyFeePercent(earnings_per_staking_power * current_staked_amount, feePercent),
          netPerFullStake: applyFeePercent(
            earnings_per_staking_power * fullStakeAmount,
            feePercent
          ),
        },
      };
    }
    case "cost": {
      const earningsForFullStake = earnings_per_staking_power * fullStakeAmount;
      const earningsForCurrentStake = earnings_per_staking_power * current_staked_amount;

      let feeForFullStakeInSatori: number;

      if (fees.fees.amount_type === "satori") {
        if (fees.fees.per === "full_stake") {
          feeForFullStakeInSatori = fees.fees.amount;
        } else {
          // per N satori
          feeForFullStakeInSatori = (fees.fees.amount / fees.fees.per) * fullStakeAmount;
        }
      } else {
        // fees in USD
        if (fees.fees.per === "full_stake") {
          feeForFullStakeInSatori = fees.fees.amount / satoriPrice;
        } else {
          feeForFullStakeInSatori =
            (fees.fees.amount / fees.fees.per) * fullStakeAmount / satoriPrice;
        }
      }

      const feeForCurrentStakeInSatori =
        (current_staked_amount / fullStakeAmount) * feeForFullStakeInSatori;

      const feePercent = feeForCurrentStakeInSatori / earningsForCurrentStake;
      const feeAmountPerSatori = feePercent * earnings_per_staking_power;

      return {
        type: "single",
        result: {
          feePercent,
          feeAmountPerSatori,
          net: earningsForCurrentStake - feeForCurrentStakeInSatori,
          netPerFullStake: earningsForFullStake - feeForFullStakeInSatori,
        },
      };
    }
    default: {
      return null;
    }
  }
}

// TODO maybe not useful anymore
export function poolHasMultipleFees(pool: Pool, date: Date): boolean {
  const fees = getPoolFeesForDate(pool, date);
  if (!fees) return false;
  return fees.fees.type === "percent" && Array.isArray(fees.fees.percent);
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
    pool,
    date,
    earnings_per_staking_power,
    current_staked_amount: 1,
    satoriPrice,
    fullStakeAmount,
  });

  if (!res) {
    return { min: 0, max: 0 };
  }

  if (res.type === "single") {
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
