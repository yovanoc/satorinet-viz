import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import pg from "pg";
import { POOL_NAME_INDEX_LIMITS as LIMITS } from "../lib/pool-name-index";
import { loadPoolNameEvidence, warmPoolNames } from "./warm-pool-names";

const day = "2026-04-06";
const address = `0x${"1".repeat(40)}`;
const registry = JSON.stringify({ pools: [{ address, pool_name: "Example" }] });

test("invalid registry or capped SQL results cannot publish a partial index", async () => {
  const writes: string[] = [];
  const redis = { set: async (key: string): Promise<"OK"> => { writes.push(key); return "OK"; } };
  const base = [redis, "never-connect", registry, [{ day, body: null }], day] as const;
  const pool = { address, alias: "Example" };
  let reads = 0;
  const read: typeof loadPoolNameEvidence = async () => {
    reads++;
    return { links: [], pairs: new Map([[day, []]]) };
  };
  for (const pools of [[{ address, pool_name: 42 }], Array(LIMITS.registryRows + 1).fill(pool)]) {
    assert.equal(await warmPoolNames(redis, "never-connect", JSON.stringify({ pools }), base[3], day, read), false);
  }
  assert.equal(reads, 0);
  assert.equal(await warmPoolNames(...base, async () => ({
    links: [], pairs: new Map([[day, Array(LIMITS.dbPairs + 1).fill({ pool_address: address, pool_vault: null })]]),
  })), false);
  assert.equal(await warmPoolNames(...base, async () => ({
    links: Array(LIMITS.links + 1).fill({ evm_address: address, evr_address: "Evr", kind: "wallet", confidence: "certain" }),
    pairs: new Map([[day, []]]),
  })), false);
  assert.deepEqual(writes, []);
});

test("PostgreSQL URL cannot override warmer deadlines", async (t) => {
  const stop = new Error("stop before opening a connection");
  t.mock.method(pg.Client.prototype, "connect", function (this: pg.Client) {
    assert.ok("_connectionTimeoutMillis" in this && "connectionParameters" in this);
    assert.equal(this._connectionTimeoutMillis, 5_000);
    assert.partialDeepStrictEqual(this.connectionParameters, {
      connect_timeout: 5,
      query_timeout: 4_000,
      statement_timeout: 4_000,
      application_name: "pool-warmer",
    });
    throw stop;
  });
  const url = "postgres://fixture@fake.invalid/db?query_timeout=600000&connectionTimeoutMillis=600000&statement_timeout=0&application_name=pool-warmer";
  await assert.rejects(loadPoolNameEvidence(url, [day]), (error) => error === stop);
});

// SATORINET_TEST_POSTGRES=1 pnpm exec tsx --test scripts/warm-pool-names.test.ts
// Never uses a configured database; the cluster listens only on its private Unix socket.
test("SQL evidence includes distinct zero-stake and conflicting vault observations and only certain links", {
  skip: process.env.SATORINET_TEST_POSTGRES !== "1" && "set SATORINET_TEST_POSTGRES=1 for a disposable PostgreSQL cluster",
}, async () => {
  assert.ok(process.getuid && process.getuid() !== 0, "PostgreSQL fixture requires a non-root Unix user");
  const discovery = spawnSync("sh", ["-c", "command -v postgres || command -v postgres-18"], {
    encoding: "utf8", timeout: 5_000,
  });
  assert.equal(discovery.status, 0, "PostgreSQL server executable is required on PATH");
  const bin = dirname(realpathSync(discovery.stdout.trim()));
  const dir = mkdtempSync("/tmp/satori-names-test-");
  console.log(`Owned disposable PostgreSQL fixture: pid=${process.pid} path=${dir}`);
  const data = join(dir, "data");
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, LC_ALL: "C", NODE_ENV: "test" };
  const pgCommand = (command: string, ...args: string[]) => execFileSync(join(bin, command), args, {
    env, timeout: 30_000, stdio: "ignore",
  });
  let setup: pg.Client | undefined;
  const connectionString = `postgres://pool_names_fixture@localhost/postgres?host=${encodeURIComponent(dir)}`;
  try {
    pgCommand("initdb", "-D", data, "-A", "trust", "-U", "pool_names_fixture", "--no-locale");
    pgCommand("pg_ctl", "-D", data, "-l", join(dir, "postgres.log"), "-o", `-F -k ${dir} -c listen_addresses= -p 5432`, "-w", "start");
    setup = new pg.Client({ connectionString, connectionTimeoutMillis: 5_000, statement_timeout: 4_000 });
    await setup.connect();
    await setup.query(`
      CREATE TABLE contributor_fixture (date date, pool_address text, pool_vault text, staking_power_contribution double precision);
      INSERT INTO contributor_fixture VALUES
        ('2026-04-06', 'same', 'vault', 10),
        ('2026-04-06', 'same', 'vault', 10),
        ('2026-04-06', 'same', 'conflict', 0),
        ('2026-04-06', 'same', '', 0),
        ('2026-04-06', 'same', NULL, 0),
        ('2026-04-06', 'zero-only', 'vault', 0),
        ('2026-04-05', 'other-day', 'vault', 500);
      CREATE VIEW daily_contributor_address AS SELECT * FROM contributor_fixture
        WHERE current_setting('transaction_read_only') = 'on' AND current_setting('statement_timeout') = '4s';
      CREATE TABLE evm_address_links (evm_address text, evr_address text, kind text, confidence text);
      INSERT INTO evm_address_links VALUES
        ('a', 'A', 'wallet', 'certain'), ('b', 'B', 'vault', 'certain'),
        ('c', 'C', 'wallet', 'probable'), ('d', 'D', 'reward', 'certain');
    `);
    const result = await loadPoolNameEvidence(connectionString, [day]);
    assert.deepEqual(result.pairs.get(day)?.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [
      { pool_address: "same", pool_vault: "" },
      { pool_address: "same", pool_vault: "conflict" },
      { pool_address: "same", pool_vault: "vault" },
      { pool_address: "same", pool_vault: null },
      { pool_address: "zero-only", pool_vault: "vault" },
    ]);
    assert.deepEqual(result.links.sort((a, b) => a.evm_address.localeCompare(b.evm_address)), [
      { evm_address: "a", evr_address: "A", kind: "wallet", confidence: "certain" },
      { evm_address: "b", evr_address: "B", kind: "vault", confidence: "certain" },
    ]);
    await setup.query(`INSERT INTO contributor_fixture
      SELECT $1::date, 'generated-' || n, NULL, 0 FROM generate_series(1, $2) n`, [day, LIMITS.dbPairs + 2]);
    await setup.query(`INSERT INTO evm_address_links
      SELECT 'generated-' || n, 'Evr', 'wallet', 'certain' FROM generate_series(1, $1) n`, [LIMITS.links + 2]);
    const overflow = await loadPoolNameEvidence(connectionString, [day]);
    assert.equal(overflow.pairs.get(day)?.length, LIMITS.dbPairs + 1);
    assert.equal(overflow.links.length, LIMITS.links + 1);
  } finally {
    try {
      await setup?.end();
    } finally {
      try {
        if (existsSync(join(data, "postmaster.pid"))) pgCommand("pg_ctl", "-D", data, "-m", "immediate", "-w", "stop");
        assert.ok(!existsSync(join(dir, ".s.PGSQL.5432")), "fixture socket is still active");
      } finally {
        rmSync(dir, { recursive: true, force: true });
        assert.ok(!existsSync(dir), "fixture directory still exists");
      }
    }
  }
});
