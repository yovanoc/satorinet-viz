import { integer, pgTable, varchar, date, doublePrecision } from "drizzle-orm/pg-core";

export const dailyPredictorAddress = pgTable("daily_predictor_address", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull(),
  worker_address: varchar({ length: 255 }).notNull(),
  worker_vault_address: varchar({ length: 255 }),
  reward_address: varchar({ length: 255 }).notNull(),
  score: doublePrecision().notNull(),
  reward: doublePrecision().notNull(),
  balance: doublePrecision().notNull(),
  delegated_stake: doublePrecision().notNull(),
  pool_miner_percent: doublePrecision().notNull(),
  miner_earned: doublePrecision().notNull(),
});

export const dailyContributorAddress = pgTable("daily_contributor_address", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull(),
  contributor: varchar({ length: 255 }).notNull(),
  pool_address: varchar({ length: 255 }).notNull(),
  staking_power_contribution: doublePrecision().notNull(),
  contributor_vault: varchar({ length: 255 }),
});
