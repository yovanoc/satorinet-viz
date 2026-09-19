import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("cache warmer rejects missing or invalid Redis configuration before fetching", () => {
  for (const [url, message] of [
    ["", "REDIS_URL is required"],
    ["https://example.com", "redis:// or rediss://"],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/warm-satori-cache.ts"],
      {
        env: { ...process.env, REDIS_URL: url },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.equal(result.status, 1, result.error);
    assert.ok(result.stderr.includes(message), result.stderr);
    assert.ok(!result.stderr.includes("Unhandled error"), result.stderr);
    assert.equal(result.stdout, "");
  }
});
