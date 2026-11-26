import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, realpathSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import pg from "pg";

// Run locally: SATORINET_TEST_POSTGRES=1 pnpm exec tsx --test lib/db/queries/contributors.test.ts
test("top pool vault evidence includes zero contributions without changing ranking", async (t) => {
  if (process.env.SATORINET_TEST_POSTGRES !== "1") {
    t.skip("set SATORINET_TEST_POSTGRES=1 to run the disposable PostgreSQL fixture");
    return;
  }
  assert.ok(process.getuid && process.getuid() !== 0, "PostgreSQL fixture requires a non-root Unix user");
  const discovery = spawnSync("sh", ["-c", "command -v postgres || command -v postgres-18"], { encoding: "utf8", timeout: 5000 });
  assert.ok(!discovery.error && discovery.status === 0 && discovery.stdout.trim(), "PostgreSQL fixture requires a postgres server executable on PATH");
  const postgres = discovery.stdout.trim();
  const bin = dirname(realpathSync(postgres));
  const initdb = join(bin, "initdb");
  const pgCtl = join(bin, "pg_ctl");
  for (const executable of [initdb, pgCtl]) {
    try {
      accessSync(executable, constants.X_OK);
    } catch {
      assert.fail(`PostgreSQL fixture requires executable companion tool: ${executable}`);
    }
  }
  const dir = mkdtempSync("/tmp/satorinet-pool-test-");
  const data = join(dir, "data");
  // The test owns this cluster and Unix socket; it never connects to a configured database.
  const environment = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LC_ALL: "C", NODE_ENV: "test" as const };
  let started = false;
  let client: pg.Client | undefined;
  let closeDb: (() => Promise<void>) | undefined;
  try {
    execFileSync(initdb, ["-D", data, "-A", "trust", "--no-locale"], { env: environment, timeout: 30000, stdio: "ignore" });
    execFileSync(pgCtl, ["-D", data, "-l", join(dir, "postgres.log"), "-o", `-F -k ${dir} -c listen_addresses= -p 5432`, "-w", "start"], { env: environment, timeout: 30000, stdio: "ignore" });
    started = true;
    client = new pg.Client({ host: dir, port: 5432, database: "postgres", user: process.env.USER });
    await client.connect();
    await client.query(`create table daily_contributor_address (
      date date not null, pool_address varchar(255) not null, pool_vault varchar(255),
      contributor varchar(255) not null, staking_power_contribution double precision not null
    ); create index idx_dca_date_pool on daily_contributor_address (date, pool_address)`);
    const vault = "0x8656A54B5570d77D2DA7CCC1bc3E927C993DEF3E";
    const rows = [
      ["2026-11-26", "conflict", vault, "a", 10],
      ["2026-11-26", "conflict", "other-vault", "b", 0],
      ["2026-11-26", "case", vault, "a", 6],
      ["2026-11-26", "case", vault.toLowerCase(), "b", 2],
      ["2026-11-26", "case", "   ", "c", 0],
      ["2026-11-26", "case", null, "d", 0],
      ["2026-11-25", "case", "other-vault", "e", 100],
      ["2026-11-26", "evr", "EVault", "a", 7],
      ["2026-11-26", "evr", "evault", "b", 0],
      ["2026-11-26", "blank", "", "a", 1],
      ["2026-11-26", "zero-only", vault, "a", 0],
    ];
    for (let i = 1; i <= 31; i++) {
      rows.push(["2026-11-26", `small-${i}`, null, "a", i / 1000]);
    }
    for (const row of rows) {
      await client.query("insert into daily_contributor_address values ($1, $2, $3, $4, $5)", row);
    }
    process.env.DATABASE_URL = `postgres://localhost/postgres?host=${encodeURIComponent(dir)}`;
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.LIVECOINWATCH_API_KEY = "test";
    const cache = createRequire(import.meta.url)("next/cache");
    t.mock.method(cache, "cacheLife", () => {});
    const { db } = await import("../index");
    closeDb = () => db.$client.end();
    const { getTopPools } = await import("./contributors");
    const result = await getTopPools(new Date("2026-11-26T00:00:00Z"));
    assert.equal(result.length, 30);
    assert.ok(!result.some((row) => row.pool_address === "zero-only" || row.pool_address === "small-1"));
    assert.deepEqual(result.slice(0, 4).map((row) => ({ ...row, contributor_count: Number(row.contributor_count) })), [
      { pool_address: "conflict", label_vault: null, total_staking_power: 10, contributor_count: 1 },
      { pool_address: "case", label_vault: vault.toLowerCase(), total_staking_power: 8, contributor_count: 2 },
      { pool_address: "evr", label_vault: null, total_staking_power: 7, contributor_count: 1 },
      { pool_address: "blank", label_vault: null, total_staking_power: 1, contributor_count: 1 },
    ]);
  } catch (error) {
    try { console.error(readFileSync(join(dir, "postgres.log"), "utf8")); } catch {}
    throw error;
  } finally {
    try {
      await closeDb?.();
      await client?.end();
    } finally {
      try {
        if (started) execFileSync(pgCtl, ["-D", data, "-m", "immediate", "-w", "stop"], { env: environment, timeout: 30000, stdio: "ignore" });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }
});
