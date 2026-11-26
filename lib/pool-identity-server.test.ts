import { test } from "node:test";
import assert from "node:assert/strict";
import { KNOWN_POOLS } from "./known_pools";
import { buildPoolIdentities, findPoolIdentity } from "./pool-identity";

process.env.DATABASE_URL = "postgres://localhost/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.LIVECOINWATCH_API_KEY = "test";
const setup = async () => {
  const { redis } = await import("./redis");
  redis.disconnect();
  const { getPoolIdentities } = await import("./pool-identity-server");
  return { redis, getPoolIdentities };
};
const fallback = buildPoolIdentities(KNOWN_POOLS, new Map(), new Map());

test("pending identity read falls back and handles a late rejection", async (t) => {
  const { redis, getPoolIdentities } = await setup();
  let rejectRead!: (error: Error) => void;
  t.mock.method(redis, "hgetall", () => new Promise((_resolve, reject) => { rejectRead = reject; }));
  t.mock.method(redis, "keys", async () => []);
  const log = t.mock.method(console, "error", () => {});
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let settled = false;
  const result = getPoolIdentities().then((identities) => {
    settled = true;
    return identities;
  });
  t.mock.timers.tick(249);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(log.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.deepEqual(await result, fallback);
  assert.equal(log.mock.callCount(), 1);
  assert.ok(log.mock.calls[0]?.arguments.some((argument) => argument instanceof Error));
  rejectRead(new Error("late Redis failure"));
  await new Promise((resolve) => setImmediate(resolve));
});

test("successful and rejected identity reads preserve dynamic and static resolution", async (t) => {
  const { redis, getPoolIdentities } = await setup();
  const pool = KNOWN_POOLS.find((entry) => !entry.base_address)!;
  const base = "0x1111111111111111111111111111111111111111";
  const read = t.mock.method(redis, "hgetall", async () => ({ [pool.address]: base }));
  t.mock.method(redis, "keys", async () => []);
  t.mock.method(console, "error", () => {});
  assert.equal(findPoolIdentity(await getPoolIdentities(), base)?.pool, pool);
  read.mock.mockImplementation(async () => { throw new Error("Redis unavailable"); });
  assert.deepEqual(await getPoolIdentities(), fallback);
});
