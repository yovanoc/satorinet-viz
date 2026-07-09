import type { AuditStakerRow, AuditWorkerRow } from "../../satorinet/audit";
import type { LendersSnapshot, WorkersSnapshot } from "./entities";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function workersSnapshotFromAudit(
  date: Date,
  rows: readonly AuditWorkerRow[]
): WorkersSnapshot {
  const workers = [...rows]
    .sort((a, b) => b.distributed_reward - a.distributed_reward)
    .map((row, index) => ({
      wallet: row.worker_wallet,
      vault: row.worker_vault,
      operator_wallet: row.pool_wallet,
      operator_vault: row.pool_vault,
      reward: row.distributed_reward,
      balance: row.worker_balance,
      distance: row.worker_distance,
      // Audit rows have no prior-day history, so trend and activity fields stay neutral.
      prev_reward: null,
      reward_rank: index + 1,
      rank_movement: null,
      activity_state: null,
    }));
  const totalRewards = workers.reduce((total, worker) => total + worker.reward, 0);

  return {
    date: ymd(date),
    prev_date: null,
    workers,
    network_avg_reward: workers.length > 0 ? totalRewards / workers.length : 0,
  };
}

export function lendersSnapshotFromAudit(
  date: Date,
  rows: readonly AuditStakerRow[]
): LendersSnapshot {
  const operatorWallets = new Set(rows.map((row) => row.pool_wallet));
  const lenders = rows
    .filter((row) => row.lender_contribution > 0)
    .sort((a, b) => b.lender_contribution - a.lender_contribution)
    .map((row, index) => ({
      wallet: row.lender_wallet,
      vault: row.lender_vault,
      operator_wallet: row.pool_wallet,
      operator_vault: row.pool_vault,
      contribution: row.lender_contribution,
      share: row.share,
      reward: row.reward_calculated,
      pool_commission: row.pool_commission,
      is_operator:
        operatorWallets.has(row.lender_wallet) ||
        (row.lender_vault != null && operatorWallets.has(row.lender_vault)),
      // Audit rows have no prior-day history, so trend and activity fields stay neutral.
      prev_contribution: null,
      prev_reward: null,
      contribution_rank: index + 1,
      rank_movement: null,
      activity_state: null,
    }));

  return { date: ymd(date), prev_date: null, lenders };
}
