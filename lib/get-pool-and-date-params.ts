import { KNOWN_POOLS } from "@/lib/known_pools";
import { isValidAddress } from "./evr";
import { getTopPools } from "./db/queries/contributors";

export async function getPoolAndDate({
  pool,
  date,
}: {
  pool?: string;
  date?: string;
}) {
  let selectedDate = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0,
      0,
      0
    )
  );

  if (date) {
    const [year, month, day] = date.split("-").map(Number);

    if (year && month && day) {
      selectedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    }
  }

  const topPools = await getTopPools(selectedDate);

  const first = KNOWN_POOLS[0]?.address;

  const selectedPool =
    pool && isValidAddress(pool)
      ? topPools.find((p) => p.pool_address === pool)?.pool_address ?? first
      : first;

  if (!selectedPool) {
    return null;
  }

  const topPoolsWithNames = topPools.map((pool) => {
    const knownPool = KNOWN_POOLS.find((p) => p.address === pool.pool_address);
    return {
      address: pool.pool_address,
      name: knownPool?.name,
    };
  });

  return {
    selectedPool,
    selectedDate,
    topPoolsWithNames,
  };
}
