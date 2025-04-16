"use server";

import { getPoolVsWorkerComparison } from "@/lib/db";
import type { Pool } from "@/lib/known_pools";

export async function getPoolVsWorkerComparisonData(
  pools: Pool[],
  date: Date,
  days: number,
  startingAmount: number
) {
  // ! sanitize date to put 00:00:00 UTC
  const sanitizedDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0
    )
  );

  return getPoolVsWorkerComparison(
    pools,
    sanitizedDate,
    days,
    startingAmount
  );
}
