/**
 * Seeds a local throwaway Postgres with 120 days of synthetic daily snapshots
 * shaped like the real Satori network, so every page renders without prod
 * credentials. Dev-only — never point DATABASE_URL at the real database.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgres://postgres:pass@127.0.0.1:5544/satori"
 *   pnpm exec drizzle-kit push --force
 *   pnpm exec tsx scripts/seed-local.ts
 */
import { drizzle } from "drizzle-orm/node-postgres";
import {
  dailyPredictorAddress,
  dailyContributorAddress,
} from "../lib/db/schema";

const db = drizzle(process.env.DATABASE_URL!);

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

const addr = (prefix: string, i: number) =>
  `E${prefix}${String(i).padStart(6, "0")}xxxxxxxxxxxxxxxxxxxxxxxxx`;

const DAYS = 120;
const POOLS = 6;
const STAKE_PER_WORKER = 250;

async function main() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const predictorRows: (typeof dailyPredictorAddress.$inferInsert)[] = [];
  const contributorRows: (typeof dailyContributorAddress.$inferInsert)[] = [];

  for (let d = DAYS - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    const growth = 1 + (DAYS - 1 - d) / DAYS; // network grows over time

    const workerCount = Math.round(160 * growth + rand() * 20);
    const lenderCount = Math.round(70 * growth + rand() * 10);

    for (let w = 0; w < workerCount; w++) {
      const pool = Math.floor(rand() * POOLS);
      const rewarded = rand() > 0.06;
      const reward = rewarded ? 0.25 + rand() * 0.15 : 0;
      predictorRows.push({
        date: dateStr,
        observation_ts: date,
        worker_address: addr("W", w),
        worker_vault_address: addr("V", w),
        reward_address: addr("P", pool),
        pool_wallet: addr("P", pool),
        pool_vault: addr("Q", pool),
        score: 0.4 + rand() * 0.4,
        reward,
        distributed_reward: reward * 0.9,
        balance: rand() * 100,
        delegated_stake: STAKE_PER_WORKER * (0.85 + rand() * 0.15),
        worker_reward_calculated: reward,
        pool_miner_percent: 0.5,
        miner_earned: reward * 0.5,
      });
    }

    for (let c = 0; c < lenderCount; c++) {
      const pool = Math.floor(rand() * POOLS);
      contributorRows.push({
        date: dateStr,
        observation_ts: date,
        contributor: addr("L", c),
        pool_address: addr("P", pool),
        pool_vault: addr("Q", pool),
        staking_power_contribution: 100 + rand() * 900,
        contributor_vault: addr("M", c),
        pools_own_staking_power: 5000 + pool * 1000,
        share: rand(),
        reward_calculated: rand(),
        distributed_reward: rand(),
      });
    }
  }

  for (let i = 0; i < predictorRows.length; i += 2000) {
    await db.insert(dailyPredictorAddress).values(predictorRows.slice(i, i + 2000));
  }
  for (let i = 0; i < contributorRows.length; i += 2000) {
    await db
      .insert(dailyContributorAddress)
      .values(contributorRows.slice(i, i + 2000));
  }

  console.log(
    `seeded ${predictorRows.length} predictor rows, ${contributorRows.length} contributor rows over ${DAYS} days`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
