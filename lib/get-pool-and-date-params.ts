import { KNOWN_POOLS, type TopPool } from "@/lib/known_pools";
import { isValidAddress } from "./evr";
import { getTopPools } from "./db/queries/contributors";
import { getVaultsForWallet } from "./evr/wallet-vault";
import { cacheLife } from "next/cache";

export type TopPoolWithName = TopPool & { name?: string };

export type PoolAndDate = {
  selectedPool: TopPoolWithName;
  selectedDate: Date;
  topPoolsWithNames: TopPoolWithName[];
  requestedDate: Date;
  hasData: boolean;
  didFallback: boolean;
};

function addUtcDays(date: Date, days: number) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      0,
      0,
      0
    )
  );
}

export async function getPoolAndDate({
  pool,
  date,
}: {
  pool?: string;
  date?: string;
}): Promise<PoolAndDate> {
  "use cache";
  cacheLife("max");

  const now = new Date();

  let selectedDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
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

  const requestedDate = selectedDate;

  // If today's (or requested) data isn't available yet, fall back to the most
  // recent previous day that has pool data.
  const maxLookbackDays = 14;

  let didFallback = false;
  let topPools = await getTopPools(selectedDate);

  for (
    let lookback = 0;
    lookback < maxLookbackDays && topPools.length === 0;
    lookback++
  ) {
    selectedDate = addUtcDays(selectedDate, -1);
    topPools = await getTopPools(selectedDate);
    didFallback = true;
  }

  const hasData = topPools.length > 0;

  // If there's no data at all (even after lookback), return a non-throwing
  // placeholder so routes can render an empty-state instead of crashing.
  if (!hasData) {
    const topPoolsWithNames: TopPoolWithName[] = KNOWN_POOLS.map((p) => ({
      name: p.name,
      address: p.address,
      vault_address: p.vault_address,
    }));

    const fallbackSelectedPoolAddress =
      pool && isValidAddress(pool) ? pool : KNOWN_POOLS[0]!.address;

    const selectedPool =
      topPoolsWithNames.find((p) => p.address === fallbackSelectedPoolAddress) ??
      topPoolsWithNames[0]!;

    return {
      selectedPool,
      selectedDate: requestedDate,
      requestedDate,
      topPoolsWithNames,
      hasData: false,
      didFallback: false,
    };
  }

  const first = topPools[0]!.pool_address;

  const selectedPoolAddress =
    pool && isValidAddress(pool)
      ? topPools.find((p) => p.pool_address === pool)?.pool_address ?? first
      : first;

  const topPoolsWithNamesData = await Promise.all(
    topPools.map(async (pool) => {
      const knownPool = KNOWN_POOLS.find(
        (p) => p.address === pool.pool_address
      );
      return {
        address: pool.pool_address,
        vaultAddress:
          knownPool?.vault_address ??
          (await getVaultsForWallet(pool.pool_address))[0], // ! nearly everyone has a single vault address
        name: knownPool?.name,
        sp: pool.total_staking_power,
      };
    })
  );

  const topPoolsWithNames: TopPoolWithName[] = topPoolsWithNamesData
    .toSorted((a, b) => b.sp - a.sp)
    .map((pool) => ({
      name: pool.name,
      address: pool.address,
      vault_address: pool.vaultAddress,
    }));

  const selectedPool = topPoolsWithNames.find(
    (pool) => pool.address === selectedPoolAddress
  );

  const safeSelectedPool = selectedPool ?? topPoolsWithNames[0]!;

  return {
    selectedPool: safeSelectedPool,
    selectedDate,
    requestedDate,
    topPoolsWithNames,
    hasData: true,
    didFallback,
  };
}
