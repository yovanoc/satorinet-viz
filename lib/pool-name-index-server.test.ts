import { strict as assert } from "node:assert";
import { mock, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { Redis } from "ioredis";

import { POOL_NAME_INDEX_LIMITS, poolNameIndexKey } from "./pool-name-index";
import { createPoolNameIndexReader } from "./pool-name-index-server";

const day = "2026-01-02";
const address = "0x0000000000000000000000000000000000000001";
const unknown = "0x0000000000000000000000000000000000000002";
const names = { [address]: "Café Pool", [unknown]: null };
const payload = { day, builtAt: `${day}T00:00:00Z`, names };
const cap = POOL_NAME_INDEX_LIMITS.serializedBytes;
const redisUrl = () => "redis://reader.invalid";

function fakeRedis(
  getrangeBuffer: () => Promise<Buffer> = async () => Buffer.alloc(0),
  connect = async () => {},
) {
  return { connect: mock.fn(connect), getrangeBuffer: mock.fn(getrangeBuffer), disconnect: mock.fn() };
}

test("one bounded GETRANGE returns validated names including explicit null", async () => {
  const json = JSON.stringify(payload);
  const bytes = Buffer.from(json + " ".repeat(cap - Buffer.byteLength(json)));
  assert.equal(bytes.length, cap);
  const client = fakeRedis(async () => bytes);
  const factory = mock.fn(() => client);
  const read = createPoolNameIndexReader(redisUrl, factory);

  assert.equal(factory.mock.callCount(), 0);
  assert.deepEqual(await read(day), names);
  assert.equal(client.connect.mock.callCount(), 1);
  assert.deepEqual(client.getrangeBuffer.mock.calls.map((call) => call.arguments), [
    [poolNameIndexKey(day), 0, cap],
  ]);
  assert.equal(client.disconnect.mock.callCount(), 0);
});

test("a prefixed Redis URL gives the reader and writer the same key", async (t) => {
  const url = `${redisUrl()}?keyPrefix=stage:`;
  const json = JSON.stringify(payload);
  // Use real ioredis command construction, but never open a socket or send a command.
  const connect = t.mock.method(Redis.prototype, "connect", async () => {});
  const send = t.mock.method(Redis.prototype, "sendCommand", (command: Parameters<Redis["sendCommand"]>[0]) => {
    command.resolve(command.name === "set" ? "OK" : Buffer.from(json));
    return command.promise;
  });
  const writer = new Redis(url, { lazyConnect: true });
  await writer.set(poolNameIndexKey(day), json);

  const read = createPoolNameIndexReader(() => url);
  assert.deepEqual(await read(day), names);
  assert.equal(connect.mock.callCount(), 1);
  const storedKey = `stage:${poolNameIndexKey(day)}`;
  assert.deepEqual(send.mock.calls.map(({ arguments: [command] }) => [command.name, command.getKeys()]), [
    ["set", [storedKey]],
    ["getrange", [storedKey]],
  ]);
});

test("skips Redis without valid configuration or for an invalid lookup day", async () => {
  const factory = mock.fn(() => fakeRedis());
  assert.equal(await createPoolNameIndexReader(() => undefined, factory)(day), undefined);
  assert.equal(await createPoolNameIndexReader(() => "http://reader.invalid", factory)(day), undefined);
  assert.equal(await createPoolNameIndexReader(redisUrl, factory)("2026-02-30"), undefined);
  assert.equal(factory.mock.callCount(), 0);
});

test("misses and untrusted payloads return undefined without dropping the connection", async () => {
  const json = JSON.stringify(payload);
  const oversized = Buffer.from(json + " ".repeat(cap + 1 - Buffer.byteLength(json)));
  assert.equal(oversized.length, cap + 1);
  assert.equal(oversized.toString().length, cap);
  const badUtf8 = Buffer.from(json);
  badUtf8[badUtf8.indexOf("Café") + 3] = 0xff;
  const replies = [
    Buffer.alloc(0),
    Buffer.from("{"),
    badUtf8,
    Buffer.from(JSON.stringify({ ...payload, names: { [address]: 123 } })),
    Buffer.from(JSON.stringify({ ...payload, names: { ["__proto__"]: "not an address" } })),
    Buffer.from(JSON.stringify({ ...payload, day: "2026-01-01" })),
    oversized,
  ];
  let response = Buffer.alloc(0);
  const client = fakeRedis(async () => response);
  const read = createPoolNameIndexReader(redisUrl, () => client);

  for (const reply of replies) {
    response = reply;
    assert.equal(await read(day), undefined);
  }
  assert.equal(client.getrangeBuffer.mock.callCount(), replies.length);
  assert.equal(client.connect.mock.callCount(), 1);
  assert.equal(client.disconnect.mock.callCount(), 0);
});

test("Redis connection and command failures return undefined", async () => {
  const fail = async (): Promise<never> => {
    throw new Error("unavailable");
  };
  const failedConnect = fakeRedis(undefined, fail);
  const failedRead = fakeRedis(fail);
  for (const client of [failedConnect, failedRead]) {
    const read = createPoolNameIndexReader(redisUrl, () => client);
    assert.equal(await read(day), undefined);
    assert.equal(client.disconnect.mock.callCount(), 1);
  }
  assert.equal(failedConnect.getrangeBuffer.mock.callCount(), 0);
  assert.equal(failedRead.getrangeBuffer.mock.callCount(), 1);
});

test("a stalled connect is discarded; late readiness never sends a command", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const stalled = Promise.withResolvers<void>();
  const client = fakeRedis(undefined, () => stalled.promise);
  const factory = mock.fn(() => client);
  const read = createPoolNameIndexReader(redisUrl, factory);

  const pending = read(day);
  await setImmediate();
  assert.equal(client.connect.mock.callCount(), 1);
  t.mock.timers.tick(150);
  assert.equal(await pending, undefined);
  assert.equal(client.disconnect.mock.callCount(), 1);
  assert.equal(await read(day), undefined);
  assert.equal(factory.mock.callCount(), 1);
  stalled.resolve();
  await setImmediate();
  assert.equal(client.getrangeBuffer.mock.callCount(), 0);
});

test("a stalled read uses the remainder of the cold connection deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const connected = Promise.withResolvers<void>();
  const stalled = Promise.withResolvers<Buffer>();
  const client = fakeRedis(() => stalled.promise, () => connected.promise);
  const factory = mock.fn(() => client);
  const read = createPoolNameIndexReader(redisUrl, factory);

  const pending = read(day);
  t.mock.timers.tick(120);
  connected.resolve();
  await setImmediate();
  assert.equal(client.getrangeBuffer.mock.callCount(), 1);
  t.mock.timers.tick(30);
  assert.equal(await pending, undefined);
  assert.equal(client.disconnect.mock.callCount(), 1);
  assert.equal(await read(day), undefined);
  assert.equal(factory.mock.callCount(), 1);
  stalled.resolve(Buffer.from(JSON.stringify(payload)));
});
