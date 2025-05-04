import type { Pool } from "@/lib/known_pools";
import { unstable_cacheLife as cacheLife } from "next/cache";
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
      data: pool.vault_address
        ? await getPoolHistoricalData(
            pool.address,
            date,
            days
          )
        : null,
    }))
  );
}
