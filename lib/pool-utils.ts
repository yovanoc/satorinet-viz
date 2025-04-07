import type { Pool } from "./known_pools";

export function getPoolFeesForDate(pool: Pool, date: Date) {
  if (!pool.staking_fees_percent) return null;
  const fees = pool.staking_fees_percent.find((fee) => {
    if (fee.until === null) return true;
    return new Date(fee.until) >= date;
  });

  return fees ?? null;
}

export function getAvgFee(pool: Pool, date: Date): number {
  const fees = getPoolFeesForDate(pool, date);
  if (!fees) return 0;
  return Array.isArray(fees.percent)
    ? fees.percent.reduce((a, b) => a + b, 0) /
        fees.percent.length
    : fees.percent;
}

export function poolHasMultipleFees(pool: Pool, date: Date): boolean {
  const fees = getPoolFeesForDate(pool, date);
  if (!fees) return false;
  return Array.isArray(fees.percent);
}

export function getFeeRange(pool: Pool, date: Date): { min: number; max: number } {
  const fees = getPoolFeesForDate(pool, date);

  if (!fees) return { min: 0, max: 0 };

  if (!Array.isArray(fees.percent)) {
    return { min: fees.percent, max: fees.percent };
  }

  return {
    min: Math.min(...fees.percent),
    max: Math.max(...fees.percent),
  };
}

export function applyFee(grossEarnings: number, fee: number): number {
  return grossEarnings * (1 - fee);
}
