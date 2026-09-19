import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoolReturnsTable } from "./pools/pool-returns-table";
import { KNOWN_POOLS } from "../lib/known_pools";
import { resolvePoolFee } from "../lib/pool-utils";

test("pool return rows visibly warn when audit fees are unavailable", () => {
  for (const pool of [KNOWN_POOLS[0]!, { address: "unknown-pool", name: "Unknown" }]) {
    const fee = resolvePoolFee(pool, new Date("2026-09-19T00:00:00Z"), null);
    const html = renderToStaticMarkup(createElement(PoolReturnsTable, {
      series: [{ address: pool.address, name: pool.name,
        days: [{ date: "2026-09-19", eps: 0.001, fee }] }],
      satoriPrice: 0.18,
      fullStakeAmount: 1500,
    }));
    assert.ok(fee.warning);
    assert.ok(html.includes(fee.warning), "Fallback warning must be visible in the rendered row");
    if (fee.source === "unknown") assert.ok(html.includes("Unverified"));
  }
});
