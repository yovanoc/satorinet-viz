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
