import { deepStrictEqual } from "node:assert";
import { test } from "node:test";

import type { AuditStakerRow, AuditWorkerRow } from "../../satorinet/audit";
import { lendersSnapshotFromAudit, workersSnapshotFromAudit } from "./audit-entities";

const DATE = new Date("2026-01-15T00:00:00.000Z");

test("maps audit workers into the existing snapshot contract", () => {
  const rows: AuditWorkerRow[] = [
    {
      observation_ts: "2026-01-15T00:01:00.000Z",
      peer_id: 1,
      worker_wallet: "worker-low",
      worker_vault: null,
      pool_wallet: "pool-a",
      pool_vault: null,
      worker_balance: 10,
      pool_contribution: 250,
      worker_distance: 20,
      worker_reward_calculated: 1,
      distributed_reward: 1,
    },
    {
      observation_ts: "2026-01-15T00:01:00.000Z",
      peer_id: 2,
      worker_wallet: "worker-high",
      worker_vault: "worker-vault",
      pool_wallet: "pool-b",
      pool_vault: "pool-vault",
      worker_balance: 30,
      pool_contribution: 500,
      worker_distance: 40,
      worker_reward_calculated: 3,
      distributed_reward: 3,
    },
  ];

  deepStrictEqual(workersSnapshotFromAudit(DATE, rows), {
    date: "2026-01-15",
    prev_date: null,
    network_avg_reward: 2,
    workers: [
      {
        wallet: "worker-high",
        vault: "worker-vault",
        operator_wallet: "pool-b",
        operator_vault: "pool-vault",
        reward: 3,
        balance: 30,
        distance: 40,
        prev_reward: null,
        reward_rank: 1,
        rank_movement: null,
        activity_state: null,
      },
      {
        wallet: "worker-low",
        vault: null,
        operator_wallet: "pool-a",
        operator_vault: null,
        reward: 1,
        balance: 10,
        distance: 20,
        prev_reward: null,
        reward_rank: 2,
        rank_movement: null,
        activity_state: null,
      },
    ],
  });
});

test("maps positive audit stakers and calculated rewards", () => {
  const base = {
    observation_ts: "2026-01-15T00:01:00.000Z",
    peer_id: 1,
    lender_vault: null,
    lender_reward: null,
    pool_vault: null,
    pool_reward: null,
    pool_balance: 0,
  };
  const rows: AuditStakerRow[] = [
    {
      ...base,
      lender_wallet: "lender",
      pool_wallet: "operator",
      lender_contribution: 25,
      pool_commission: 5,
      share: 25,
      reward_calculated: 2,
    },
    {
      ...base,
      peer_id: 2,
      lender_wallet: "operator",
      pool_wallet: "other-pool",
      lender_contribution: 50,
      pool_commission: 10,
      share: 50,
      reward_calculated: 4,
    },
    {
      ...base,
      peer_id: 3,
      lender_wallet: "inactive",
      pool_wallet: "operator",
      lender_contribution: 0,
      pool_commission: 5,
      share: 0,
      reward_calculated: 0,
    },
  ];

  deepStrictEqual(lendersSnapshotFromAudit(DATE, rows), {
    date: "2026-01-15",
    prev_date: null,
    lenders: [
      {
        wallet: "operator",
        vault: null,
        operator_wallet: "other-pool",
        operator_vault: null,
        contribution: 50,
        share: 50,
        reward: 4,
        pool_commission: 10,
        is_operator: true,
        prev_contribution: null,
        prev_reward: null,
        contribution_rank: 1,
        rank_movement: null,
        activity_state: null,
      },
      {
        wallet: "lender",
        vault: null,
        operator_wallet: "operator",
        operator_vault: null,
        contribution: 25,
        share: 25,
        reward: 2,
        pool_commission: 5,
        is_operator: false,
        prev_contribution: null,
        prev_reward: null,
        contribution_rank: 2,
        rank_movement: null,
        activity_state: null,
      },
    ],
  });
});
