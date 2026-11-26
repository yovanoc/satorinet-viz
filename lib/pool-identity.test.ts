import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPoolIdentities, findPoolIdentity, identityAddressForms } from "./pool-identity";
import { resolvePoolFee } from "./pool-utils";
import type { Pool } from "./known_pools";

const base = "0x1111111111111111111111111111111111111111";
const baseVault = "0x2222222222222222222222222222222222222222";
const pool: Pool = { name: "Test", color: "#000", address: "evr-wallet", vault_address: "evr-vault" };

test("network records connect both wallets and their own vaults", () => {
  const ids = buildPoolIdentities([pool], new Map([[pool.address, base]]), new Map([[pool.address, ["evr-vault"]], [base, [baseVault]]]));
  assert.equal(findPoolIdentity(ids, base.toUpperCase().replace("0X", "0x"))?.pool, pool);
  assert.equal(findPoolIdentity(ids, "evr-wallet")?.pool, pool);
  assert.deepEqual(new Set(identityAddressForms(ids, base)), new Set([base, baseVault, "evr-wallet", "evr-vault"]));
});

test("missing or conflicting links never invent a pairing", () => {
  const missing = buildPoolIdentities([pool], new Map(), new Map([[base, [baseVault]]]));
  assert.equal(findPoolIdentity(missing, base), undefined);
  assert.equal(identityAddressForms(missing, pool.address).includes(baseVault), false);
  const conflict = buildPoolIdentities([pool], new Map([[pool.address, base], ["other-wallet", base]]), new Map([[base, [baseVault]]]));
  assert.equal(findPoolIdentity(conflict, base), undefined);
  assert.equal(findPoolIdentity(conflict, baseVault), undefined);
  const sharedVault = buildPoolIdentities([pool], new Map([[pool.address, base]]), new Map([[base, [baseVault]], ["other-wallet", [baseVault]]]));
  assert.equal(findPoolIdentity(sharedVault, base), undefined);
  const staticVaultConflict = buildPoolIdentities([pool], new Map([[pool.address, base]]), new Map([["other-wallet", ["evr-vault"]]]));
  assert.equal(findPoolIdentity(staticVaultConflict, base), undefined);
  const staticBaseConflict = buildPoolIdentities([{ ...pool, base_address: base }], new Map([[pool.address, baseVault]]), new Map());
  assert.equal(findPoolIdentity(staticBaseConflict, baseVault), undefined);
});

test("dynamic identity does not change fee audit matching", () => {
  const result = resolvePoolFee({ address: base }, new Date("2026-01-01"), [{ pool_wallet: pool.address, pool_vault: null, pool_commission: 5 }]);
  assert.equal(result.source, "unknown");
  assert.match(result.warning!, /no audit rows for this pool/);
});
