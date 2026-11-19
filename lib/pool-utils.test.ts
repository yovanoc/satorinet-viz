import { strict as assert } from "node:assert";
import { test } from "node:test";

import { KNOWN_POOLS, type Pool } from "./known_pools";
import {
  auditDateParam,
  parseAuditCommission,
  parsedAuditCacheKey,
} from "./satorinet/audit-parser";
import {
  applyFees,
  getAuditCommissionForPool,
  getPoolFeesForDate,
  normalizeLiveCommission,
  resolvePoolFee,
  addressesEqual,
  findKnownPool,
  isSamePool,
  knownVaultFor,
  mergeKnownPool,
  poolAddressForms,
} from "./pool-utils";

const DATE = new Date("2026-01-15T00:00:00.000Z");

test("normalizes live and audit percentage-point contracts", () => {
  assert.equal(normalizeLiveCommission(21), 0.21);
  assert.equal(normalizeLiveCommission(40), 0.4);
  assert.equal(normalizeLiveCommission(1), 0.01);
  assert.equal(parseAuditCommission("21"), 21);
  assert.equal(parseAuditCommission("not-a-number"), null);
  assert.equal(parseAuditCommission("Infinity"), null);
  assert.equal(parseAuditCommission(""), null);
  assert.equal(auditDateParam(new Date("2026-01-15T23:59:00Z")), "2026-01-15");
  assert.equal(
    parsedAuditCacheKey("stakers", DATE),
    "satorinet:audit:stakers:v2:2026-01-15"
  );
  assert.equal(
    parsedAuditCacheKey("workers", DATE),
    "satorinet:audit:workers:2026-01-15"
  );
});

function auditRow(
  commission: number | null,
  poolWallet = "pool-wallet",
  poolVault: string | null = null
) {
  return {
    pool_wallet: poolWallet,
    pool_vault: poolVault,
    pool_commission: commission,
  };
}

test("uses a matching audit commission, including an unknown pool", () => {
  const fee = resolvePoolFee(
    { address: "unknown-pool" },
    DATE,
    [auditRow(21, "unknown-pool")]
  );
  assert.equal(fee.source, "audit");
  assert.deepEqual(fee.fees, { type: "percent", percent: 0.21 });

  const applied = applyFees({
    poolAddress: "unknown-pool",
    date: DATE,
    fee,
    earnings_per_staking_power: 10,
    current_staked_amount: 2,
    satoriPrice: 1,
    fullStakeAmount: 2,
  });
  assert.equal(applied.type, "single");
  assert.equal(applied.result.feePercent, 0.21);
  assert.equal(applied.result.net, 15.8);
});

test("enriches address-only known pools before legacy fallback", () => {
  const knownPool = KNOWN_POOLS.find((pool) => pool.name === "Cortex")!;
  const fee = resolvePoolFee({ address: knownPool.address }, DATE, null);
  assert.equal(fee.source, "known");
  assert.deepEqual(fee.fees, getPoolFeesForDate(knownPool, DATE)?.fees);
  assert.match(fee.warning ?? "", /using configured pool fee/);
});

test("keeps a zero audit commission as a verified fee", () => {
  const fee = resolvePoolFee(
    { address: "zero-pool" },
    DATE,
    [auditRow(0, "zero-pool")]
  );
  assert.equal(fee.source, "audit");
  assert.deepEqual(fee.fees, { type: "percent", percent: 0 });
  assert.equal(fee.warning, undefined);
});

test("rejects malformed, out-of-range, and inconsistent audit commissions", () => {
  const knownPool = KNOWN_POOLS.find((pool) => pool.name === "Cortex")!;

  for (const rows of [
    [auditRow(null, knownPool.address)],
    [auditRow(Number.NaN, knownPool.address)],
    [auditRow(101, knownPool.address)],
    [auditRow(20, knownPool.address), auditRow(21, knownPool.address)],
  ]) {
    const fee = resolvePoolFee(knownPool, DATE, rows);
    assert.equal(fee.source, "known");
    assert.match(fee.warning ?? "", /Audit commission/);
  }
});

test("matches pool wallet identity and validates all lender rows", () => {
  const matching = getAuditCommissionForPool(
    [auditRow(40, "pool-wallet"), auditRow(40, "pool-wallet")],
    "pool-wallet"
  );
  assert.deepEqual(matching, { status: "valid", feePercent: 0.4 });

  const wrongWallet = getAuditCommissionForPool(
    [auditRow(99, "another-wallet", "requested-address")],
    "requested-address"
  );
  assert.equal(wrongWallet.status, "unavailable");
});

test("preserves legacy tiered and temporary-reduction rules on fallback", () => {
  const tiered = KNOWN_POOLS.find((pool) => pool.name === "Satorinet")!;
  const tieredFee = resolvePoolFee(tiered, new Date("2025-01-15T00:00:00Z"), []);
  assert.equal(tieredFee.source, "known");
  assert.deepEqual(tieredFee.fees, { type: "percent", percent: [0.1, 0.15] });

  const reduced = KNOWN_POOLS.find((pool) => pool.name === "Space")!;
  const reducedFee = resolvePoolFee(
    reduced,
    new Date("2025-12-25T00:00:00Z"),
    []
  );
  assert.equal(reducedFee.source, "known");
  assert.deepEqual(reducedFee.fees, { type: "percent", percent: 0 });
  assert.equal(reducedFee.temporaryReductions[0]?.percent, 0.5);
});

test("preserves legacy cost and max-percent fallback", () => {
  const pool: Pool = {
    name: "Cost test",
    color: "#000",
    address: "cost-pool",
    staking_fees: [
      {
        fees: { type: "cost", amount: 100, amount_type: "satori", per: "full_stake" },
        maxPercent: 0.2,
        until: null,
      },
    ],
  };
  const fee = resolvePoolFee(pool, DATE, []);
  const applied = applyFees({
    poolAddress: pool.address,
    date: DATE,
    fee,
    earnings_per_staking_power: 1,
    current_staked_amount: 100,
    satoriPrice: 1,
    fullStakeAmount: 100,
  });
  assert.equal(applied.type, "single");
  assert.equal(applied.result.feePercent, 0.2);
});

const SATORINET_BASE = "0xF2955d65FeaFb49D218ca53eF0f036c23C9Ac426";
const SATORINET_BASE_VAULT = "0xc429790EB40791337BE6d5c9212048CC85cD746B";

test("addressesEqual is case-insensitive for EVM and exact for Evrmore", () => {
  assert.equal(addressesEqual(SATORINET_BASE, SATORINET_BASE.toLowerCase()), true);
  assert.equal(
    addressesEqual("EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY", "ecjrjwynlxvzcgsy5nxxxmmrqvddelqrvy"),
    false
  );
  assert.equal(addressesEqual(SATORINET_BASE, SATORINET_BASE_VAULT), false);
  assert.equal(addressesEqual(undefined, undefined), false);
  assert.equal(addressesEqual("", ""), false);
});

test("findKnownPool resolves a pool from any Evrmore or Base address", () => {
  const evrWallet = "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY";
  const pool = findKnownPool(evrWallet);
  assert.equal(pool?.name, "Satorinet");
  assert.equal(findKnownPool(pool!.vault_address), pool);
  assert.equal(findKnownPool(SATORINET_BASE), pool);
  assert.equal(findKnownPool(SATORINET_BASE.toLowerCase()), pool);
  assert.equal(findKnownPool(SATORINET_BASE_VAULT.toLowerCase()), pool);
  assert.equal(findKnownPool("0x0000000000000000000000000000000000000001"), undefined);
  assert.equal(findKnownPool(undefined, null), undefined);
});

test("isSamePool links legacy Evrmore and Base addresses of one pool", () => {
  const evr = "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY";
  assert.equal(isSamePool(evr, SATORINET_BASE.toLowerCase()), true);
  assert.equal(isSamePool(SATORINET_BASE, SATORINET_BASE_VAULT), true);
  assert.equal(isSamePool(evr, "0x0000000000000000000000000000000000000001"), false);
  assert.equal(
    isSamePool("0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002"),
    false
  );
});

test("poolAddressForms covers all known addresses plus lowercase EVM forms", () => {
  const forms = poolAddressForms(SATORINET_BASE.toLowerCase());
  for (const a of [
    "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY",
    "EKKtydH4pbq86aJmiNuEVR4kP17exCcV25",
    SATORINET_BASE,
    SATORINET_BASE.toLowerCase(),
    SATORINET_BASE_VAULT,
    SATORINET_BASE_VAULT.toLowerCase(),
  ]) {
    assert.ok(forms.includes(a), a);
  }
  assert.equal(new Set(forms).size, forms.length);

  const unknown = poolAddressForms("0xABCDEF0000000000000000000000000000000001", null);
  assert.deepEqual(unknown, [
    "0xABCDEF0000000000000000000000000000000001",
    "0xabcdef0000000000000000000000000000000001",
  ]);
});

test("mergeKnownPool keeps the DB address and picks the matching vault", () => {
  const merged = mergeKnownPool({ address: SATORINET_BASE.toLowerCase() });
  assert.equal(merged.name, "Satorinet");
  assert.equal(merged.address, SATORINET_BASE.toLowerCase());
  assert.equal(merged.vault_address, SATORINET_BASE_VAULT);
  assert.equal(knownVaultFor(findKnownPool(SATORINET_BASE)!, "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY"), "EKKtydH4pbq86aJmiNuEVR4kP17exCcV25");

  const unknown = mergeKnownPool({ address: "0x0000000000000000000000000000000000000001" });
  assert.equal(unknown.name, "Unknown Pool");
});

test("audit commission matches Base rows regardless of address casing", () => {
  const rows = [
    { pool_wallet: SATORINET_BASE.toLowerCase(), pool_vault: SATORINET_BASE_VAULT, pool_commission: 20 },
  ];
  const result = getAuditCommissionForPool(rows, SATORINET_BASE, SATORINET_BASE_VAULT.toLowerCase());
  assert.deepEqual(result, { status: "valid", feePercent: 0.2 });
  // A pool known by its Evrmore address is still found in Base-era audit rows.
  assert.deepEqual(
    getAuditCommissionForPool(rows, "EcJRjWynLxVZcGSY5nXXXMmrQvddeLQRVY", "EKKtydH4pbq86aJmiNuEVR4kP17exCcV25"),
    { status: "valid", feePercent: 0.2 }
  );
});
