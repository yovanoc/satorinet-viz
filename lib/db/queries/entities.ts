import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "..";
import { cacheLifeForDate } from "../cache-utils";
import { getAuditStakers, getAuditWorkers } from "../../satorinet/audit";
import { lendersSnapshotFromAudit, workersSnapshotFromAudit } from "./audit-entities";

export type ActivityState = "new" | "returned" | null;

type Row = Record<string, unknown>;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function queryRows(query: ReturnType<typeof sql.raw>): Promise<Row[]> {
  const res = await db.execute(query);
  return res.rows as Row[];
}

/** Most recent date with predictor data at or before the given date. */
export async function getLatestDataDate(date: Date): Promise<string | null> {
  "use cache";
  cacheLifeForDate(date);

  const rows = await queryRows(
    sql.raw(
      `select max(date)::text as date from daily_predictor_address where date <= '${ymd(date)}'`
    )
  );
  return rows[0]?.date ? String(rows[0].date) : null;
}

async function previousDataDate(date: string): Promise<string | null> {
  const rows = await queryRows(
    sql.raw(
      `select max(date)::text as date from daily_predictor_address where date < '${date}'`
    )
  );
  return rows[0]?.date ? String(rows[0].date) : null;
}

/* ------------------------------------------------------------------ */
/* Workers                                                             */
/* ------------------------------------------------------------------ */

export type WorkerRow = {
  wallet: string;
  vault: string | null;
  operator_wallet: string;
  operator_vault: string | null;
  reward: number;
  balance?: number;
  distance?: number;
  prev_reward: number | null;
  reward_rank: number;
  rank_movement: number | null;
  activity_state: ActivityState;
};

export type WorkersSnapshot = {
  date: string;
  prev_date: string | null;
  workers: WorkerRow[];
  network_avg_reward: number;
};

export async function getWorkersSnapshot(date: Date): Promise<WorkersSnapshot | null> {
  const auditRows = await getAuditWorkers(date);
  if (auditRows && auditRows.length > 0) return workersSnapshotFromAudit(date, auditRows);
  return getWorkersSnapshotFromDb(date);
}

async function getWorkersSnapshotFromDb(date: Date): Promise<WorkersSnapshot | null> {
  "use cache";
  cacheLifeForDate(date);

  const day = await getLatestDataDate(date);
  if (!day) return null;
  const prevDay = await previousDataDate(day);

  const workerSelect = (d: string) => `
    select
      worker_address as wallet,
      max(worker_vault_address) as vault,
      max(pool_wallet) as operator_wallet,
      max(pool_vault) as operator_vault,
      sum(reward) as reward
    from daily_predictor_address
    where date = '${d}'
    group by worker_address`;

  const [today, prev, firstSeen] = await Promise.all([
    queryRows(sql.raw(`${workerSelect(day)} order by sum(reward) desc`)),
    prevDay ? queryRows(sql.raw(workerSelect(prevDay))) : Promise.resolve([]),
    queryRows(
      sql.raw(`
        select worker_address as wallet
        from daily_predictor_address
        group by worker_address
        having min(date) = '${day}'
      `)
    ),
  ]);

  const newSet = new Set(firstSeen.map((r) => str(r.wallet)));
  const prevByWallet = new Map(prev.map((r) => [str(r.wallet), r]));
  const prevRanks = new Map(
    [...prev]
      .sort((a, b) => num(b.reward) - num(a.reward))
      .map((r, i) => [str(r.wallet), i + 1])
  );

  let totalRewards = 0;
  const workers: WorkerRow[] = today.map((r, i) => {
    const wallet = str(r.wallet);
    const prevRow = prevByWallet.get(wallet);
    const prevRank = prevRanks.get(wallet);
    totalRewards += num(r.reward);
    return {
      wallet,
      vault: r.vault ? str(r.vault) : null,
      operator_wallet: str(r.operator_wallet),
      operator_vault: r.operator_vault ? str(r.operator_vault) : null,
      reward: num(r.reward),
      prev_reward: prevRow ? num(prevRow.reward) : null,
      reward_rank: i + 1,
      rank_movement: prevRank != null ? prevRank - (i + 1) : null,
      activity_state: prevRow ? null : newSet.has(wallet) ? "new" : "returned",
    };
  });

  return {
    date: day,
    prev_date: prevDay,
    workers,
    network_avg_reward: workers.length > 0 ? totalRewards / workers.length : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Operators                                                           */
/* ------------------------------------------------------------------ */

export type OperatorRow = {
  wallet: string;
  vault: string | null;
  worker_count: number;
  total_rewards: number;
  stake_power: number;
  lender_count: number;
  stake_lended: number;
  prev_worker_count: number | null;
  prev_total_rewards: number | null;
  prev_stake_power: number | null;
  prev_lender_count: number | null;
  activity_state: ActivityState;
};

export type OperatorsSnapshot = {
  date: string;
  prev_date: string | null;
  operators: OperatorRow[];
  /** Network average reward per worker (for efficiency normalization). */
  network_avg_reward: number;
  prev_network_avg_reward: number | null;
  /** Stake required per worker (max observed delegated stake). */
  stake_per_worker: number;
};

export async function getOperatorsSnapshot(date: Date): Promise<OperatorsSnapshot | null> {
  "use cache";
  cacheLifeForDate(date);

  const day = await getLatestDataDate(date);
  if (!day) return null;
  const prevDay = await previousDataDate(day);

  const operatorSelect = (d: string) => `
    select
      pool_wallet as wallet,
      max(pool_vault) as vault,
      count(distinct worker_address) as worker_count,
      coalesce(sum(reward), 0) as total_rewards,
      coalesce(sum(delegated_stake), 0) as stake_power,
      coalesce(max(delegated_stake), 0) as max_stake
    from daily_predictor_address
    where date = '${d}' and pool_wallet <> ''
    group by pool_wallet`;

  const lenderSelect = (d: string) => `
    select
      pool_address as wallet,
      count(distinct contributor) filter (where staking_power_contribution > 0) as lender_count,
      coalesce(sum(staking_power_contribution), 0) as stake_lended
    from daily_contributor_address
    where date = '${d}'
    group by pool_address`;

  const [today, prev, lenders, prevLenders, firstSeen] = await Promise.all([
    queryRows(sql.raw(operatorSelect(day))),
    prevDay ? queryRows(sql.raw(operatorSelect(prevDay))) : Promise.resolve([]),
    queryRows(sql.raw(lenderSelect(day))),
    prevDay ? queryRows(sql.raw(lenderSelect(prevDay))) : Promise.resolve([]),
    queryRows(
      sql.raw(`
        select pool_wallet as wallet
        from daily_predictor_address
        where pool_wallet <> ''
        group by pool_wallet
        having min(date) = '${day}'
      `)
    ),
  ]);

  const newSet = new Set(firstSeen.map((r) => str(r.wallet)));
  const prevByWallet = new Map(prev.map((r) => [str(r.wallet), r]));
  // Lender aggregates are keyed by pool wallet OR vault, so index both.
  const lendersByPool = new Map(lenders.map((r) => [str(r.wallet), r]));
  const prevLendersByPool = new Map(prevLenders.map((r) => [str(r.wallet), r]));

  const lenderFor = (map: Map<string, Row>, wallet: string, vault: string | null) =>
    map.get(wallet) ?? (vault ? map.get(vault) : undefined);

  let totalRewards = 0;
  let totalWorkers = 0;
  let prevTotalRewards = 0;
  let prevTotalWorkers = 0;
  for (const r of today) {
    totalRewards += num(r.total_rewards);
    totalWorkers += num(r.worker_count);
  }
  for (const r of prev) {
    prevTotalRewards += num(r.total_rewards);
    prevTotalWorkers += num(r.worker_count);
  }

  const operators: OperatorRow[] = today
    .map((r) => {
      const wallet = str(r.wallet);
      const vault = r.vault ? str(r.vault) : null;
      const prevRow = prevByWallet.get(wallet);
      const lender = lenderFor(lendersByPool, wallet, vault);
      const prevLender = lenderFor(prevLendersByPool, wallet, vault);
      return {
        wallet,
        vault,
        worker_count: num(r.worker_count),
        total_rewards: num(r.total_rewards),
        stake_power: num(r.stake_power),
        lender_count: num(lender?.lender_count),
        stake_lended: num(lender?.stake_lended),
        prev_worker_count: prevRow ? num(prevRow.worker_count) : null,
        prev_total_rewards: prevRow ? num(prevRow.total_rewards) : null,
        prev_stake_power: prevRow ? num(prevRow.stake_power) : null,
        prev_lender_count: prevLender ? num(prevLender.lender_count) : null,
        activity_state: (prevRow
          ? null
          : newSet.has(wallet)
            ? "new"
            : "returned") as ActivityState,
      };
    })
    .sort((a, b) => b.worker_count - a.worker_count);

  return {
    date: day,
    prev_date: prevDay,
    operators,
    network_avg_reward: totalWorkers > 0 ? totalRewards / totalWorkers : 0,
    prev_network_avg_reward:
      prevTotalWorkers > 0 ? prevTotalRewards / prevTotalWorkers : null,
    stake_per_worker: Math.max(...today.map((r) => num(r.max_stake)), 0),
  };
}

/* ------------------------------------------------------------------ */
/* Lenders                                                             */
/* ------------------------------------------------------------------ */

export type LenderRow = {
  wallet: string;
  vault: string | null;
  operator_wallet: string;
  operator_vault: string | null;
  contribution: number;
  share: number;
  reward: number;
  pool_commission?: number;
  is_operator: boolean;
  prev_contribution: number | null;
  prev_reward: number | null;
  contribution_rank: number;
  rank_movement: number | null;
  activity_state: ActivityState;
};

export type LendersSnapshot = {
  date: string;
  prev_date: string | null;
  lenders: LenderRow[];
};

export async function getLendersSnapshot(date: Date): Promise<LendersSnapshot | null> {
  const auditRows = await getAuditStakers(date);
  if (auditRows && auditRows.length > 0) return lendersSnapshotFromAudit(date, auditRows);
  return getLendersSnapshotFromDb(date);
}

async function getLendersSnapshotFromDb(date: Date): Promise<LendersSnapshot | null> {
  "use cache";
  cacheLifeForDate(date);

  const day = await getLatestDataDate(date);
  if (!day) return null;
  const prevDay = await previousDataDate(day);

  const lenderSelect = (d: string) => `
    select
      contributor as wallet,
      max(contributor_vault) as vault,
      pool_address as operator_wallet,
      max(pool_vault) as operator_vault,
      coalesce(sum(staking_power_contribution), 0) as contribution,
      coalesce(sum(share), 0) as share,
      coalesce(sum(distributed_reward), 0) as reward
    from daily_contributor_address
    where date = '${d}' and staking_power_contribution > 0
    group by contributor, pool_address`;

  const [today, prev, firstSeen, operatorWallets] = await Promise.all([
    queryRows(sql.raw(`${lenderSelect(day)} order by sum(staking_power_contribution) desc`)),
    prevDay ? queryRows(sql.raw(lenderSelect(prevDay))) : Promise.resolve([]),
    queryRows(
      sql.raw(`
        select contributor as wallet
        from daily_contributor_address
        where staking_power_contribution > 0
        group by contributor
        having min(date) = '${day}'
      `)
    ),
    queryRows(
      sql.raw(`
        select distinct pool_wallet as wallet from daily_predictor_address where date = '${day}'
        union
        select distinct pool_vault as wallet from daily_predictor_address where date = '${day}' and pool_vault is not null
      `)
    ),
  ]);

  const key = (w: unknown, op: unknown) => `${str(w)}:${str(op)}`;
  const newSet = new Set(firstSeen.map((r) => str(r.wallet)));
  const operatorSet = new Set(operatorWallets.map((r) => str(r.wallet)));
  const prevByKey = new Map(prev.map((r) => [key(r.wallet, r.operator_wallet), r]));
  const prevWallets = new Set(prev.map((r) => str(r.wallet)));
  const prevRanks = new Map(
    [...prev]
      .sort((a, b) => num(b.contribution) - num(a.contribution))
      .map((r, i) => [key(r.wallet, r.operator_wallet), i + 1])
  );

  const lenders: LenderRow[] = today.map((r, i) => {
    const wallet = str(r.wallet);
    const vault = r.vault ? str(r.vault) : null;
    const k = key(r.wallet, r.operator_wallet);
    const prevRow = prevByKey.get(k);
    const prevRank = prevRanks.get(k);
    return {
      wallet,
      vault,
      operator_wallet: str(r.operator_wallet),
      operator_vault: r.operator_vault ? str(r.operator_vault) : null,
      contribution: num(r.contribution),
      share: num(r.share) * 100,
      reward: num(r.reward),
      is_operator: operatorSet.has(wallet) || (vault != null && operatorSet.has(vault)),
      prev_contribution: prevRow ? num(prevRow.contribution) : null,
      prev_reward: prevRow ? num(prevRow.reward) : null,
      contribution_rank: i + 1,
      rank_movement: prevRank != null ? prevRank - (i + 1) : null,
      activity_state: prevWallets.has(wallet)
        ? null
        : newSet.has(wallet)
          ? "new"
          : "returned",
    };
  });

  return { date: day, prev_date: prevDay, lenders };
}

/* ------------------------------------------------------------------ */
/* Participants                                                        */
/* ------------------------------------------------------------------ */

export type Participant = {
  wallet: string;
  vault: string | null;
  is_operator: boolean;
  is_lender: boolean;
  activity_state: ActivityState | "left";
};

export type ParticipantsSnapshot = {
  date: string;
  prev_date: string | null;
  active: Participant[];
  left: Participant[];
};

export async function getParticipantsSnapshot(date: Date): Promise<ParticipantsSnapshot | null> {
  "use cache";
  cacheLifeForDate(date);

  const day = await getLatestDataDate(date);
  if (!day) return null;
  const prevDay = await previousDataDate(day);

  const participantSelect = (d: string) => `
    select
      wallet,
      max(vault) as vault,
      bool_or(is_operator) as is_operator,
      bool_or(is_lender) as is_lender
    from (
      select contributor as wallet, contributor_vault as vault, false as is_operator, true as is_lender
      from daily_contributor_address where date = '${d}' and staking_power_contribution > 0
      union all
      select pool_wallet as wallet, pool_vault as vault, true as is_operator, false as is_lender
      from daily_predictor_address where date = '${d}' and pool_wallet <> ''
    ) roles
    group by wallet`;

  const [today, prev, firstSeen] = await Promise.all([
    queryRows(sql.raw(participantSelect(day))),
    prevDay ? queryRows(sql.raw(participantSelect(prevDay))) : Promise.resolve([]),
    queryRows(
      sql.raw(`
        select wallet from (
          select contributor as wallet, date from daily_contributor_address where staking_power_contribution > 0
          union all
          select pool_wallet as wallet, date from daily_predictor_address where pool_wallet <> ''
        ) t
        group by wallet
        having min(date) = '${day}'
      `)
    ),
  ]);

  const newSet = new Set(firstSeen.map((r) => str(r.wallet)));
  const todayWallets = new Set(today.map((r) => str(r.wallet)));
  const prevWallets = new Set(prev.map((r) => str(r.wallet)));

  const active: Participant[] = today.map((r) => {
    const wallet = str(r.wallet);
    return {
      wallet,
      vault: r.vault ? str(r.vault) : null,
      is_operator: Boolean(r.is_operator),
      is_lender: Boolean(r.is_lender),
      activity_state: prevWallets.has(wallet)
        ? null
        : newSet.has(wallet)
          ? "new"
          : "returned",
    };
  });

  const left: Participant[] = prev
    .filter((r) => !todayWallets.has(str(r.wallet)))
    .map((r) => ({
      wallet: str(r.wallet),
      vault: r.vault ? str(r.vault) : null,
      is_operator: Boolean(r.is_operator),
      is_lender: Boolean(r.is_lender),
      activity_state: "left" as const,
    }));

  return { date: day, prev_date: prevDay, active, left };
}

export type MovementDay = {
  date: string;
  new_count: number;
  returned_count: number;
  left_count: number;
};

/** Daily lifecycle movement (new / back / left) across all participants. */
export async function getParticipantsMovementHistory(): Promise<MovementDay[]> {
  "use cache";
  cacheLife("hours");

  const rows = await queryRows(
    sql.raw(`
      with presence as (
        select distinct wallet, date from (
          select contributor as wallet, date from daily_contributor_address where staking_power_contribution > 0
          union all
          select pool_wallet as wallet, date from daily_predictor_address where pool_wallet <> ''
        ) t
      ),
      tracked as (
        select
          wallet,
          date,
          min(date) over (partition by wallet) as first_date,
          lag(date) over (partition by wallet order by date) as prev_date,
          lead(date) over (partition by wallet order by date) as next_date
        from presence
      ),
      dates as (select distinct date from presence),
      arrivals as (
        select
          date,
          count(*) filter (where first_date = date) as new_count,
          count(*) filter (where first_date < date and (prev_date is null or prev_date < date - 1)) as returned_count
        from tracked
        group by date
      ),
      departures as (
        select date + 1 as date, count(*) as left_count
        from tracked
        where next_date is null or next_date > date + 1
        group by date + 1
      )
      select
        d.date::text as date,
        coalesce(a.new_count, 0) as new_count,
        coalesce(a.returned_count, 0) as returned_count,
        coalesce(l.left_count, 0) as left_count
      from dates d
      left join arrivals a on a.date = d.date
      left join departures l on l.date = d.date
      order by d.date
    `)
  );

  return rows.map((r) => ({
    date: String(r.date),
    new_count: num(r.new_count),
    returned_count: num(r.returned_count),
    left_count: num(r.left_count),
  }));
}

/* ------------------------------------------------------------------ */
/* Address network activity                                            */
/* ------------------------------------------------------------------ */

export type AddressNetworkDay = {
  date: string;
  worker_reward: number;
  lender_contribution: number;
  lender_reward: number;
  operator_rewards: number;
  operator_stake_power: number;
  operator_worker_count: number;
};

export type AddressNetworkActivity = {
  roles: { worker: boolean; lender: boolean; operator: boolean };
  history: AddressNetworkDay[];
};

/** Daily network activity of one identity across its worker / lender / operator roles. */
export async function getAddressNetworkActivity(
  address: string
): Promise<AddressNetworkActivity> {
  "use cache";
  cacheLife("hours");

  // Guard: addresses are base58, but never interpolate anything else.
  if (!/^[a-zA-Z0-9]{20,64}$/.test(address)) {
    return { roles: { worker: false, lender: false, operator: false }, history: [] };
  }

  const [worker, lender, operator] = await Promise.all([
    queryRows(
      sql.raw(`
        select date::text as date, coalesce(sum(reward), 0) as worker_reward
        from daily_predictor_address
        where worker_address = '${address}' or worker_vault_address = '${address}'
        group by date
      `)
    ),
    queryRows(
      sql.raw(`
        select
          date::text as date,
          coalesce(sum(staking_power_contribution), 0) as lender_contribution,
          coalesce(sum(distributed_reward), 0) as lender_reward
        from daily_contributor_address
        where contributor = '${address}' or contributor_vault = '${address}'
        group by date
      `)
    ),
    queryRows(
      sql.raw(`
        select
          date::text as date,
          coalesce(sum(reward), 0) as operator_rewards,
          coalesce(sum(delegated_stake), 0) as operator_stake_power,
          count(distinct worker_address) as operator_worker_count
        from daily_predictor_address
        where pool_wallet = '${address}' or pool_vault = '${address}'
        group by date
      `)
    ),
  ]);

  const byDate = new Map<string, AddressNetworkDay>();
  const entry = (date: string): AddressNetworkDay => {
    let e = byDate.get(date);
    if (!e) {
      e = {
        date,
        worker_reward: 0,
        lender_contribution: 0,
        lender_reward: 0,
        operator_rewards: 0,
        operator_stake_power: 0,
        operator_worker_count: 0,
      };
      byDate.set(date, e);
    }
    return e;
  };

  for (const r of worker) entry(String(r.date)).worker_reward = num(r.worker_reward);
  for (const r of lender) {
    const e = entry(String(r.date));
    e.lender_contribution = num(r.lender_contribution);
    e.lender_reward = num(r.lender_reward);
  }
  for (const r of operator) {
    const e = entry(String(r.date));
    e.operator_rewards = num(r.operator_rewards);
    e.operator_stake_power = num(r.operator_stake_power);
    e.operator_worker_count = num(r.operator_worker_count);
  }

  return {
    roles: {
      worker: worker.length > 0,
      lender: lender.length > 0,
      operator: operator.length > 0,
    },
    history: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
