import assert from "node:assert/strict";
import { test } from "node:test";
import { address as bitcoinAddress } from "bitcoinjs-lib";
import { getScriptHash } from "../lib/evr";
import type { Pool } from "../lib/known_pools";
import { normalizePoolAddress, parsePoolNameIndex, poolNameIndexKey } from "../lib/pool-name-index";
import { buildPoolNameIndex, type PoolNameIndexInput } from "./pool-name-index-builder";

const DAY = "2026-11-26";
const BUILT_AT = "2026-11-27T00:00:00.000Z";
const hex = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const evr = (c: string, version = 0x21) =>
  bitcoinAddress.toBase58Check(new Uint8Array(20).fill(c.charCodeAt(0)), version);

const base: PoolNameIndexInput = {
  day: DAY,
  builtAt: BUILT_AT,
  auditRows: [],
  dbPairs: [],
  links: [],
  registryRows: [],
  curatedPools: [],
};
const build = (input: Partial<PoolNameIndexInput>) =>
  buildPoolNameIndex({ ...base, ...input });
function names(input: Partial<PoolNameIndexInput>) {
  const result = build(input);
  assert.ok(result.ok, result.ok ? "" : result.reason);
  return result.index.names;
}
const curated = (name: string, address: string, url?: string): Pool => ({
  name,
  color: "#000",
  address,
  url,
});
const link = (evm: string, evrAddr: string, kind = "wallet", confidence = "certain") => ({
  evm_address: evm,
  evr_address: evrAddr,
  kind,
  confidence,
});

test("cycle with duplicate and self edges terminates and labels alias, wallet and vault across chains", () => {
  const [alias, wallet, vault] = [hex(1), hex(2), hex(3)];
  const [evrWallet, evrVault] = [evr("W"), evr("V", 0x5c)];
  const result = names({
    curatedPools: [curated("Cyc", evrWallet)],
    auditRows: [
      { pool_alias: alias, pool_wallet: wallet },
      { pool_alias: alias.toUpperCase().replace("0X", "0x"), pool_wallet: wallet },
      { pool_alias: wallet, pool_wallet: alias },
      { pool_alias: wallet, pool_wallet: alias },
      { pool_alias: vault, pool_wallet: vault },
    ],
    dbPairs: [
      { pool_address: alias, pool_vault: vault },
      { pool_address: vault, pool_vault: vault },
    ],
    links: [link(wallet, evrWallet), link(vault, evrVault, "vault"), link(vault, evrVault, "vault")],
  });
  assert.deepEqual(result, {
    [alias]: "Cyc",
    [wallet]: "Cyc",
    [vault]: "Cyc",
    [evrWallet]: "Cyc",
    [evrVault]: "Cyc",
  });
});

test("two different names suppress the whole component; case/trim differences are one name", () => {
  const [a, b, c] = [hex(1), hex(2), hex(3)];
  const auditRows = [
    { pool_alias: a, pool_wallet: b },
    { pool_alias: c, pool_wallet: b },
  ];
  assert.deepEqual(
    names({
      auditRows,
      registryRows: [
        { address: a, pool_name: "Alpha" },
        { address: c, pool_name: "Beta" },
      ],
    }),
    { [a]: null, [b]: null, [c]: null }
  );
  assert.deepEqual(
    names({
      auditRows,
      registryRows: [
        { address: a, pool_name: "  alpha " },
        { address: c, pool_name: "ALPHA" },
      ],
    }),
    { [a]: "ALPHA", [b]: "ALPHA", [c]: "ALPHA" }
  );
});

test("curated wording wins; domain name counts only on the curated pool's own address", () => {
  const own = hex(1);
  const other = hex(2);
  const pools = [curated("Synapool", own, "https://www.synapool.com/")];
  assert.deepEqual(
    names({ curatedPools: pools, registryRows: [{ address: own, pool_name: "synapool.com" }] }),
    { [own]: "Synapool" }
  );
  assert.deepEqual(
    names({ curatedPools: pools, registryRows: [{ address: other, pool_name: "synapool.com" }] }),
    { [own]: "Synapool", [other]: "synapool.com" }
  );
});

test("pool_reward, probable links, equal names and blank/malformed/zero addresses create no edges", () => {
  const [a, b, c, d] = [hex(1), hex(2), hex(3), hex(4)];
  const rows = [{ pool_alias: a, pool_wallet: b, pool_reward: hex(9) }];
  const result = names({
    auditRows: [...rows, { pool_alias: c, pool_wallet: d, pool_reward: hex(9) }],
    links: [link(a, evr("P"), "wallet", "probable"), link(c, evr("Q"), "reward")],
    registryRows: [
      { address: evr("P"), pool_name: "Named" },
      { address: evr("Q"), pool_name: "Named" },
      { address: hex(0), pool_name: "Zero" },
      { address: "0xnope", pool_name: "Bad" },
      { address: "", pool_name: "Blank" },
      { address: evr("R"), pool_name: "   " },
    ],
  });
  assert.deepEqual(result, { [evr("P")]: "Named", [evr("Q")]: "Named" });
});

test("competing alias wallets and competing vaults drop only the disputed edges and null the address", () => {
  const [alias, w1, w2, vault, other] = [hex(1), hex(2), hex(3), hex(4), hex(5)];
  assert.deepEqual(
    names({
      auditRows: [
        { pool_alias: alias, pool_wallet: w1 },
        { pool_alias: alias, pool_wallet: w2 },
        { pool_alias: other, pool_wallet: w1 },
      ],
      dbPairs: [{ pool_address: alias, pool_vault: vault }],
      registryRows: [
        { address: w1, pool_name: "One" },
        { address: vault, pool_name: "Vaulted" },
      ],
    }),
    { [alias]: null, [vault]: "Vaulted", [w1]: "One", [other]: "One" }
  );

  const v2 = hex(6);
  assert.deepEqual(
    names({
      dbPairs: [
        { pool_address: alias, pool_vault: vault },
        { pool_address: alias, pool_vault: v2 },
        { pool_address: other, pool_vault: vault },
      ],
      registryRows: [{ address: vault, pool_name: "Vaulted" }],
    }),
    { [alias]: null, [vault]: "Vaulted", [other]: "Vaulted" }
  );
});

test("a blank observation disagrees with a vault; competing cross-chain links are dropped", () => {
  const [a, v] = [hex(1), hex(2)];
  assert.deepEqual(
    names({
      dbPairs: [
        { pool_address: a, pool_vault: v },
        { pool_address: a, pool_vault: "" },
      ],
      registryRows: [{ address: v, pool_name: "Vaulted" }],
    }),
    { [a]: null, [v]: "Vaulted" }
  );
  // Neither cross-chain link is trusted, but the independent legacy name is preserved.
  assert.deepEqual(
    names({
      links: [link(a, evr("A")), link(a, evr("B"))],
      registryRows: [{ address: evr("A"), pool_name: "Legacy" }],
    }),
    { [a]: null, [evr("A")]: "Legacy" }
  );
  // A disputed address stays null even when another trusted edge reaches a named component.
  const [alias, wallet, v1, v2] = [hex(10), hex(11), hex(12), hex(13)];
  assert.deepEqual(
    names({
      auditRows: [{ pool_alias: alias, pool_wallet: wallet }],
      dbPairs: [
        { pool_address: alias, pool_vault: v1 },
        { pool_address: alias, pool_vault: v2 },
      ],
      registryRows: [{ address: wallet, pool_name: "Wallet Pool" }],
    }),
    { [alias]: null, [wallet]: "Wallet Pool" }
  );
});

test("shared vault edges require independent wallet evidence and preserve unrelated names", () => {
  const [a, b, vault, wallet, other] = [hex(1), hex(2), hex(3), hex(4), hex(5)];
  const dbPairs = [
    { pool_address: a, pool_vault: vault },
    { pool_address: b, pool_vault: vault },
  ];
  const registryRows = [{ address: a, pool_name: "Named" }];
  assert.deepEqual(names({ dbPairs, registryRows }), { [a]: "Named", [b]: null, [vault]: null });
  assert.deepEqual(
    names({ dbPairs, registryRows: [...registryRows, { address: b, pool_name: "Independent" }] }),
    { [a]: "Named", [b]: "Independent", [vault]: null }
  );
  assert.deepEqual(
    names({ dbPairs, registryRows: [...registryRows, { address: b, pool_name: "Named" }] }),
    { [a]: "Named", [b]: "Named", [vault]: null }
  );
  const auditRows = [
    { pool_alias: a, pool_wallet: wallet },
    { pool_alias: b, pool_wallet: wallet },
  ];
  assert.deepEqual(names({ dbPairs, auditRows, registryRows }), {
    [a]: "Named", [b]: "Named", [wallet]: "Named", [vault]: "Named",
  });
  assert.deepEqual(names({
    dbPairs,
    auditRows: [...auditRows, { pool_alias: b, pool_wallet: other }],
    registryRows,
  }), { [a]: "Named", [b]: null, [wallet]: "Named", [vault]: null });
  assert.deepEqual(names({
    dbPairs,
    auditRows: [{ pool_alias: a, pool_wallet: vault }, { pool_alias: vault, pool_wallet: b }],
    registryRows,
  }), { [a]: "Named", [b]: null, [vault]: null });
});

test("two direct audit aliases can share Synapool's pinned wallet as their DB vault", () => {
  const [a, b] = [hex(1), hex(2)];
  const wallet = "0x8656a54b5570d77d2da7ccc1bc3e927c993def3e";
  const input = {
    day: DAY,
    builtAt: BUILT_AT,
    auditRows: [a, b].map((pool_alias) => ({ pool_alias, pool_wallet: wallet })),
    dbPairs: [a, b].map((pool_address) => ({ pool_address, pool_vault: wallet })),
    links: [],
    registryRows: [],
  };
  const result = buildPoolNameIndex(input);
  assert.ok(result.ok);
  assert.deepEqual([a, b, wallet].map((address) => result.index.names[address]), ["Synapool", "Synapool", "Synapool"]);

  // If the shared target itself resolves elsewhere, it is not the exact wallet.
  assert.deepEqual(names({
    ...input,
    auditRows: [...input.auditRows, { pool_alias: wallet, pool_wallet: hex(3) }],
    curatedPools: [curated("Synapool", wallet)],
  }), { [a]: null, [b]: null, [wallet]: null });
});

test("shared-vault ownership cannot be established through another disputed vault", () => {
  const [a, b, c, d, v1, v2] = [hex(1), hex(2), hex(3), hex(4), hex(5), hex(6)];
  assert.deepEqual(names({
    dbPairs: [
      { pool_address: a, pool_vault: v1 }, { pool_address: b, pool_vault: v1 },
      { pool_address: c, pool_vault: v2 }, { pool_address: d, pool_vault: v2 },
    ],
    auditRows: [{ pool_alias: a, pool_wallet: v2 }, { pool_alias: v2, pool_wallet: b }],
    registryRows: [{ address: a, pool_name: "Named" }],
  }), { [a]: "Named", [b]: null, [c]: null, [d]: null, [v1]: null, [v2]: null });
});

test("shared-vault ownership cannot be established through another wallet alias", () => {
  const [a, b, vault, alias, wallet] = [hex(1), hex(2), hex(3), hex(4), hex(5)];
  const dbPairs = [{ pool_address: a, pool_vault: vault }, { pool_address: b, pool_vault: vault }];
  const auditRows = [
    { pool_alias: a, pool_wallet: alias }, { pool_alias: b, pool_wallet: alias },
    { pool_alias: alias, pool_wallet: wallet },
  ];
  assert.equal(names({ dbPairs, auditRows })[vault], null);
});

test("a disputed vault cannot relay names via cross-chain links or its own vault claim", () => {
  const [a, b, v1, v2, wallet] = [hex(1), hex(2), hex(3), hex(4), hex(5)];
  const counterpart = evr("V", 0x5c);
  assert.deepEqual(names({
    dbPairs: [
      { pool_address: a, pool_vault: v1 }, { pool_address: b, pool_vault: v1 },
      { pool_address: v1, pool_vault: v2 },
    ],
    auditRows: [{ pool_alias: a, pool_wallet: v1 }, { pool_alias: b, pool_wallet: wallet }],
    links: [link(v1, counterpart, "vault")],
    registryRows: [
      { address: counterpart, pool_name: "Counterpart" }, { address: v2, pool_name: "Other Vault" },
      { address: wallet, pool_name: "Independent" },
    ],
  }), {
    [a]: null, [b]: "Independent", [v1]: null, [v2]: "Other Vault",
    [wallet]: "Independent", [counterpart]: "Counterpart",
  });
  assert.deepEqual(names({
    dbPairs: [{ pool_address: a, pool_vault: v1 }],
    auditRows: [
      { pool_alias: a, pool_wallet: v1 },
      { pool_alias: v1, pool_wallet: wallet }, { pool_alias: v1, pool_wallet: v2 },
    ],
    registryRows: [{ address: v1, pool_name: "Disputed" }],
  }), { [a]: null, [v1]: null });
});

test("opposite-chain vault links cannot serve as independent wallet evidence", () => {
  const [a, vault] = [hex(1), hex(2)];
  const b = evr("B");
  const dbPairs = [{ pool_address: a, pool_vault: vault }, { pool_address: b, pool_vault: vault }];
  const registryRows = [{ address: a, pool_name: "Named" }];
  assert.deepEqual(names({ dbPairs, registryRows, links: [link(a, b, "vault")] }), {
    [a]: "Named", [b]: "Named", [vault]: null,
  });
  assert.deepEqual(names({ dbPairs, registryRows, links: [link(a, b, "wallet")] }), {
    [a]: "Named", [b]: "Named", [vault]: "Named",
  });
  assert.equal(names({ dbPairs, registryRows, links: [link(a, b), link(a, b, "vault")] })[vault], null);
  assert.deepEqual(names({ dbPairs, registryRows, links: [link(a, b), link(a, evr("V", 0x5c), "vault")] }), {
    [a]: null, [b]: null, [vault]: null,
  });
  assert.deepEqual(names({ dbPairs, registryRows, links: [link(a, b, "wallet", "probable")] }), {
    [a]: "Named", [b]: null, [vault]: null,
  });
});

test("cross-chain counterparts must agree across roles on both ends; identical pairs are allowed", () => {
  const [a, b] = [hex(1), hex(2)];
  const [wallet, vault] = [evr("W"), evr("V", 0x5c)];
  assert.deepEqual(names({
    links: [link(a, wallet), link(a, vault, "vault")],
    registryRows: [{ address: wallet, pool_name: "Wallet" }, { address: vault, pool_name: "Vault" }],
  }), { [a]: null, [wallet]: "Wallet", [vault]: "Vault" });
  assert.deepEqual(names({
    links: [link(a, wallet), link(b, wallet, "vault")],
    registryRows: [{ address: a, pool_name: "One" }, { address: b, pool_name: "Two" }],
  }), { [a]: "One", [b]: "Two", [wallet]: null });
  assert.deepEqual(names({
    links: [link(a, vault), link(a, vault, "vault")],
    registryRows: [{ address: a, pool_name: "One" }],
  }), { [a]: "One", [vault]: "One" });
});

test("Evrmore address keys require a valid checksum and network version without changing case", () => {
  const wallet = evr("W");
  const vault = evr("V", 0x5c);
  const badChecksum = wallet.slice(0, -1) + (wallet.endsWith("1") ? "2" : "1");
  const wrongVersion = evr("A", 0x22);
  assert.match(wallet, /^E/);
  assert.match(vault, /^e/);
  assert.match(wrongVersion, /^E/);
  for (const address of [wallet, vault]) {
    assert.doesNotThrow(() => getScriptHash(address));
    assert.equal(normalizePoolAddress(address), address);
  }
  const result = build({
    registryRows: [wallet, vault, badChecksum, wrongVersion].map((address) => ({ address, pool_name: "Name" })),
  });
  assert.ok(result.ok);
  assert.deepEqual(result.index.names, { [wallet]: "Name", [vault]: "Name" });
  assert.deepEqual(parsePoolNameIndex(result.index, DAY), result.index);
  for (const address of [badChecksum, wrongVersion]) {
    assert.equal(parsePoolNameIndex({ ...result.index, names: { [address]: "Name" } }), null);
  }
});

test("results do not depend on input order", () => {
  const input: Partial<PoolNameIndexInput> = {
    auditRows: [1, 2, 3, 4].map((i) => ({ pool_alias: hex(i), pool_wallet: hex(i + 1) })),
    dbPairs: [{ pool_address: hex(1), pool_vault: hex(9) }],
    links: [link(hex(9), evr("X"), "vault")],
    registryRows: [
      { address: evr("X"), pool_name: "Order" },
      { address: hex(5), pool_name: "order" },
    ],
  };
  const forward = build(input);
  const reversed = build({
    auditRows: [...input.auditRows!].reverse(),
    dbPairs: [...input.dbPairs!].reverse(),
    links: [...input.links!].reverse(),
    registryRows: [...input.registryRows!].reverse(),
  });
  assert.ok(forward.ok && reversed.ok);
  assert.equal(JSON.stringify(forward.index.names), JSON.stringify(reversed.index.names));
  assert.equal(Object.keys(forward.index.names).length, 7);
});

test("caps fail instead of truncating; oversized components are quarantined", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
  const failure = (input: Partial<PoolNameIndexInput>) => {
    const r = build(input);
    return r.ok ? "ok" : r.reason;
  };
  assert.equal(failure({ day: "2026-02-31" }), "invalid_day");
  assert.equal(failure({ builtAt: "nope" }), "invalid_built_at");
  assert.equal(
    failure({ auditRows: rows(20_001).map(() => ({ pool_alias: null, pool_wallet: null })) }),
    "too_many_audit_rows"
  );
  assert.equal(failure({ registryRows: rows(513).map(() => ({ address: "" })) }), "too_many_registry_rows");
  assert.equal(
    failure({ dbPairs: rows(4_097).map(() => ({ pool_address: null, pool_vault: null })) }),
    "too_many_db_pairs"
  );
  assert.equal(failure({ links: rows(4_097).map(() => link("", "")) }), "too_many_links");
  assert.equal(
    failure({ auditRows: rows(4_100).map((i) => ({ pool_alias: hex(i), pool_wallet: hex(i + 10_000) })) }),
    "too_many_nodes"
  );
  // 64 aliases + their wallet make 65 members, over the 64 cap: every member becomes null.
  const wallet = hex(100_000);
  const big = names({
    auditRows: rows(64).map((i) => ({ pool_alias: hex(i), pool_wallet: wallet })),
    registryRows: [{ address: wallet, pool_name: "Big" }],
  });
  assert.equal(Object.keys(big).length, 65);
  assert.ok(Object.values(big).every((v) => v === null));
  const fits = names({
    auditRows: rows(63).map((i) => ({ pool_alias: hex(i), pool_wallet: wallet })),
    registryRows: [{ address: wallet, pool_name: "Big" }],
  });
  assert.ok(Object.values(fits).every((v) => v === "Big"));
});

test("a payload over 128 KiB fails instead of publishing", () => {
  const pools = Array.from({ length: 1_200 }, (_, i) => curated("n".repeat(78) + (i % 10), hex(i + 1)));
  const big = build({ curatedPools: pools });
  assert.deepEqual(big, { ok: false, reason: "index_too_large" });
});

test("Nov 26 fixture names four pools automatically and leaves the reward-sharing alias unnamed", () => {
  const nam = { alias: "0xbB28Ce614addF0C80Cfd860fb0138a32A545f4Db", wallet: "0x2FadEe6Bab6d8D51DA45B9952348ABfc1e0B5f3D" };
  const kube = { alias: "0xefDDC297F1a6b12416cCBc46e7f91D24d36C4638", wallet: "0x3bCABA7c82Bc69be55941c992374bc17934A7111" };
  const syna = { alias: "0xedEff04f1B58bA671d0ce7a21992c0a18Fe51752", wallet: "0x8656A54B5570d77D2DA7CCC1bc3E927C993DEF3E" };
  const sato = { alias: "0xF2955d65FeaFb49D218ca53eF0f036c23C9Ac426", wallet: "0xc429790EB40791337BE6d5c9212048CC85cD746B" };
  const unnamed = { alias: "0x7eA9218b909eE7379b5EAB3fdB7dCE4e09770620", wallet: hex(0xabc) };
  const sharedReward = "0x1111111111111111111111111111111111111111";
  const pools = [nam, kube, syna, sato, unnamed];

  const result = buildPoolNameIndex({
    day: DAY,
    builtAt: BUILT_AT,
    // Rewards are present in the raw audit but must never be read.
    auditRows: pools.map((p) => ({ pool_alias: p.alias, pool_wallet: p.wallet, pool_reward: sharedReward })),
    dbPairs: pools.map((p) => ({ pool_address: p.alias, pool_vault: p.wallet })),
    links: [],
    registryRows: [
      { address: nam.wallet, pool_name: "Namaste Club" },
      { address: kube.wallet, pool_name: "kube2" },
      { address: syna.wallet, pool_name: "synapool.com" },
      { address: sato.wallet, pool_name: "satorinet-pools.com" },
    ],
  });
  assert.ok(result.ok);
  const { names: out } = result.index;
  const lower = (a: string) => a.toLowerCase();
  for (const [p, name] of [[nam, "Namaste Club"], [kube, "kube2"], [syna, "Synapool"], [sato, "Satorinet"]] as const) {
    assert.equal(out[lower(p.alias)], name);
    assert.equal(out[lower(p.wallet)], name);
  }
  assert.equal(out[lower(unnamed.alias)], undefined);
  assert.equal(out[lower(unnamed.wallet)], undefined);
});

test("index payload round-trips through the validator and rejects foreign shapes", () => {
  const a = hex(1);
  const result = build({ registryRows: [{ address: a, pool_name: "X" }, { address: hex(2), pool_name: "X" }] });
  assert.ok(result.ok);
  const wire = JSON.parse(JSON.stringify(result.index));
  assert.deepEqual(parsePoolNameIndex(wire, DAY), result.index);
  assert.equal(parsePoolNameIndex(wire, "2026-11-25"), null);
  assert.equal(parsePoolNameIndex({ ...wire, names: { [a.toUpperCase()]: "X" } }), null);
  assert.equal(parsePoolNameIndex({ ...wire, names: { [a]: "" } }), null);
  assert.equal(parsePoolNameIndex({ ...wire, extra: 1 }), null);
  assert.deepEqual(parsePoolNameIndex({ ...wire, names: { [a]: null } })?.names, { [a]: null });
  assert.equal(poolNameIndexKey(DAY), "satorinet:pool-names:v1:2026-11-26");
});
