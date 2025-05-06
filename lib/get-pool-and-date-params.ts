import { KNOWN_POOLS, type TopPool } from "@/lib/known_pools";
import { isValidAddress } from "./evr";
import { getTopPools } from "./db/queries/contributors";
import { getVaultsForWallet } from "./evr/wallet-vault";
import { unstable_cacheLife as cacheLife } from "next/cache";

export type TopPoolWithName = TopPool & { name?: string };

export type PoolAndDate = {
  selectedPool: TopPoolWithName;
  selectedDate: Date;
  topPoolsWithNames: TopPoolWithName[];
};

export async function getPoolAndDate({
  pool,
  date,
}: {
  pool?: string;
  date?: string;
}): Promise<PoolAndDate> {
  "use cache";
  cacheLife("max");

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

  const first = KNOWN_POOLS[0]!.address;

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
  )!;

  return {
    selectedPool,
    selectedDate,
    topPoolsWithNames,
  };
}
