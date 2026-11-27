import { KNOWN_POOLS, type Pool } from "../lib/known_pools";
import {
  POOL_NAME_INDEX_LIMITS as LIMITS,
  cleanPoolName,
  isPoolNameIndexDay,
  normalizePoolAddress,
  type PoolNameIndex,
} from "../lib/pool-name-index";
import { poolAddresses } from "../lib/pool-utils";

export type AuditAliasRow = { pool_alias: string | null; pool_wallet: string | null };
export type DbPoolPair = { pool_address: string | null; pool_vault: string | null };
export type CrossChainLink = {
  evm_address: string;
  evr_address: string;
  kind: string;
  confidence: string;
};
export type RegistryRow = {
  address: string;
  pool_name?: string | null;
  alias?: string | null;
};

export type PoolNameIndexInput = {
  /** UTC snapshot day; `auditRows` and `dbPairs` must be that exact day's data. */
  day: string;
  builtAt: string;
  auditRows: readonly AuditAliasRow[];
  dbPairs: readonly DbPoolPair[];
  links: readonly CrossChainLink[];
  registryRows: readonly RegistryRow[];
  curatedPools?: readonly Pool[];
};

export type PoolNameIndexFailureReason =
  | "invalid_day"
  | "invalid_built_at"
  | "too_many_audit_rows"
  | "too_many_registry_rows"
  | "too_many_db_pairs"
  | "too_many_links"
  | "too_many_nodes"
  | "too_many_edges"
  | "index_too_large";

export type PoolNameIndexResult =
  | { ok: true; index: PoolNameIndex }
  | { ok: false; reason: PoolNameIndexFailureReason };

type Observation = { key: string; target: string };
type Resolved = { edges: [string, string][]; disputed: Set<string> };

/**
 * A key is trusted only when every observation names the same valid target.
 * A blank/malformed target counts as a disagreement with a valid one.
 */
function resolveUnique(observations: Observation[]): Resolved {
  const byKey = new Map<string, Set<string>>();
  for (const { key, target } of observations) {
    const targets = byKey.get(key) ?? new Set<string>();
    targets.add(target);
    byKey.set(key, targets);
  }
  const edges: [string, string][] = [];
  const disputed = new Set<string>();
  for (const [key, targets] of byKey) {
    if (targets.size > 1) disputed.add(key);
    else {
      const [target] = targets;
      if (target) edges.push([key, target]);
    }
  }
  return { edges, disputed };
}

function pairObservations<T>(
  rows: readonly T[],
  keyOf: (row: T) => unknown,
  targetOf: (row: T) => unknown
): Observation[] {
  const out: Observation[] = [];
  for (const row of rows) {
    const key = normalizePoolAddress(keyOf(row));
    if (key) out.push({ key, target: normalizePoolAddress(targetOf(row)) ?? "" });
  }
  return out;
}

/** Both endpoints must agree on one counterpart across all certain role claims. */
function resolveLinks(links: readonly CrossChainLink[]) {
  const observations: Observation[] = [];
  const walletClaims = new Set<string>();
  const vaultAddresses = new Set<string>();
  for (const link of links) {
    if (link.confidence !== "certain" || (link.kind !== "wallet" && link.kind !== "vault")) continue;
    const evm = normalizePoolAddress(link.evm_address);
    const evr = normalizePoolAddress(link.evr_address);
    if (!evm || !evr || !evm.startsWith("0x") || evr.startsWith("0x")) continue;
    observations.push({ key: evm, target: evr }, { key: evr, target: evm });
    if (link.kind === "wallet") walletClaims.add(evm);
    else {
      vaultAddresses.add(evm);
      vaultAddresses.add(evr);
    }
  }
  const { edges, disputed } = resolveUnique(observations);
  const accepted = edges.filter(([a, b]) => a.startsWith("0x") && !disputed.has(b));
  return { edges: accepted, disputed, vaultAddresses, walletEdges: accepted.filter(([a]) => walletClaims.has(a)) };
}

function findContestedVaults(
  pairs: Resolved,
  aliases: Resolved,
  walletEdges: Resolved["edges"],
  vaultAddresses: ReadonlySet<string>,
  disputed: ReadonlySet<string>,
): Set<string> {
  const ownersByVault = new Map<string, string[]>();
  for (const [owner, vault] of pairs.edges) {
    if (owner === vault) continue; // A self-edge cannot merge another owner into the vault.
    const owners = ownersByVault.get(vault) ?? [];
    owners.push(owner);
    ownersByVault.set(vault, owners);
  }
  const contestedVaults = new Set<string>();
  const sharedVaults = [...ownersByVault].filter(([, owners]) => owners.length > 1);
  if (!sharedVaults.length) return contestedVaults;

  // Proof is one direct alias-to-wallet step and at most one wallet-only counterpart.
  const walletByAlias = new Map(aliases.edges);
  const canBeWallet = (address: string) => !vaultAddresses.has(address) && !aliases.disputed.has(address);
  const isWallet = (address: string) => canBeWallet(address) && (walletByAlias.get(address) ?? address) === address;
  const evrByEvmWallet = new Map(walletEdges.filter(([evm, evr]) => isWallet(evm) && isWallet(evr)));
  const walletFor = (owner: string) => {
    const wallet = walletByAlias.get(owner) ?? owner;
    if (canBeWallet(owner) && isWallet(wallet)) return evrByEvmWallet.get(wallet) ?? wallet;
  };
  for (const [vault, owners] of sharedVaults) {
    // A vault can also be the wallet, but only if every claimant points directly to it.
    if (
      !disputed.has(vault) && (walletByAlias.get(vault) ?? vault) === vault &&
      owners.every((owner) => canBeWallet(owner) && !disputed.has(owner) && walletByAlias.get(owner) === vault)
    ) continue;
    const wallet = walletFor(owners[0]!);
    if (!wallet || !owners.every((owner) => walletFor(owner) === wallet)) contestedVaults.add(vault);
  }
  return contestedVaults;
}

type Seed = { key: string; display: string; curated: boolean };

const nameKey = (name: string) => name.toLowerCase();

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function collectSeeds(
  curatedPools: readonly Pool[],
  registryRows: readonly RegistryRow[]
): Map<string, Seed[]> {
  const seeds = new Map<string, Seed[]>();
  const add = (address: string, seed: Seed) => {
    const list = seeds.get(address) ?? [];
    list.push(seed);
    seeds.set(address, list);
  };

  const declared: { pool: Pool; name: string; addresses: Set<string>; host: string | null }[] = [];
  for (const pool of curatedPools) {
    const name = cleanPoolName(pool.name);
    if (!name) continue;
    const addresses = new Set<string>();
    for (const raw of [...poolAddresses(pool), pool.label_vault_address]) {
      const address = normalizePoolAddress(raw);
      if (address) addresses.add(address);
    }
    for (const address of addresses) add(address, { key: nameKey(name), display: name, curated: true });
    declared.push({ pool, name, addresses, host: hostOf(pool.url) });
  }

  for (const row of registryRows) {
    const address = normalizePoolAddress(row.address);
    const name = cleanPoolName(row.pool_name) ?? cleanPoolName(row.alias);
    if (!address || !name) continue;
    const bare = nameKey(name).replace(/^www\./, "");
    // A registry name that is a curated pool's own domain means that pool, but only on its own addresses.
    const curated = declared.find((d) => d.host === bare && d.addresses.has(address));
    add(
      address,
      curated
        ? { key: nameKey(curated.name), display: curated.name, curated: true }
        : { key: nameKey(name), display: name, curated: false }
    );
  }
  return seeds;
}

class UnionFind {
  private readonly parent: number[] = [];
  private readonly size: number[] = [];

  add(): number {
    this.parent.push(this.parent.length);
    this.size.push(1);
    return this.parent.length - 1;
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!;
      x = this.parent[x]!;
    }
    return x;
  }

  union(a: number, b: number): void {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    if (this.size[ra]! < this.size[rb]!) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra]! += this.size[rb]!;
  }
}

function componentName(members: string[], seeds: Map<string, Seed[]>): string | null | undefined {
  const byKey = new Map<string, Seed[]>();
  for (const address of members) {
    for (const seed of seeds.get(address) ?? []) {
      byKey.set(seed.key, [...(byKey.get(seed.key) ?? []), seed]);
    }
  }
  if (byKey.size === 0) return undefined;
  if (byKey.size > 1) return null;
  const [candidates] = byKey.values();
  const displays = candidates!
    .filter((s) => s.curated || !candidates!.some((c) => c.curated))
    .map((s) => s.display)
    .sort();
  return displays[0]!;
}

export function buildPoolNameIndex(input: PoolNameIndexInput): PoolNameIndexResult {
  const fail = (reason: PoolNameIndexFailureReason): PoolNameIndexResult => ({ ok: false, reason });
  if (!isPoolNameIndexDay(input.day)) return fail("invalid_day");
  if (Number.isNaN(Date.parse(input.builtAt))) return fail("invalid_built_at");
  if (input.auditRows.length > LIMITS.auditRows) return fail("too_many_audit_rows");
  if (input.registryRows.length > LIMITS.registryRows) return fail("too_many_registry_rows");
  if (input.dbPairs.length > LIMITS.dbPairs) return fail("too_many_db_pairs");
  if (input.links.length > LIMITS.links) return fail("too_many_links");

  const aliases = resolveUnique(pairObservations(input.auditRows, (r) => r.pool_alias, (r) => r.pool_wallet));
  const links = resolveLinks(input.links);
  const vaultObservations = pairObservations(input.dbPairs, (r) => r.pool_address, (r) => r.pool_vault);
  const vaultPairs = resolveUnique(vaultObservations);
  const sources = [aliases, links, vaultPairs];
  const vaultAddresses = new Set(links.vaultAddresses);
  for (const { target } of vaultObservations) if (target) vaultAddresses.add(target);
  const disputed = new Set(sources.flatMap((source) => [...source.disputed]));
  const suppressedVaults = findContestedVaults(vaultPairs, aliases, links.walletEdges, vaultAddresses, disputed);
  for (const key of disputed) if (vaultAddresses.has(key)) suppressedVaults.add(key);
  for (const vault of suppressedVaults) disputed.add(vault);
  const affectedOwners = new Set(vaultPairs.edges.filter(([, vault]) => suppressedVaults.has(vault)).map(([owner]) => owner));
  const seeds = collectSeeds(input.curatedPools ?? KNOWN_POOLS, input.registryRows);

  const ids = new Map<string, number>();
  const addresses: string[] = [];
  const uf = new UnionFind();
  const node = (address: string): number => {
    let id = ids.get(address);
    if (id === undefined) {
      id = uf.add();
      ids.set(address, id);
      addresses.push(address);
    }
    return id;
  };

  const edgeKeys = new Set<string>();
  const edges: [number, number][] = [];
  for (const source of sources) {
    for (const [a, b] of source.edges) {
      const ia = node(a);
      const ib = node(b);
      // A suppressed vault cannot pass names through an alias, link, or another DB pair.
      if (suppressedVaults.has(a) || suppressedVaults.has(b)) continue;
      const id = ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`;
      if (ia !== ib && !edgeKeys.has(id)) {
        edgeKeys.add(id);
        edges.push([ia, ib]);
      }
    }
  }
  for (const address of [...seeds.keys(), ...disputed]) node(address);
  if (addresses.length > LIMITS.nodes) return fail("too_many_nodes");
  if (edges.length > LIMITS.edges) return fail("too_many_edges");
  for (const [a, b] of edges) uf.union(a, b);

  const components = new Map<number, string[]>();
  for (const address of addresses) {
    const root = uf.find(ids.get(address)!);
    components.set(root, [...(components.get(root) ?? []), address]);
  }

  const resolved = new Map<string, string | null>();
  for (const members of components.values()) {
    const name = componentName(members, seeds);
    const oversized = members.length > LIMITS.componentMembers;
    for (const address of members) {
      if (disputed.has(address)) resolved.set(address, null);
      else if (name !== undefined) resolved.set(address, oversized ? null : name);
      else if (affectedOwners.has(address)) resolved.set(address, null); // Prevent label_vault fallback.
    }
  }

  const names: Record<string, string | null> = {};
  for (const address of [...resolved.keys()].sort()) names[address] = resolved.get(address)!;
  const index: PoolNameIndex = { day: input.day, builtAt: input.builtAt, names };
  if (new TextEncoder().encode(JSON.stringify(index)).length > LIMITS.serializedBytes) {
    return fail("index_too_large");
  }
  return { ok: true, index };
}
