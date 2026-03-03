import { integer, pgTable, varchar, date, doublePrecision, smallint, timestamp } from "drizzle-orm/pg-core";

export const dailyPredictorAddress = pgTable("daily_predictor_address", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull(),
  observation_ts: timestamp({ withTimezone: true }).notNull(),
  worker_address: varchar({ length: 255 }).notNull(),
  worker_vault_address: varchar({ length: 255 }),
  reward_address: varchar({ length: 255 }).notNull(),
  pool_wallet: varchar({ length: 255 }).notNull(),
  pool_vault: varchar({ length: 255 }),
  score: doublePrecision().notNull(),
  reward: doublePrecision().notNull(),
  distributed_reward: doublePrecision().notNull(),
  balance: doublePrecision().notNull(),
  delegated_stake: doublePrecision().notNull(),
  worker_reward_calculated: doublePrecision().notNull(),
  pool_miner_percent: doublePrecision().notNull(),
  miner_earned: doublePrecision().notNull(),
});

export const dailyContributorAddress = pgTable("daily_contributor_address", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull(),
  observation_ts: timestamp({ withTimezone: true }).notNull(),
  contributor: varchar({ length: 255 }).notNull(),
  pool_address: varchar({ length: 255 }).notNull(),
  pool_vault: varchar({ length: 255 }),
  staking_power_contribution: doublePrecision().notNull(),
  contributor_vault: varchar({ length: 255 }),
  pools_own_staking_power: doublePrecision(),
  share: doublePrecision().notNull(),
  reward_calculated: doublePrecision().notNull(),
  distributed_reward: doublePrecision().notNull(),
});

export const dailyInviterAddress = pgTable("daily_inviter_address", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull(),
  sponsor_preferred: varchar({ length: 255 }),
  sponsor_address: varchar({ length: 255 }),
  sponsor_vault_address: varchar({ length: 255 }),
  sponsor_reward_address: varchar({ length: 255 }),
  wallet: varchar({ length: 255 }).notNull(),
  vault: varchar({ length: 255 }).notNull(),
  reward_address: varchar({ length: 255 }),
  score: doublePrecision().notNull(),
  credit: varchar({ length: 255 }).notNull(), // TODO enum? "staker", "sovereign worker", "content creator", "public worker", "private worker"
});

export const dailyManifestAddress = pgTable("daily_manifest_address", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull(),
  wallet: varchar({ length: 255 }).notNull(),
  vault: varchar({ length: 255 }),
  voting_power: doublePrecision().notNull(),
  predictors: smallint().notNull(),
  oracles: smallint().notNull(),
  inviters: smallint().notNull(),
  creators: smallint().notNull(),
  managers: smallint().notNull(),
  predictors_weighted: doublePrecision().notNull(),
  oracles_weighted: doublePrecision().notNull(),
  inviters_weighted: doublePrecision().notNull(),
  creators_weighted: doublePrecision().notNull(),
  managers_weighted: doublePrecision().notNull(),
});
