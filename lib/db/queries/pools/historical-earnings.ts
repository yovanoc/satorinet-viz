import type { Pool } from "@/lib/known_pools";
import { getPoolHistoricalData } from "./historical-data";
import { cacheLifeForDate } from "../../cache-utils";

export async function getPoolsHistoricalEarnings(
  pools: Pool[],
  date: Date,
  days = 30
) {
  "use cache";
  cacheLifeForDate(date);

  // TODO use a proper query

  return Promise.all(
    pools.map(async (pool) => ({
      pool,
      data: await getPoolHistoricalData(pool, date, days)
    }))
  );
}
