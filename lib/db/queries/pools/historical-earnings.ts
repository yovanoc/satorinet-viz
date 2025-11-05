import type { Pool } from "@/lib/known_pools";
import { cacheLife } from "next/cache";
import { getPoolHistoricalData } from "./historical-data";

export async function getPoolsHistoricalEarnings(
  pools: Pool[],
  date: Date,
  days = 30
) {
  "use cache";
  cacheLife("max");

  // TODO use a proper query

  return Promise.all(
    pools.map(async (pool) => ({
      pool,
      data: await getPoolHistoricalData(pool, date, days)
    }))
  );
}
