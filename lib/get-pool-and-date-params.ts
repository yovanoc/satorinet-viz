import { KNOWN_POOLS, type TopPool } from "@/lib/known_pools";
import { isValidAddress } from "./evr";
import {
  findKnownPool,
  isEvmAddress,
  isSamePool,
  knownVaultFor,
} from "./pool-utils";
import { getTopPools } from "./db/queries/contributors";
import { getVaultsForWallet } from "./evr/wallet-vault";
import { cacheLifeForDate } from "./db/cache-utils";

export type TopPoolWithName = TopPool & { name?: string; label_vault?: string | null };

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

/** Pool URL parameter: an Evrmore address (legacy links) or an EVM (Base) address. */
function isValidPoolParam(pool: string) {
  return isValidAddress(pool) || isEvmAddress(pool);
}

export async function getPoolAndDate({
  pool,
  date,
}: {
  pool?: string;
  date?: string;
}): Promise<PoolAndDate> {
  "use cache";
  cacheLifeForDate(new Date());

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
      pool && isValidPoolParam(pool) ? pool : KNOWN_POOLS[0]!.address;

    const selectedPool =
      topPoolsWithNames.find((p) =>
        isSamePool(p.address, fallbackSelectedPoolAddress)
      ) ??
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
    pool && isValidPoolParam(pool)
      ? topPools.find((p) => isSamePool(p.pool_address, pool))?.pool_address ??
        first
      : first;

  const topPoolsWithNamesData = await Promise.all(
    topPools.map(async (pool) => {
      const knownPool = findKnownPool(pool.pool_address);
      return {
        address: pool.pool_address,
        vaultAddress:
          (knownPool ? knownVaultFor(knownPool, pool.pool_address) : undefined) ??
          (await getVaultsForWallet(pool.pool_address))[0], // ! nearly everyone has a single vault address
        name: knownPool?.name,
        label_vault: pool.label_vault,
        sp: pool.total_staking_power,
      };
    })
  );

  const topPoolsWithNames: TopPoolWithName[] = topPoolsWithNamesData
    .toSorted((a, b) => b.sp - a.sp)
    .map((pool) => ({
      name: pool.name,
      label_vault: pool.label_vault,
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
