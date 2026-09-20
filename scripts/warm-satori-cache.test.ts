import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import * as vm from "node:vm";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
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

type RedisWrite = {
  method: "set" | "setex";
  key: string;
  value: string;
  ttl?: number;
};

class FakeRedis {
  readonly entries = new Map<string, { value: string; ttl: number }>();
  readonly writes: RedisWrite[] = [];

  async ttl(key: string): Promise<number> {
    return this.entries.get(key)?.ttl ?? -2;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.entries.set(key, { value, ttl: -1 });
    this.writes.push({ method: "set", key, value });
    return "OK";
  }

  async setex(key: string, ttl: number, value: string): Promise<"OK"> {
    this.entries.set(key, { value, ttl });
    this.writes.push({ method: "setex", key, value, ttl });
    return "OK";
  }
}

function loadWarmer() {
  let revision = 0;
  const requests: string[] = [];
  const source = readFileSync(new URL("./warm-satori-cache.ts", import.meta.url), "utf8");
  const mainInvocation =
    "\nvoid main().catch((error) => {\n" +
    "  console.error(`Warm Satori cache failed: ${describeError(error)}`);\n" +
    "  process.exitCode = 1;\n" +
    "});\n";
  assert.ok(source.endsWith(mainInvocation), "warmer entrypoint changed; update this harness");

  const sandbox: Record<string, unknown> = {
    AbortSignal,
    console: { log() {}, error() {} },
    exports: {},
    module: { exports: {} },
    process: { env: {}, exitCode: 0 },
    setTimeout(callback: () => void) {
      callback();
      return 0;
    },
    require(specifier: string) {
      if (specifier === "dotenv") return { config() {} };
      if (specifier === "ioredis") return { Redis: class {} };
      if (specifier === "../lib/satorinet/transport") {
        return {
          impitFetch: async (url: string) => {
            requests.push(url);
            return {
              ok: true,
              status: 200,
              text: async () => `observation_ts,revision\\n${revision},${revision}`,
            };
          },
        };
      }
      throw new Error(`Unexpected import: ${specifier}`);
    },
  };

  const runnableSource =
    source.slice(0, -mainInvocation.length) +
    "\nglobalThis.__warmAudit = warmAudit;\n" +
    "globalThis.__setRedis = (value) => { redis = value; };\n";
  const { outputText } = transpileModule(runnableSource, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    fileName: "scripts/warm-satori-cache.ts",
  });
  vm.runInNewContext(outputText, sandbox, { filename: "scripts/warm-satori-cache.ts" });

  return {
    requests,
    setRevision(value: number) {
      revision = value;
    },
    setRedis(value: FakeRedis) {
      (sandbox.__setRedis as (redis: FakeRedis) => void)(value);
    },
    warmAudit: sandbox.__warmAudit as (
      day: string,
      today: string,
    ) => Promise<void>,
  };
}

test("cache warmer refreshes today and finalizes its raw audit on rollover", async () => {
  const warmer = loadWarmer();
  const redis = new FakeRedis();
  const today = "2026-04-05";
  const tomorrow = "2026-04-06";
  const keys = ["stakers", "workers", "predictors"].map(
    (kind) => `satorinet:raw:audit:${kind}:${today}`,
  );
  warmer.setRedis(redis);

  warmer.setRevision(1);
  await warmer.warmAudit(today, today);
  assert.equal(warmer.requests.length, 3);
  assert.equal(redis.writes.length, 3);
  assert.ok(redis.writes.every(({ method, ttl }) => method === "setex" && ttl === 3 * 3600));
  for (const key of keys) {
    assert.deepEqual(redis.entries.get(key), { value: "observation_ts,revision\\n1,1", ttl: 3 * 3600 });
  }

  warmer.requests.length = 0;
  redis.writes.length = 0;
  warmer.setRevision(2);
  await warmer.warmAudit(today, today);
  assert.equal(warmer.requests.length, 3, "existing mutable keys must still fetch");
  assert.equal(redis.writes.length, 3);
  assert.ok(redis.writes.every(({ method, ttl }) => method === "setex" && ttl === 3 * 3600));
  for (const key of keys) {
    assert.deepEqual(redis.entries.get(key), { value: "observation_ts,revision\\n2,2", ttl: 3 * 3600 });
  }

  warmer.requests.length = 0;
  redis.writes.length = 0;
  warmer.setRevision(3);
  await warmer.warmAudit(today, tomorrow);
  assert.equal(warmer.requests.length, 3, "rollover must finalize an expiring key");
  assert.equal(redis.writes.length, 3);
  assert.ok(redis.writes.every(({ method, ttl }) => method === "set" && ttl === undefined));
  for (const key of keys) {
    assert.deepEqual(redis.entries.get(key), { value: "observation_ts,revision\\n3,3", ttl: -1 });
  }

  warmer.requests.length = 0;
  redis.writes.length = 0;
  warmer.setRevision(4);
  await warmer.warmAudit(today, tomorrow);
  assert.equal(warmer.requests.length, 0, "permanent historical keys remain skipped");
  assert.equal(redis.writes.length, 0);
});
