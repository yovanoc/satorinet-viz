/**
 * Seeds the local throwaway Postgres with REAL Satori network data, pulled
 * from the public Cortex Synapse API (https://synapse.cortexpool.com/api).
 * Real wallets, rewards, operators, and lender allocations — so the site can
 * be tested locally against live-shaped data without prod DB credentials.
 *
 * Approximations (fields the public API does not expose):
 *  - delegated_stake: network stake spread uniformly across active workers
 *  - score (distance), miner_earned, pool_miner_percent, balance: plausible
 *    synthetic values so the pool charts render — NOT real
 *  - pools_own_staking_power: operator stakePower minus lended contributions
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgres://postgres:pass@127.0.0.1:5544/satori"
 *   pnpm exec drizzle-kit push --force
 *   pnpm exec tsx scripts/seed-real.ts [days=60]
 */
import pLimit from "p-limit";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  dailyPredictorAddress,
  dailyContributorAddress,
} from "../lib/db/schema";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1337);

const API = "https://synapse.cortexpool.com/api";
const db = drizzle(process.env.DATABASE_URL!);
const DAYS = Number(process.argv[2] ?? 60);

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

type HistoryDay = {
  date: string;
  totalActiveWorkers: number;
  activeTotalStakePower: number;
  stakePerWorker: number;
};

type ApiWorker = {
  wallet: string;
  vault: string | null;
  operatorWallet: string | null;
  operatorVault: string | null;
  reward: number;
};

type ApiLender = {
  wallet: string;
  vault: string | null;
  operatorWallet: string | null;
  operatorVault: string | null;
  contribution: number;
  share: number;
  reward: number;
};

type ApiOperator = {
  operatorWallet: string;
  stakePower: number;
};

async function main() {
  const [dates, history] = await Promise.all([
    api<string[]>("/dates"),
    api<HistoryDay[]>("/history"),
  ]);
  const historyByDate = new Map(history.map((h) => [h.date, h]));
  const selected = [...dates].sort().slice(-DAYS);
  console.log(`Seeding ${selected.length} days (${selected[0]} → ${selected[selected.length - 1]})…`);

  await db.execute(sql`truncate daily_predictor_address, daily_contributor_address`);

  const limit = pLimit(4);
  let done = 0;

  const days = await Promise.all(
    selected.map((date) =>
      limit(async () => {
        const [workers, lenders, operators] = await Promise.all([
          api<ApiWorker[]>(`/workers?date=${date}`),
          api<ApiLender[]>(`/lenders?date=${date}`),
          api<ApiOperator[]>(`/operators-detailed?date=${date}`),
        ]);
        done++;
        if (done % 10 === 0) console.log(`  fetched ${done}/${selected.length} days`);
        return { date, workers, lenders, operators };
      })
    )
  );

  let predictorCount = 0;
  let contributorCount = 0;

  for (const { date, workers, lenders, operators } of days) {
    const h = historyByDate.get(date);
    const stakePerWorker =
      h && h.totalActiveWorkers > 0
        ? h.activeTotalStakePower / h.totalActiveWorkers
        : (h?.stakePerWorker ?? 250);
    const ts = new Date(`${date}T00:00:00Z`);

    const predictorRows = workers.map((w) => {
      const reward = w.reward ?? 0;
      // Plausible fillers for fields the public API hides (see header).
      const score = 0.2 + rand() * 0.5;
      const minerPercent = 0.5;
      return {
        date,
        observation_ts: ts,
        worker_address: w.wallet,
        worker_vault_address: w.vault,
        reward_address: w.operatorWallet ?? w.wallet,
        pool_wallet: w.operatorWallet ?? "",
        pool_vault: w.operatorVault,
        score,
        reward,
        distributed_reward: reward,
        balance: rand() * 40,
        delegated_stake: stakePerWorker,
        worker_reward_calculated: reward,
        pool_miner_percent: minerPercent,
        miner_earned: reward * minerPercent,
      };
    });

    const lendedByPool = new Map<string, number>();
    for (const l of lenders) {
      const pool = l.operatorWallet ?? "";
      lendedByPool.set(pool, (lendedByPool.get(pool) ?? 0) + (l.contribution ?? 0));
    }
    const ownPowerByPool = new Map<string, number>();
    for (const o of operators) {
      ownPowerByPool.set(
        o.operatorWallet,
        Math.max((o.stakePower ?? 0) - (lendedByPool.get(o.operatorWallet) ?? 0), 0)
      );
    }

    const contributorRows = lenders
      .filter((l) => l.operatorWallet)
      .map((l) => ({
        date,
        observation_ts: ts,
        contributor: l.wallet,
        pool_address: l.operatorWallet!,
        pool_vault: l.operatorVault,
        staking_power_contribution: l.contribution ?? 0,
        contributor_vault: l.vault,
        pools_own_staking_power: ownPowerByPool.get(l.operatorWallet!) ?? null,
        share: (l.share ?? 0) / 100,
        reward_calculated: l.reward ?? 0,
        distributed_reward: l.reward ?? 0,
      }));

    for (let i = 0; i < predictorRows.length; i += 2000) {
      await db.insert(dailyPredictorAddress).values(predictorRows.slice(i, i + 2000));
    }
    for (let i = 0; i < contributorRows.length; i += 2000) {
      await db.insert(dailyContributorAddress).values(contributorRows.slice(i, i + 2000));
    }
    predictorCount += predictorRows.length;
    contributorCount += contributorRows.length;
  }

  console.log("creating indexes…");
  await db.execute(sql`
    create index if not exists idx_dpa_date on daily_predictor_address (date);
    create index if not exists idx_dpa_pool_date on daily_predictor_address (pool_wallet, date);
    create index if not exists idx_dpa_worker on daily_predictor_address (worker_address);
    create index if not exists idx_dpa_reward_addr on daily_predictor_address (reward_address, date);
    create index if not exists idx_dca_date_pool on daily_contributor_address (date, pool_address);
    create index if not exists idx_dca_contributor on daily_contributor_address (contributor);
  `);
  await db.execute(sql`analyze daily_predictor_address; analyze daily_contributor_address;`);

  console.log(
    `seeded ${predictorCount} predictor rows and ${contributorCount} contributor rows over ${selected.length} days of REAL network data`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
