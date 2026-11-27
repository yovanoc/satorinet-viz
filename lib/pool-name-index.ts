import { address as bitcoinAddress } from "bitcoinjs-lib";
import { isEvmAddress } from "./pool-utils";

/** Display-only pool name index, built off the request path, one value per UTC day. */
export type PoolNameIndex = {
  day: string;
  builtAt: string;
  /** Normalized address → pool name; `null` is an explicit "name unknown or disputed". */
  names: Record<string, string | null>;
};

export const POOL_NAME_INDEX_KEY_PREFIX = "satorinet:pool-names:v1:";

export const POOL_NAME_INDEX_LIMITS = {
  auditRows: 20_000,
  registryRows: 512,
  dbPairs: 4_096,
  links: 4_096,
  nodes: 8_192,
  edges: 16_384,
  componentMembers: 64,
  serializedBytes: 128 * 1024,
  nameLength: 80,
} as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EVM_ZERO = "0x0000000000000000000000000000000000000000";
const EVRMORE_ADDRESS = /^[Ee][1-9A-HJ-NP-Za-km-z]{33}$/;

export function isPoolNameIndexDay(day: unknown): day is string {
  if (typeof day !== "string" || !DAY.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day);
}

export function poolNameIndexKey(day: string): string {
  if (!isPoolNameIndexDay(day)) throw new Error(`Invalid pool name index day: ${day}`);
  return `${POOL_NAME_INDEX_KEY_PREFIX}${day}`;
}

/** EVM → lowercase, Evrmore → exact. Blank, malformed or zero addresses → null. */
export function normalizePoolAddress(address: unknown): string | null {
  if (typeof address !== "string") return null;
  if (isEvmAddress(address)) {
    const lower = address.toLowerCase();
    return lower === EVM_ZERO ? null : lower;
  }
  if (!EVRMORE_ADDRESS.test(address)) return null;
  try {
    const { version } = bitcoinAddress.fromBase58Check(address);
    // Match lib/evr's mainnet pubKeyHash and scriptHash versions.
    return version === 0x21 || version === 0x5c ? address : null;
  } catch {
    return null;
  }
}

/** A usable display name: trimmed, nonblank, bounded. */
export function cleanPoolName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= POOL_NAME_INDEX_LIMITS.nameLength ? trimmed : null;
}

/** Validates a parsed Redis value; returns null for anything unexpected or for another day. */
export function parsePoolNameIndex(value: unknown, expectedDay?: string): PoolNameIndex | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 3 || !["day", "builtAt", "names"].every((k) => keys.includes(k))) return null;

  const { day, builtAt, names } = record;
  if (!isPoolNameIndexDay(day) || (expectedDay !== undefined && day !== expectedDay)) return null;
  if (typeof builtAt !== "string" || Number.isNaN(Date.parse(builtAt))) return null;
  if (typeof names !== "object" || names === null || Array.isArray(names)) return null;

  const entries = Object.entries(names);
  if (entries.length > POOL_NAME_INDEX_LIMITS.nodes) return null;
  const clean: Record<string, string | null> = {};
  for (const [address, name] of entries) {
    if (normalizePoolAddress(address) !== address) return null;
    if (name !== null && cleanPoolName(name) !== name) return null;
    clean[address] = name;
  }
  return { day, builtAt, names: clean };
}
