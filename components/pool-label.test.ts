import assert from "node:assert/strict";
import { createRequire, Module } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server";
import type { Pool } from "../lib/known_pools";
import type { PoolNameIndex } from "../lib/pool-name-index";
import { resolvePoolFee, type FeePool } from "../lib/pool-utils";
import { buildPoolNameIndex } from "../scripts/pool-name-index-builder";

const require = createRequire(import.meta.url);

const address = "0xedEff04f1B58bA671d0ce7a21992c0a18Fe51752";
const aliasAddress = "0xAbCd000000000000000000000000000000000001";
const labelVault = "0x8656a54b5570d77d2da7ccc1bc3e927c993def3e";
const selectedDay = "2026-11-26";
const requestedDay = "2026-11-27";
const selectedDate = new Date(`${selectedDay}T00:00:00Z`);
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

function tables(html: string) {
  const result = html.match(/<table\b[\s\S]*?<\/table>/g) ?? [];
  assert.equal(result.length, 2);
  return result;
}

test("both pool tables share the selected-day name index without changing financial inputs", async (t) => {
  // Stub network/DB boundaries before loading the actual page and table components.
  function mockModule(id: string, exports: object) {
    const path = require.resolve(id);
    const original = require.cache[path];
    require.cache[path] = Object.assign(new Module(path), { loaded: true, exports });
    t.after(() => {
      if (original) require.cache[path] = original;
      else delete require.cache[path];
    });
  }

  t.mock.timers.enable({ apis: ["Date"], now: new Date(`${requestedDay}T12:00:00Z`) });
  const indexMiss = Promise.withResolvers<PoolNameIndex["names"] | undefined>();
  let index = indexMiss.promise;
  const readIndex = t.mock.fn((_day: string) => index);
  mockModule("../lib/pool-name-index-server", { readPoolNameIndex: readIndex });

  const rows = [
    { pool_address: address, label_vault: labelVault, total_staking_power: 30, contributor_count: 2 },
    { pool_address: aliasAddress, label_vault: null, total_staking_power: 20, contributor_count: 1 },
  ];
  let hasData = true;
  mockModule("../lib/db/queries/contributors", {
    getTopPools: async (date: Date) => hasData && dayKey(date) === selectedDay ? rows : [],
  });
  mockModule("../lib/evr/wallet-vault", { getVaultsForWallet: async () => [] });
  mockModule("../lib/db/cache-utils", { cacheLifeForDate: () => {} });

  const financialStarted = Promise.withResolvers<void>();
  const getEarnings = t.mock.fn(async (pools: Pool[], _date: Date, _days: number) => {
    financialStarted.resolve();
    return pools.map((pool, i) => ({ pool, data: [{ date: selectedDay, earnings_per_staking_power: 0.001 / (i + 1) }] }));
  });
  const getFees = t.mock.fn(async (pools: FeePool[], dates: Date[]) => Object.fromEntries(
    dates.map((date) => [dayKey(date), Object.fromEntries(
      pools.map((pool) => [pool.address, resolvePoolFee(pool, date, null)])
    )])
  ));
  mockModule("../lib/db/queries/pools/historical-earnings", { getPoolsHistoricalEarnings: getEarnings });
  mockModule("../lib/db/queries/pools/fees", { feeDateKey: dayKey, getPoolFeeSnapshots: getFees });
  mockModule("../lib/db/queries/predictors/max-delegated-stake", { getMaxDelegatedStake: async () => 1500 });
  mockModule("../lib/livecoinwatch", { getSatoriPriceForDateSafe: async () => 0.18 });
  const getLivePools = t.mock.fn(async () => [{
    address: aliasAddress.toLowerCase(), alias: "Live Alias", commission: 0.21,
    worker_count: 8, active_workers: 7, lender_count: 6, total_lent: 5,
    avg_worker_earnings: 0.04, version: "test-live",
  }]);
  mockModule("../lib/satorinet/api", { getLivePools });
  mockModule("../components/pools/pools-staking-comparison", { PoolsStakingComparison: () => null });
  mockModule("../components/section-cards-pools", { SectionCardsPools: () => null });
  mockModule("../components/date-picker-wrapper", { __esModule: true, default: () => null });

  const { default: PoolsPage } = await import("../app/pools/page");
  async function renderPage() {
    const page = await PoolsPage({ searchParams: Promise.resolve({ date: requestedDay }) });
    const stream = await renderToReadableStream(createElement(() => page));
    await stream.allReady;
    return (await new Response(stream).text()).replaceAll("<!-- -->", "");
  }

  const pending = renderPage();
  await Promise.race([financialStarted.promise, pending.then(() => assert.fail("Returns did not load"))]);
  assert.equal(readIndex.mock.callCount(), 1);
  assert.deepEqual(readIndex.mock.calls[0]?.arguments, [selectedDay]);
  indexMiss.resolve(undefined);

  const miss = await pending;
  assert.match(miss, /No data for 2026-11-27 yet/);
  const fallbackTables = tables(miss);
  for (const table of fallbackTables) {
    assert.match(table, /Synapool/);
    assert.match(table, /Unknown Pool/);
  }
  assert.equal(getLivePools.mock.callCount(), 0);
  assert.ok(fallbackTables[0]!.includes(`href="/address/${address}"`));
  assert.ok(fallbackTables[1]!.includes(`href="/pools/single?pool=${address}"`));
  assert.match(fallbackTables[1]!, /Unverified/);
  assert.match(fallbackTables[1]!, /no configured pool fee; fee is not verified/);

  index = Promise.resolve({ [address.toLowerCase()]: "Indexed Name" });
  const warmTables = tables(await renderPage());
  assert.equal(readIndex.mock.callCount(), 2);
  assert.deepEqual(readIndex.mock.calls[1]?.arguments, [selectedDay]);
  assert.deepEqual(warmTables, fallbackTables.map((table) => table.replace("Synapool", "Indexed Name")));
  const financialPools = [address, aliasAddress].map((address) => ({ address, name: "Unknown Pool", color: "#888", vault_address: undefined }));
  assert.deepEqual(getEarnings.mock.calls.map((call) => call.arguments), [
    [financialPools, selectedDate, 90], [financialPools, selectedDate, 90],
  ]);
  assert.deepEqual(getFees.mock.calls.map((call) => call.arguments), [
    [financialPools, [selectedDate]], [financialPools, [selectedDate]],
  ]);

  t.mock.timers.setTime(selectedDate.getTime());
  index = Promise.resolve(undefined);
  const liveTables = tables(await renderPage());
  assert.match(liveTables[0]!, /Live Alias/);
  assert.match(liveTables[0]!, /21\.0%/);
  assert.doesNotMatch(liveTables[1]!, /Live Alias/);

  const disputedIndex = buildPoolNameIndex({
    day: selectedDay,
    builtAt: `${selectedDay}T00:00:00Z`,
    curatedPools: [],
    registryRows: [],
    auditRows: [],
    links: [],
    dbPairs: [
      { pool_address: address, pool_vault: labelVault },
      { pool_address: address, pool_vault: null },
      { pool_address: aliasAddress, pool_vault: labelVault },
      { pool_address: aliasAddress, pool_vault: null },
    ],
  });
  assert.ok(disputedIndex.ok);
  index = Promise.resolve(disputedIndex.index.names);
  const conflictTables = tables(await renderPage());
  assert.deepEqual(conflictTables, [
    liveTables[0]!.replace("Synapool", "Unknown Pool").replace("Live Alias", "Unknown Pool"),
    liveTables[1]!.replace("Synapool", "Unknown Pool"),
  ]);
  assert.equal(getLivePools.mock.callCount(), 2);

  rows[1]!.label_vault = labelVault;
  for (const independentName of [undefined, "Independent Pool"]) {
    const sharedIndex = buildPoolNameIndex({
      day: selectedDay,
      builtAt: `${selectedDay}T00:00:00Z`,
      registryRows: independentName ? [{ address, pool_name: independentName }] : [],
      auditRows: [],
      links: [],
      dbPairs: rows.map(({ pool_address, label_vault }) => ({ pool_address, pool_vault: label_vault })),
    });
    assert.ok(sharedIndex.ok);
    index = Promise.resolve(sharedIndex.index.names);
    const labels = tables(await renderPage()).map((table) =>
      [...table.matchAll(/>(Synapool|Unknown Pool|Independent Pool|Live Alias)</g)].map((match) => match[1])
    );
    const expected = [independentName ?? "Unknown Pool", "Unknown Pool"];
    assert.deepEqual(labels, [expected, expected]);
  }
  assert.deepEqual(readIndex.mock.calls.map((call) => call.arguments), Array.from({ length: 6 }, () => [selectedDay]));

  hasData = false;
  assert.match(await renderPage(), /No pool data for this day/);
  assert.equal(readIndex.mock.callCount(), 6);
});
