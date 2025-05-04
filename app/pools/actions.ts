"use server";

import { getPoolVsWorkerComparison } from "@/lib/db/queries/pools/worker-comparison";

export async function getPoolVsWorkerComparisonData(
  pool_addresses: string[],
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
    pool_addresses,
    sanitizedDate,
    days,
    startingAmount
  );
}
