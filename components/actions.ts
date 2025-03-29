"use server";

import { getPoolVsWorkerComparison } from "@/lib/db";
import { Pool } from "@/lib/known_pools";

export async function getPoolVsWorkerComparisonData(
  pool: Pool,
  date: Date,
  days: number,
  startingAmount: number
) {
  if (!pool.vault_address) {
    return [];
  }

  return getPoolVsWorkerComparison(
    pool.address,
    pool.vault_address,
    date,
    days,
    startingAmount,
    pool.staking_fees_percent
  );
}
