import { KNOWN_POOLS, type Pool, type StakingFee } from "./known_pools";

export type FeeSource = "audit" | "known" | "unknown";

/** Live API commission is percentage points (21 means 21%); calculations use fractions. */
export function normalizeLiveCommission(commission: number): number {
  return commission / 100;
}

export type FeePool = Pick<
  Pool,
  "address" | "vault_address" | "staking_fees" | "temporary_fee_reductions"
>;

export type ResolvedPoolFee = {
  source: FeeSource;
  fees: StakingFee | null;
  maxPercent?: number;
  workerGivenPercent?: number;
  temporaryReductions: { percent: number; reason: string }[];
  warning?: string;
};

export type AuditCommissionRow = {
  pool_wallet: string;
  pool_vault: string | null;
  /** Audit API contract: percentage points (40 means 40%), not a fraction. */
  pool_commission: number | null;
};

export type AuditCommissionResult =
  | { status: "valid"; feePercent: number }
  | { status: "unavailable"; reason: string }
  | { status: "invalid"; reason: string };

export function getAuditCommissionForPool(
  rows: readonly AuditCommissionRow[] | null,
  poolAddress: string,
  poolVault?: string
): AuditCommissionResult {
  if (!rows || rows.length === 0) {
    return { status: "unavailable", reason: "no audit rows for the requested date" };
  }

  const matchingRows = rows.filter(
    (row) =>
      isSamePool(row.pool_wallet, poolAddress) ||
      (poolVault !== undefined && isSamePool(row.pool_vault, poolVault))
  );

  if (matchingRows.length === 0) {
    return { status: "unavailable", reason: "no audit rows for this pool" };
  }

  const commissions = matchingRows.map((row) => row.pool_commission);
  if (
    commissions.some(
      (commission) =>
        commission === null ||
        !Number.isFinite(commission) ||
        commission < 0 ||
        commission > 100
    )
  ) {
    return {
      status: "invalid",
      reason: "audit pool_commission is missing, non-finite, or outside 0-100 percentage points",
    };
  }

  const first = commissions[0]!;
  if (commissions.some((commission) => Math.abs(commission! - first) > 1e-9)) {
    return {
      status: "invalid",
      reason: "audit pool_commission differs between lender rows",
    };
  }

  // The audit API reports percentage points; the calculation contract uses a fraction.
  return { status: "valid", feePercent: first / 100 };
}

function enrichKnownPool(pool: FeePool | null): FeePool | null {
  if (!pool) return null;
  const known = findKnownPool(pool.address, pool.vault_address);
  return {
    address: pool.address,
    vault_address: pool.vault_address ?? known?.vault_address,
    staking_fees: pool.staking_fees ?? known?.staking_fees,
    temporary_fee_reductions:
      pool.temporary_fee_reductions ?? known?.temporary_fee_reductions,
  };
}

export function resolvePoolFee(
  pool: FeePool | null,
  date: Date,
  auditRows: readonly AuditCommissionRow[] | null
): ResolvedPoolFee {
  const enrichedPool = enrichKnownPool(pool);
  const audit = getAuditCommissionForPool(
    auditRows,
    enrichedPool?.address ?? "",
    enrichedPool?.vault_address
  );

  if (audit.status === "valid") {
    return {
      source: "audit",
      fees: { type: "percent", percent: audit.feePercent },
      temporaryReductions: [],
    };
  }

  const legacy = enrichedPool ? getPoolFeesForDate(enrichedPool, date) : null;
  const warning = `Pool ${enrichedPool?.address ?? "unknown"}: Audit commission ${audit.reason}; using configured pool fee.`;
  if (legacy) {
    return {
      source: "known",
      fees: legacy.fees,
      maxPercent: legacy.maxPercent,
      workerGivenPercent: legacy.workerGivenPercent,
      temporaryReductions: enrichedPool
        ? getActiveTemporaryReductions(enrichedPool, date).map(({ percent, reason }) => ({
            percent,
            reason,
          }))
        : [],
      warning,
    };
  }

  return {
    source: "unknown",
    fees: null,
    temporaryReductions: [],
    warning: pool
      ? `${warning.slice(0, -1)} and no configured pool fee; fee is not verified.`
      : "No valid audit or configured pool fee; fee is not verified.",
  };
}

export function getPoolFeesForDate(pool: FeePool, date: Date) {
  if (!pool.staking_fees) return null;
  let fees = pool.staking_fees.find((fee) => {
    if (fee.until === null) return true;
    return fee.until >= date;
  });

  if (fees?.fees && pool.temporary_fee_reductions) {
    const reductions = pool.temporary_fee_reductions.filter(
      (reduction) => reduction.from <= date && reduction.until >= date
    );
    if (reductions.length > 0) {
      // TODO we handle temporary fee reductions only for percent fees for now
      if (fees.fees.type === "percent") {
        const totalReduction = reductions.reduce(
          (acc, reduction) => acc + reduction.percent,
          0
        );
        if (Array.isArray(fees.fees.percent)) {
          fees = {
            ...fees,
            fees: {
              ...fees.fees,
              percent: fees.fees.percent.map((p) =>
                Math.max(0, p - totalReduction)
              ),
            },
          };
        } else {
          fees = {
            ...fees,
            fees: {
              ...fees.fees,
              percent: Math.max(0, fees.fees.percent - totalReduction),
            },
          };
        }
      }
    }
  }

  return fees ?? null;
}

export type FeeResult = {
  feePercent: number;
  feeAmountPerSatori: number;
  net: number;
  netPerFullStake: number;
};

export type AppliedFees =
  | {
      type: "not_found";
      result: FeeResult;
    }
  | {
      type: "single";
      result: FeeResult;
    }
  | {
      type: "multiple";
      results: FeeResult[];
    };

export function applyFees({
  fee,
  earnings_per_staking_power,
  current_staked_amount,
  satoriPrice,
  fullStakeAmount,
}: {
  poolAddress: string;
  date: Date;
  fee: ResolvedPoolFee;
  earnings_per_staking_power: number;
  current_staked_amount: number;
  satoriPrice: number;
  fullStakeAmount: number;
}): AppliedFees {
  const net = earnings_per_staking_power * current_staked_amount;
  const netPerFullStake = earnings_per_staking_power * fullStakeAmount;
  const resolvedFee = fee;

  if (!resolvedFee.fees) {
    return {
      type: "not_found",
      result: {
        feePercent: 0,
        feeAmountPerSatori: 0,
        net,
        netPerFullStake,
      },
    };
  }

  switch (resolvedFee.fees.type) {
    case "percent": {
      if (Array.isArray(resolvedFee.fees.percent)) {
        return {
          type: "multiple",
          results: resolvedFee.fees.percent.map((feePercent) => {
            if (resolvedFee.maxPercent !== undefined) {
              feePercent = Math.min(feePercent, resolvedFee.maxPercent);
            }
            return {
              feePercent,
              feeAmountPerSatori:
                (earnings_per_staking_power * feePercent) / satoriPrice,
              net: applyFeePercent(net, feePercent),
              netPerFullStake: applyFeePercent(netPerFullStake, feePercent),
            };
          }),
        };
      }
      let feePercent = resolvedFee.fees.percent;
      if (resolvedFee.maxPercent !== undefined) {
        feePercent = Math.min(feePercent, resolvedFee.maxPercent);
      }

      return {
        type: "single",
        result: {
          feePercent,
          feeAmountPerSatori:
            (earnings_per_staking_power * feePercent) / satoriPrice,
          net: applyFeePercent(net, feePercent),
          netPerFullStake: applyFeePercent(netPerFullStake, feePercent),
        },
      };
    }
    case "cost": {
      let feeForFullStakeInSatori: number;

      if (resolvedFee.fees.amount_type === "satori") {
        if (resolvedFee.fees.per === "full_stake") {
          feeForFullStakeInSatori = resolvedFee.fees.amount;
        } else {
          // per N satori
          feeForFullStakeInSatori =
            (resolvedFee.fees.amount / resolvedFee.fees.per) * fullStakeAmount;
        }
      } else {
        // fees in USD
        if (resolvedFee.fees.per === "full_stake") {
          feeForFullStakeInSatori = resolvedFee.fees.amount / satoriPrice;
        } else {
          feeForFullStakeInSatori =
            ((resolvedFee.fees.amount / resolvedFee.fees.per) * fullStakeAmount) /
            satoriPrice;
        }
      }

      const feeForCurrentStakeInSatori =
        (current_staked_amount / fullStakeAmount) * feeForFullStakeInSatori;

      let feePercent = feeForCurrentStakeInSatori / net;
      if (resolvedFee.maxPercent !== undefined) {
        feePercent = Math.min(feePercent, resolvedFee.maxPercent);
      }

      return {
        type: "single",
        result: {
          feePercent,
          feeAmountPerSatori:
            (earnings_per_staking_power * feePercent) / satoriPrice,
          net: applyFeePercent(net, feePercent),
          netPerFullStake: applyFeePercent(netPerFullStake, feePercent),
        },
      };
    }
  }
}

export function getFeeRange(
  pool: Pool,
  date: Date,
  earnings_per_staking_power: number,
  satoriPrice: number,
  fullStakeAmount: number,
  fee: ResolvedPoolFee
): { min: number; max: number } {
  const res = applyFees({
    poolAddress: pool.address,
    date,
    fee,
    earnings_per_staking_power,
    current_staked_amount: 1,
    satoriPrice,
    fullStakeAmount,
  });

  if (res.type === "single" || res.type === "not_found") {
    return {
      min: res.result.feePercent,
      max: res.result.feePercent,
    };
  }

  return {
    min: Math.min(...res.results.map((r) => r.feePercent)),
    max: Math.max(...res.results.map((r) => r.feePercent)),
  };
}

export function applyFeePercent(num: number, fee: number): number {
  return num * (1 - fee);
}

export function getActiveTemporaryReductions(pool: FeePool, date: Date) {
  if (!pool.temporary_fee_reductions) return [];
  return pool.temporary_fee_reductions.filter(
    (reduction) => reduction.from <= date && reduction.until >= date
  );
}

/* ---------------------------------------------------------------------------
 * Pool address matching.
 *
 * Until 2026-10-27 the database designates pools by Evrmore addresses; since
 * 2026-11-01 it uses EVM (Base) addresses whose casing is not guaranteed.
 * Evrmore addresses are compared exactly, EVM addresses case-insensitively.
 * ------------------------------------------------------------------------- */

const EVM_ADDRESS = /^0x[0-9a-f]{40}$/i;

export function isEvmAddress(address: string): boolean {
  return EVM_ADDRESS.test(address);
}

export function addressesEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return isEvmAddress(a) && isEvmAddress(b) && a.toLowerCase() === b.toLowerCase();
}

type PoolAddresses = Pick<
  Pool,
  "address" | "vault_address" | "base_address" | "base_vault_address"
>;

/** Every known address of a pool (Evrmore + Base). */
export function poolAddresses(pool: PoolAddresses): string[] {
  return [
    pool.address,
    pool.vault_address,
    pool.base_address,
    pool.base_vault_address,
  ].filter((a): a is string => Boolean(a));
}

/** Known pool owning any of the given addresses (wallet or vault, either network). */
export function findKnownPool(
  ...addresses: (string | null | undefined)[]
): Pool | undefined {
  const wanted = addresses.filter((a): a is string => Boolean(a));
  if (wanted.length === 0) return undefined;
  return KNOWN_POOLS.find((pool) =>
    poolAddresses(pool).some((own) => wanted.some((a) => addressesEqual(own, a)))
  );
}

/** Resolve a display name without treating observed vaults as pool identity. */
export function poolDisplayName(address: string, labelVault?: string | null): string | undefined {
  const known = findKnownPool(address);
  if (known) return known.name;
  if (!labelVault) return undefined;
  const matches = KNOWN_POOLS.filter((pool) =>
    [pool.vault_address, pool.base_vault_address, pool.label_vault_address].some((vault) =>
      addressesEqual(vault, labelVault)
    )
  );
  return matches.length === 1 ? matches[0]!.name : undefined;
}

/** True when both addresses designate the same pool, whatever their network. */
export function isSamePool(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (addressesEqual(a, b)) return true;
  const known = findKnownPool(a);
  return known !== undefined && known === findKnownPool(b);
}

/** The known pool's vault in the same address family as `address`. */
export function knownVaultFor(pool: Pool, address: string): string | undefined {
  return isEvmAddress(address)
    ? pool.base_vault_address ?? pool.vault_address
    : pool.vault_address ?? pool.base_vault_address;
}

/**
 * Exact spellings to match in SQL for a pool: the given addresses, all the
 * known addresses of the pool if it is known, plus the lowercase form of every
 * EVM address. Used with `IN (...)` so btree indexes stay usable.
 */
export function poolAddressForms(
  address: string,
  vaultAddress?: string | null
): string[] {
  const known = findKnownPool(address, vaultAddress);
  const out = new Set<string>();
  for (const a of [address, vaultAddress, ...(known ? poolAddresses(known) : [])]) {
    if (!a) continue;
    out.add(a);
    if (isEvmAddress(a)) out.add(a.toLowerCase());
  }
  return [...out];
}

/** Known pool data merged onto a DB-derived pool (keeps the DB address), or an unknown placeholder. */
export function mergeKnownPool(pool: {
  address: string;
  vault_address?: string;
  name?: string;
}): Pool {
  const known = findKnownPool(pool.address, pool.vault_address);
  if (!known) {
    return {
      name: pool.name ?? "Unknown Pool",
      color: "#888",
      address: pool.address,
      vault_address: pool.vault_address,
    };
  }
  return {
    ...known,
    address: pool.address,
    vault_address: pool.vault_address ?? knownVaultFor(known, pool.address),
  };
}
