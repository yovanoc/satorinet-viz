import { strict as assert } from "node:assert";
import { test } from "node:test";

import { classifyAssetHolders } from "./holders";

test("classifying no holders returns finite zero percentages", () => {
  const summary = classifyAssetHolders([]);

  assert.equal(summary.totalSatori, 0);
  for (const tier of Object.values(summary.tiers)) {
    assert.equal(tier.percentAmount, 0);
    assert.equal(tier.percentCount, 0);
  }
});

test("classifying zero-balance holders does not produce NaN", () => {
  const summary = classifyAssetHolders([{ address: "zero", balance: 0 }]);
  const shrimp = summary.tiers["🦐 Shrimp"];

  assert.equal(summary.assetHolders[0]?.percent, 0);
  assert.equal(shrimp.percentAmount, 0);
  assert.equal(shrimp.percentCount, 100);
});
