import { type Pool } from "./known_pools";
import { addressesEqual, isEvmAddress, poolAddresses } from "./pool-utils";

export type PoolIdentity = { pool: Pool; addresses: string[] };

/** Build identities only from wallet mappings and wallet-vault records. */
export function buildPoolIdentities(
  pools: readonly Pool[],
  evrToBase: ReadonlyMap<string, string>,
  walletVaults: ReadonlyMap<string, readonly string[]>,
): PoolIdentity[] {
  const key = (address: string) => isEvmAddress(address) ? address.toLowerCase() : address;
  const graph = new Map<string, Set<string>>();
  const spellings = new Map<string, Set<string>>();
  const add = (address: string) => {
    const k = key(address);
    if (!graph.has(k)) graph.set(k, new Set());
    if (!spellings.has(k)) spellings.set(k, new Set());
    spellings.get(k)!.add(address);
    return k;
  };
  const link = (a: string, b: string) => {
    const x = add(a), y = add(b);
    graph.get(x)!.add(y);
    graph.get(y)!.add(x);
  };
  for (const pool of pools) {
    for (const address of poolAddresses(pool)) link(pool.address, address);
  }
  const baseOwners = new Map<string, Set<string>>();
  const conflicts = new Set<string>();
  for (const pool of pools) {
    if (!isEvmAddress(pool.address) && pool.base_address) {
      const mapped = evrToBase.get(pool.address);
      if (mapped && !addressesEqual(mapped, pool.base_address)) conflicts.add(key(pool.address));
    }
  }
  for (const [evr, base] of evrToBase) {
    if (!evr || isEvmAddress(evr) || !isEvmAddress(base)) continue;
    link(evr, base);
    const owners = baseOwners.get(key(base)) ?? new Set<string>();
    owners.add(key(evr));
    baseOwners.set(key(base), owners);
  }
  const vaultOwners = new Map<string, Set<string>>();
  for (const pool of pools) {
    for (const [wallet, vault] of [[pool.address, pool.vault_address], [pool.base_address, pool.base_vault_address]]) {
      if (!wallet || !vault) continue;
      const owners = vaultOwners.get(key(vault)) ?? new Set<string>();
      owners.add(key(wallet));
      vaultOwners.set(key(vault), owners);
    }
  }
  for (const [wallet, vaults] of walletVaults) {
    if (!wallet) continue;
    for (const vault of vaults) {
      if (!vault) continue;
      link(wallet, vault);
      const owners = vaultOwners.get(key(vault)) ?? new Set<string>();
      owners.add(key(wallet));
      vaultOwners.set(key(vault), owners);
    }
  }
  for (const [address, owners] of [...baseOwners, ...vaultOwners]) {
    if (owners.size > 1) conflicts.add(address);
  }
  return pools.map((pool) => {
    const seen = new Set<string>();
    const pending = [key(pool.address)];
    while (pending.length) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      pending.push(...(graph.get(current) ?? []));
    }
    const ambiguous = [...seen].some((address) => conflicts.has(address)) ||
      pools.some((other) => other !== pool && poolAddresses(other).some((address) => seen.has(key(address))));
    return {
      pool,
      addresses: ambiguous ? poolAddresses(pool) : [...seen].flatMap((address) => [...(spellings.get(address) ?? [])]),
    };
  });
}

export function findPoolIdentity(identities: readonly PoolIdentity[], ...addresses: (string | null | undefined)[]): PoolIdentity | undefined {
  const matches = identities.filter((identity) => identity.addresses.some((own) => addresses.some((address) => addressesEqual(own, address))));
  return matches.length === 1 ? matches[0] : undefined;
}

export function identityAddressForms(identities: readonly PoolIdentity[], address: string, vault?: string | null): string[] {
  const identity = findPoolIdentity(identities, address, vault);
  const forms = new Set<string>();
  for (const value of [address, vault, ...(identity?.addresses ?? [])]) {
    if (!value) continue;
    forms.add(value);
    if (isEvmAddress(value)) forms.add(value.toLowerCase());
  }
  return [...forms];
}
