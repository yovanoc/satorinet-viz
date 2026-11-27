import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import * as vm from "node:vm";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { test } from "node:test";
import * as nameWarmer from "./warm-pool-names";
import * as indexContract from "../lib/pool-name-index";

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

  async connect() {}
  async ping() {}
  disconnect() {}
  on() {}
  off() {}

  async get(key: string): Promise<string | null> {
    return this.entries.get(key)?.value ?? null;
  }

  async getrange(key: string, start: number, end: number): Promise<string> {
    return Buffer.from(this.entries.get(key)?.value ?? "").subarray(start, end + 1).toString();
  }

  async set(key: string, value: string, mode?: "EX", ttl?: number): Promise<"OK"> {
    this.entries.set(key, { value, ttl: ttl ?? -1 });
    this.writes.push({ method: "set", key, value, ...(mode === "EX" ? { ttl } : {}) });
    return "OK";
  }

  async setex(key: string, ttl: number, value: string): Promise<"OK"> {
    this.entries.set(key, { value, ttl });
    this.writes.push({ method: "setex", key, value, ttl });
    return "OK";
  }
}

function loadWarmer(options: {
  redis?: FakeRedis;
  env?: Record<string, string>;
  now?: string;
  fetch?: (url: string) => Response;
  loadEvidence?: typeof nameWarmer.loadPoolNameEvidence;
} = {}) {
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
    Buffer,
    URL,
    Date: class extends Date {
      constructor(value = Date.parse(options.now ?? "2026-04-06T01:00:00Z")) { super(value); }
      static override now() { return Date.parse(options.now ?? "2026-04-06T01:00:00Z"); }
    },
    console: { log() {}, error() {} },
    exports: {},
    module: { exports: {} },
    process: { env: { REDIS_URL: "redis://fake.invalid", ...options.env }, exitCode: 0 },
    setTimeout(callback: () => void) {
      callback();
      return 0;
    },
    require(specifier: string) {
      if (specifier === "dotenv") return { config() {} };
      if (specifier === "ioredis") return { Redis: function () { return options.redis; } };
      if (specifier === "../lib/pool-name-index") return indexContract;
      if (specifier === "./warm-pool-names") return {
        ...nameWarmer,
        warmPoolNames: (...args: Parameters<typeof nameWarmer.warmPoolNames>) => {
          args[5] = options.loadEvidence ?? (() => assert.fail("unexpected DB attempt"));
          return nameWarmer.warmPoolNames(...args);
        },
      };
      if (specifier === "../lib/satorinet/transport") {
        return {
          impitFetch: async (url: string) => {
            requests.push(url);
            if (options.fetch) return options.fetch(url);
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
    "\nglobalThis.__main = main;\n" +
    "globalThis.__warmAudit = warmAudit;\n" +
    "globalThis.__setRedis = (value) => { redis = value; };\n";
  const { outputText } = transpileModule(runnableSource, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    fileName: "scripts/warm-satori-cache.ts",
  });
  vm.runInNewContext(outputText, sandbox, { filename: "scripts/warm-satori-cache.ts" });

  return {
    requests,
    main: sandbox.__main as () => Promise<void>,
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

const today = "2026-04-06";
const yesterday = "2026-04-05";
const wallet = `0x${"1".repeat(40)}`;
const alias = `0x${"2".repeat(40)}`;
const dbEnv = { POOL_NAMES_DATABASE_URL: "postgres://fake.invalid" };
const nameKey = indexContract.poolNameIndexKey;
const rawKey = (day: string) => `satorinet:raw:audit:stakers:${day}`;
const audit = (day: string) => `observation_ts,pool_alias,pool_wallet\n${day} 02:00:00+00,${alias},${wallet}\n`;
const registry = { pools: [{ address: wallet, pool_name: "Example" }] };

function upstream(url: string, override?: (day: string) => Response | undefined): Response {
  const { pathname, searchParams } = new URL(url);
  if (pathname === "/api/pools") return Response.json(registry);
  if (pathname.endsWith("/stakers")) {
    const day = searchParams.get("date")!;
    return override?.(day) ?? new Response(audit(day));
  }
  // A distinct alias here proves today's names never come from /latest.
  if (pathname.endsWith("/stakers/latest")) return new Response(audit(today).replace(alias, `0x${"3".repeat(40)}`));
  if (pathname.includes("/audit/")) return new Response("observation_ts,other\nexample,0");
  return Response.json({});
}

const emptyEvidence: typeof nameWarmer.loadPoolNameEvidence = async (_url, days) => ({
  links: [], pairs: new Map(days.map((day) => [day, []])),
});

function redisWithGoodIndexes() {
  const redis = new FakeRedis();
  for (const day of [today, yesterday]) {
    redis.entries.set(nameKey(day), {
      ttl: 3600, value: JSON.stringify({ day, builtAt: `${day}T00:00:00Z`, names: { [wallet]: "Previous" } }),
    });
  }
  return redis;
}

function assertBaselineWarm(redis: FakeRedis) {
  assert.ok(redis.entries.has("satorinet:raw:pools"));
  assert.ok(redis.entries.has(rawKey("latest")));
  assert.ok(redis.entries.has(`satorinet:leaderboard:${today}:0`));
  assert.ok(redis.entries.has(`satorinet:leaderboard:${yesterday}:0`));
}

test("scheduled warming refreshes today with atomic expiry and rebuilds cached finalized yesterday", async () => {
  const redis = redisWithGoodIndexes();
  redis.entries.set(rawKey(yesterday), { ttl: -1, value: audit(yesterday) });
  const warmer = loadWarmer({ redis, env: dbEnv, fetch: upstream, loadEvidence: async (url, days) => {
    assert.deepEqual(days, [today, yesterday]);
    return emptyEvidence(url, days);
  } });
  await warmer.main();
  assertBaselineWarm(redis);
  assert.ok(!warmer.requests.some((url) => url.endsWith(`stakers?date=${yesterday}`)));
  assert.deepEqual(redis.writes.filter(({ key }) => key.startsWith(indexContract.POOL_NAME_INDEX_KEY_PREFIX))
    .map(({ method, key, ttl }) => ({ method, key, ttl })), [
    { method: "set", key: nameKey(today), ttl: 21_600 },
    { method: "set", key: nameKey(yesterday), ttl: undefined },
  ]);
  for (const day of [today, yesterday]) {
    const index = JSON.parse(redis.entries.get(nameKey(day))!.value);
    assert.equal(index.day, day);
    assert.equal(index.names[alias], "Example");
    assert.equal(index.names[`0x${"3".repeat(40)}`], undefined);
  }
});

test("name-only dispatch fetches only registry and one exact-date stakers audit and writes only its index", async () => {
  const redis = new FakeRedis();
  const day = "2026-01-03";
  const warmer = loadWarmer({ redis, env: { ...dbEnv, POOL_NAMES_DATE: day }, fetch: upstream,
    loadEvidence: async (url, days) => {
      assert.deepEqual(days, [day]);
      return emptyEvidence(url, days);
    },
  });
  await warmer.main();
  assert.deepEqual(warmer.requests, ["https://satorinet.io/api/pools", `https://network.satorinet.io/api/v1/audit/stakers?date=${day}`]);
  assert.deepEqual(redis.writes.map(({ method, key }) => [method, key]), [["set", nameKey(day)]]);
  assert.equal(redis.entries.get(nameKey(day))!.ttl, -1);
});

test("name-only repair refetches invalid cached evidence and writes only the exact day's index", async (t) => {
  for (const [label, cachedBody] of Object.entries({ malformed: "not CSV", "wrong day": audit(today) })) {
    await t.test(label, async (t) => {
      const redis = redisWithGoodIndexes();
      const raw = { ttl: -1, value: cachedBody };
      redis.entries.set(rawKey(yesterday), raw);
      const response = new Response(audit(yesterday));
      t.mock.method(response, "text", () => assert.fail("name-only repairs must stream the audit with a byte cap"));
      const warmer = loadWarmer({ redis, env: { ...dbEnv, POOL_NAMES_DATE: yesterday },
        fetch: (url) => upstream(url, () => response), loadEvidence: emptyEvidence,
      });
      await warmer.main();
      assert.deepEqual(warmer.requests, ["https://satorinet.io/api/pools", `https://network.satorinet.io/api/v1/audit/stakers?date=${yesterday}`]);
      assert.deepEqual(redis.writes.map(({ key }) => key), [nameKey(yesterday)]);
      assert.deepEqual(redis.entries.get(rawKey(yesterday)), raw);
      assert.equal(JSON.parse(redis.entries.get(nameKey(yesterday))!.value).names[alias], "Example");
    });
  }
});

test("name-only repair with a malformed permanent audit preserves prior names if upstream fails", async () => {
  const redis = redisWithGoodIndexes();
  const before = redis.entries.get(nameKey(yesterday));
  const raw = { ttl: -1, value: "not CSV" };
  redis.entries.set(rawKey(yesterday), raw);
  const warmer = loadWarmer({ redis, env: { ...dbEnv, POOL_NAMES_DATE: yesterday },
    fetch: (url) => upstream(url, () => new Response("unavailable", { status: 503 })),
  });
  await assert.rejects(warmer.main(), /did not publish/);
  assert.deepEqual(warmer.requests, ["https://satorinet.io/api/pools", `https://network.satorinet.io/api/v1/audit/stakers?date=${yesterday}`]);
  assert.deepEqual(redis.entries.get(rawKey(yesterday)), raw);
  assert.deepEqual(redis.entries.get(nameKey(yesterday)), before);
  assert.deepEqual(redis.writes, []);
});

test("backfill date must be one real historical date and cannot be combined with leaderboard replay", async () => {
  for (const value of ["2026-02-30", today, "2026-04-07", "2025-12-24", " 2026-04-05", `${yesterday},2026-04-04`]) {
    const warmer = loadWarmer({ env: { ...dbEnv, POOL_NAMES_DATE: value } });
    await assert.rejects(warmer.main(), /one historical YYYY-MM-DD/);
    assert.deepEqual(warmer.requests, []);
  }
  const warmer = loadWarmer({ env: { ...dbEnv, POOL_NAMES_DATE: yesterday, BACKFILL_SINCE: yesterday } });
  await assert.rejects(warmer.main(), /cannot be combined/);
  assert.deepEqual(warmer.requests, []);
});

test("a confirmed stakers gap still supports a DB/registry-derived index", async () => {
  const redis = new FakeRedis();
  const warmer = loadWarmer({ redis, env: { ...dbEnv, POOL_NAMES_DATE: yesterday },
    fetch: (url) => upstream(url, () => Response.json({ detail: "No audit found" }, { status: 404 })),
    loadEvidence: async () => ({ links: [], pairs: new Map([[yesterday, [{ pool_address: alias, pool_vault: wallet }]]]) }),
  });
  await warmer.main();
  assert.equal(JSON.parse(redis.entries.get(nameKey(yesterday))!.value).names[alias], "Example");
});

test("a wrong-day, malformed, oversized or failed dated audit never replaces its previous index", async (t) => {
  for (const [label, response] of Object.entries({
    "wrong day": () => new Response(audit(yesterday)),
    "schema drift": () => new Response(audit(today).replace("pool_alias", "something_else")),
    "ambiguous missing route": () => new Response("not found", { status: 404 }),
    "server error": () => Response.json({ detail: "No audit found" }, { status: 500 }),
    "timeout": () => { throw new DOMException("timeout", "TimeoutError"); },
    "too many bytes": () => new Response("a".repeat(nameWarmer.MAX_NAME_AUDIT_BYTES + 1)),
    "too many rows": () => new Response(`observation_ts,pool_alias,pool_wallet\n${`${today}T01:00:00Z,,\n`.repeat(20_001)}`),
  })) {
    await t.test(label, async () => {
      const redis = redisWithGoodIndexes();
      const before = redis.entries.get(nameKey(today));
      const warmer = loadWarmer({ redis, env: dbEnv, loadEvidence: emptyEvidence,
        fetch: (url) => upstream(url, (day) => day === today ? response() : undefined),
      });
      await warmer.main();
      assertBaselineWarm(redis);
      assert.deepEqual(redis.entries.get(nameKey(today)), before);
      assert.ok(redis.writes.some(({ key }) => key === nameKey(yesterday)));
    });
  }
});

test("an over-limit cached audit and streamed name-only backfill leave prior indexes intact", async (t) => {
  for (const cached of [true, false]) {
    const redis = redisWithGoodIndexes();
    const before = redis.entries.get(nameKey(yesterday));
    const body = audit(yesterday) + " ".repeat(nameWarmer.MAX_NAME_AUDIT_BYTES);
    if (cached) redis.entries.set(rawKey(yesterday), { ttl: -1, value: body });
    let canceled = false;
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(Buffer.from(body)); },
      cancel() { canceled = true; },
    }));
    t.mock.method(response, "text", () => assert.fail("name-only repairs must stream the audit with a byte cap"));
    const warmer = loadWarmer({ redis, env: { ...dbEnv, POOL_NAMES_DATE: yesterday },
      fetch: (url) => upstream(url, () => response),
    });
    await assert.rejects(warmer.main(), /did not publish/);
    assert.equal(canceled, true, "a streamed refetch must cancel once over the byte cap");
    assert.deepEqual(redis.entries.get(nameKey(yesterday)), before);
    assert.deepEqual(redis.writes, []);
  }
});

test("missing name credentials and SQL timeout both leave existing warming intact", async () => {
  for (const env of [{}, dbEnv]) {
    const redis = redisWithGoodIndexes();
    const before = redis.entries.get(nameKey(today));
    let attempts = 0;
    const warmer = loadWarmer({ redis, env, fetch: upstream, loadEvidence: async () => {
      attempts++;
      throw new Error("statement timeout");
    } });
    await warmer.main();
    assertBaselineWarm(redis);
    assert.equal(attempts, env === dbEnv ? 1 : 0);
    assert.deepEqual(redis.entries.get(nameKey(today)), before);
    assert.ok(!redis.writes.some(({ key }) => key.startsWith(indexContract.POOL_NAME_INDEX_KEY_PREFIX)));
  }
});
