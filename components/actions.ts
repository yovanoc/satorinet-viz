"use server";

import { getPoolVsWorkerComparison } from "@/lib/db";
import type { Pool } from "@/lib/known_pools";

export async function getPoolVsWorkerComparisonData(
  pools: Pool[],
  date: Date,
  days: number,
  startingAmount: number
) {
  return getPoolVsWorkerComparison(
    pools,
    date,
    days,
    startingAmount
  );
}
