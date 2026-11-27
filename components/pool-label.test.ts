import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TopPools from "./top-pools";
import { PoolReturnsTable } from "./pools/pool-returns-table";
import { poolDisplayName, resolvePoolFee } from "../lib/pool-utils";

test("same-day vault decorates both pool displays without changing the wallet link", () => {
  const address = "0xedEff04f1B58bA671d0ce7a21992c0a18Fe51752";
  const label_vault = "0x8656a54b5570d77d2da7ccc1bc3e927c993def3e";
  const date = new Date("2026-11-26T00:00:00Z");
  const top = renderToStaticMarkup(createElement(TopPools, {
    pools: [{ pool_address: address, label_vault, total_staking_power: 3, contributor_count: 1 }], date,
  }));
  assert.match(top, /Synapool/);
  assert.ok(top.includes(`/address/${address}`));
  const returns = renderToStaticMarkup(createElement(PoolReturnsTable, {
    series: [{ address, name: poolDisplayName(address, label_vault) ?? "Unknown Pool",
      days: [{ date: "2026-11-26", eps: 0.001, fee: resolvePoolFee({ address }, date, null) }] }],
    satoriPrice: 0.18, fullStakeAmount: 1500,
  }));
  assert.match(returns, /Synapool/);
  assert.match(returns, /Unverified/);
});


test("both tables build verified labels without altering links, metrics or fee warnings", async () => {
  process.env.DATABASE_URL = "postgres://localhost/test";
  process.env.REDIS_URL = "redis://localhost:1";
  process.env.LIVECOINWATCH_API_KEY = "test";
  const { buildPoolReturnSeries } = await import("./pools/pool-returns");
  const { redis } = await import("../lib/redis");
  redis.disconnect();
  const date = new Date("2026-11-26T00:00:00Z");
  const fixtures = [
    { address: "0xbB28Ce614addF0C80Cfd860fb0138a32A545f4Db", label_vault: "0x2FadEe6Bab6d8D51DA45B9952348ABfc1e0B5f3D", name: "Namaste Club" },
    { address: "0xefDDC297F1a6b12416cCBc46e7f91D24d36C4638", label_vault: "0x3bCABA7c82Bc69be55941c992374bc17934A7111", name: "kube2" },
  ];
  const top = renderToStaticMarkup(createElement(TopPools, { date, pools: fixtures.map((p, i) => ({ pool_address: p.address, label_vault: p.label_vault, total_staking_power: 300 + i, contributor_count: 10 + i })) }));
  for (const p of fixtures) {
    assert.ok(top.includes(p.name));
    assert.ok(top.includes(`/address/${p.address}`));
  }
  assert.ok(top.indexOf(fixtures[0]!.name) < top.indexOf(fixtures[1]!.name));
  for (const value of ["300", "301", "10", "11"]) assert.ok(top.includes(`>${value}<`));
  const feeSnapshots = { "2026-11-26": Object.fromEntries(fixtures.map(({ address }) => [address, resolvePoolFee({ address }, date, null)])) };
  const earnings = fixtures.map(({ address }) => ({ pool: { address, name: "Unknown Pool" }, data: [{ date: "2026-11-26", earnings_per_staking_power: 0.001 }] }));
  const series = buildPoolReturnSeries(earnings, fixtures, feeSnapshots);
  assert.deepEqual(series.map(({ address, name, days }) => ({ address, name, eps: days[0]?.eps, fee: days[0]?.fee })), fixtures.map(({ address, name }) => ({ address, name, eps: 0.001, fee: feeSnapshots["2026-11-26"][address] })));
  const returns = renderToStaticMarkup(createElement(PoolReturnsTable, { series, satoriPrice: 0.18, fullStakeAmount: 1500 }));
  for (const p of fixtures) {
    assert.ok(returns.includes(p.name));
    assert.ok(returns.includes(`/pools/single?pool=${p.address}`));
  }
  assert.match(returns, /Unverified/);
});
