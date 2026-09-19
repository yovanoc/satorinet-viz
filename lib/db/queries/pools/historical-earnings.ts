import type { Pool } from "@/lib/known_pools";
import { getPoolHistoricalData } from "./historical-data";
import { getPoolFeeSnapshot } from "./fees";
import { cacheLifeForDate } from "../../cache-utils";

export async function getPoolsHistoricalEarnings(
  pools: Pool[],
  date: Date,
  days = 30
) {
  "use cache";
  cacheLifeForDate(date);

  const feeSnapshot = await getPoolFeeSnapshot(pools, date);

  return Promise.all(
    pools.map(async (pool) => ({
      pool,
      data: await getPoolHistoricalData(
        pool,
        date,
        days,
        feeSnapshot[pool.address]
      ),
    }))
  );
}
