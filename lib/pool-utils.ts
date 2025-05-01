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

export type AppliedFees =
  | {
      type: "single";
      result: FeeResult;
    }
  | {
      type: "multiple";
      results: FeeResult[];
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
}): AppliedFees | null {
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
            if (fees.maxPercent) {
              feePercent = Math.min(feePercent, fees.maxPercent);
            }
            return {
              feePercent,
              feeAmountPerSatori:
                (earnings_per_staking_power * feePercent) / satoriPrice,
              net: applyFeePercent(
                earnings_per_staking_power * current_staked_amount,
                feePercent
              ),
              netPerFullStake: applyFeePercent(
                earnings_per_staking_power * fullStakeAmount,
                feePercent
              ),
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
          net: applyFeePercent(
            earnings_per_staking_power * current_staked_amount,
            feePercent
          ),
          netPerFullStake: applyFeePercent(
            earnings_per_staking_power * fullStakeAmount,
            feePercent
          ),
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

      let feeForCurrentStakeInSatori =
        (current_staked_amount / fullStakeAmount) * feeForFullStakeInSatori;

      let feePercent = feeForCurrentStakeInSatori / (earnings_per_staking_power * current_staked_amount);
      if (fees.maxPercent !== undefined) {
        feePercent = Math.min(feePercent, fees.maxPercent);
      }

      return {
        type: "single",
        result: {
          feePercent,
          feeAmountPerSatori:
            (earnings_per_staking_power * feePercent) / satoriPrice,
          net: applyFeePercent(
            earnings_per_staking_power * current_staked_amount,
            feePercent
          ),
          netPerFullStake: applyFeePercent(
            earnings_per_staking_power * fullStakeAmount,
            feePercent
          ),
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
