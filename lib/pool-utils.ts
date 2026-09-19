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
      row.pool_wallet === poolAddress ||
      (poolVault !== undefined && row.pool_vault === poolVault)
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
  const known = KNOWN_POOLS.find((candidate) => candidate.address === pool.address);
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
