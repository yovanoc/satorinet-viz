import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { KNOWN_POOLS } from "./known_pools";

process.env.DATABASE_URL = "postgres://localhost/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.LIVECOINWATCH_API_KEY = "test";

test("pool selection uses configured identities without bulk Redis reads", async (t) => {
  const cache = createRequire(import.meta.url)("next/cache");
  t.mock.method(cache, "cacheLife", () => {});
  const { redis } = await import("./redis");
  redis.disconnect();
  const bulk = () => new Promise<never>(() => {});
  const hgetall = t.mock.method(redis, "hgetall", bulk);
  const keys = t.mock.method(redis, "keys", bulk);
  const { db } = await import("./db");
  let rows: { pool_address: string; total_staking_power: number; contributor_count: number }[] = [];
  const chain = { from: () => chain, where: () => chain, groupBy: () => chain, orderBy: () => chain, limit: () => chain, execute: async () => rows, then: (resolve: (value: typeof rows) => void) => resolve(rows) };
  t.mock.method(db, "select", () => chain as never);
  const { getPoolAndDate } = await import("./get-pool-and-date-params");
  const synapool = KNOWN_POOLS.find((pool) => pool.name === "Synapool")!;
  const configured = KNOWN_POOLS.find((pool) => pool.base_address && pool.base_vault_address)!;
  const resolve = async (pool: string) => Promise.race([
    getPoolAndDate({ pool, date: "2026-01-01" }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("pool selection blocked")), 50)),
  ]);

  const empty = await resolve(configured.base_address!);
  assert.equal(empty.hasData, false);
  assert.equal(empty.selectedPool.address, configured.address);
  assert.equal((await resolve(synapool.address)).selectedPool.name, "Synapool");
  assert.equal((await resolve("invalid")).selectedPool.address, KNOWN_POOLS[0]!.address);
  rows = [{ pool_address: configured.base_address!, total_staking_power: 3, contributor_count: 1 }];
  const populated = await resolve(configured.address);
  assert.equal(populated.selectedPool.name, configured.name);
  assert.equal(populated.selectedPool.vault_address, configured.base_vault_address);
  rows = [];
  const { hasContributionsToPool, getContributors } = await import("./db/queries/contributors");
  const { getPredictors } = await import("./db/queries/predictors");
  const { getPoolWorkerStats } = await import("./db/queries/predictors/worker-stats");
  const date = new Date("2026-01-01");
  assert.equal(await hasContributionsToPool(configured.address, configured.vault_address, date), false);
  assert.deepEqual(await getContributors(configured.address, configured.vault_address, date), []);
  assert.deepEqual(await getPredictors(configured.address, configured.vault_address, date), []);
  assert.deepEqual(await getPoolWorkerStats(configured.address, configured.vault_address, date), []);
  assert.equal(hgetall.mock.callCount(), 0);
  assert.equal(keys.mock.callCount(), 0);
});
