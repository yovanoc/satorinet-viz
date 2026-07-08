import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "..";

export type NetworkDailyStats = {
  date: string;
  // workers
  total_workers: number;
  active_workers: number;
  rewarded_workers: number;
  total_rewards: number;
  avg_worker_reward: number;
  rewards_std: number;
  // stake
  total_stake_power: number;
  stake_per_worker: number;
  network_capacity: number;
  idle_capacity: number;
  stake_usage: number;
  total_stake_lended: number;
  pool_stake_power: number;
  pools_count: number;
  // participants
  total_operators: number;
  active_operators: number;
  total_lenders: number;
  active_lenders: number;
  total_participants: number;
  active_participants: number;
};

type Row = Record<string, unknown>;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function queryRows(query: ReturnType<typeof sql.raw>): Promise<Row[]> {
  const res = await db.execute(query);
  return res.rows as Row[];
}

/**
 * Daily network-wide aggregates across the whole history, assembled from the
 * predictor (workers) and contributor (lenders) snapshot tables.
 *
 * "total_*" entity counts are cumulative unique identities ever seen, while
 * "active_*" counts are the identities present on that day. Participants are
 * the union of lenders and operators (pool wallets).
 */
export async function getNetworkHistory(): Promise<NetworkDailyStats[]> {
  "use cache";
  cacheLife("hours");

  const [predictorDaily, contributorDaily, poolDaily, firstSeen, activeParticipants] =
    await Promise.all([
      queryRows(sql.raw(`
        select
          date::text as date,
          count(distinct worker_address) as active_workers,
          count(distinct worker_address) filter (where reward > 0) as rewarded_workers,
          coalesce(sum(reward), 0) as total_rewards,
          coalesce(avg(reward) filter (where reward > 0), 0) as avg_worker_reward,
          coalesce(stddev_samp(reward) filter (where reward > 0), 0) as rewards_std,
          coalesce(sum(delegated_stake), 0) as total_stake_power,
          coalesce(max(delegated_stake), 0) as stake_per_worker,
          count(distinct pool_wallet) filter (where pool_wallet <> '') as active_operators
        from daily_predictor_address
        group by date
        order by date
      `)),
      queryRows(sql.raw(`
        select
          date::text as date,
          count(distinct contributor) filter (where staking_power_contribution > 0) as active_lenders,
          coalesce(sum(staking_power_contribution), 0) as total_stake_lended
        from daily_contributor_address
        group by date
      `)),
      queryRows(sql.raw(`
        select
          date,
          count(*) filter (where lended > 0) as pools_count,
          coalesce(sum(own_power + lended), 0) as pool_stake_power
        from (
          select
            date::text as date,
            pool_address,
            max(coalesce(pools_own_staking_power, 0)) as own_power,
            coalesce(sum(staking_power_contribution), 0) as lended
          from daily_contributor_address
          group by date, pool_address
        ) per_pool
        group by date
      `)),
      queryRows(sql.raw(`
        with workers as (
          select worker_address as id, min(date) as first_date
          from daily_predictor_address
          group by worker_address
        ),
        operators as (
          select pool_wallet as id, min(date) as first_date
          from daily_predictor_address
          where pool_wallet <> ''
          group by pool_wallet
        ),
        lenders as (
          select contributor as id, min(date) as first_date
          from daily_contributor_address
          where staking_power_contribution > 0
          group by contributor
        ),
        participants as (
          select id, min(first_date) as first_date
          from (
            select id, first_date from operators
            union all
            select id, first_date from lenders
          ) unioned
          group by id
        )
        select 'worker' as kind, first_date::text as date, count(*) as new_count from workers group by first_date
        union all
        select 'operator' as kind, first_date::text as date, count(*) as new_count from operators group by first_date
        union all
        select 'lender' as kind, first_date::text as date, count(*) as new_count from lenders group by first_date
        union all
        select 'participant' as kind, first_date::text as date, count(*) as new_count from participants group by first_date
      `)),
      queryRows(sql.raw(`
        select date::text as date, count(distinct id) as active_participants
        from (
          select date, contributor as id
          from daily_contributor_address
          where staking_power_contribution > 0
          union
          select date, pool_wallet as id
          from daily_predictor_address
          where pool_wallet <> ''
        ) unioned
        group by date
      `)),
    ]);

  const contributorByDate = new Map(contributorDaily.map((r) => [String(r.date), r]));
  const poolByDate = new Map(poolDaily.map((r) => [String(r.date), r]));
  const activeParticipantsByDate = new Map(
    activeParticipants.map((r) => [String(r.date), num(r.active_participants)])
  );

  const newByKindAndDate = new Map<string, number>();
  for (const r of firstSeen) {
    newByKindAndDate.set(`${r.kind}:${r.date}`, num(r.new_count));
  }

  // Walk every date (union of both tables) in order so cumulative counters
  // stay correct even if one table is missing a day the other has.
  const allDates = [
    ...new Set([
      ...predictorDaily.map((r) => String(r.date)),
      ...contributorDaily.map((r) => String(r.date)),
    ]),
  ].sort();

  let totalWorkers = 0;
  let totalOperators = 0;
  let totalLenders = 0;
  let totalParticipants = 0;

  const predictorByDate = new Map(predictorDaily.map((r) => [String(r.date), r]));
  const history: NetworkDailyStats[] = [];

  for (const date of allDates) {
    totalWorkers += newByKindAndDate.get(`worker:${date}`) ?? 0;
    totalOperators += newByKindAndDate.get(`operator:${date}`) ?? 0;
    totalLenders += newByKindAndDate.get(`lender:${date}`) ?? 0;
    totalParticipants += newByKindAndDate.get(`participant:${date}`) ?? 0;

    const predictor = predictorByDate.get(date);
    if (!predictor) continue;

    const contributor = contributorByDate.get(date);
    const pool = poolByDate.get(date);

    const activeWorkers = num(predictor.active_workers);
    if (activeWorkers === 0) continue;

    const totalStakePower = num(predictor.total_stake_power);
    const stakePerWorker = num(predictor.stake_per_worker);
    const networkCapacity =
      stakePerWorker > 0 ? Math.floor(totalStakePower / stakePerWorker) : 0;

    history.push({
      date,
      total_workers: totalWorkers,
      active_workers: activeWorkers,
      rewarded_workers: num(predictor.rewarded_workers),
      total_rewards: num(predictor.total_rewards),
      avg_worker_reward: num(predictor.avg_worker_reward),
      rewards_std: num(predictor.rewards_std),
      total_stake_power: totalStakePower,
      stake_per_worker: stakePerWorker,
      network_capacity: networkCapacity,
      idle_capacity: Math.max(networkCapacity - activeWorkers, 0),
      stake_usage:
        networkCapacity > 0 ? (activeWorkers / networkCapacity) * 100 : 0,
      total_stake_lended: num(contributor?.total_stake_lended),
      pool_stake_power: num(pool?.pool_stake_power),
      pools_count: num(pool?.pools_count),
      total_operators: totalOperators,
      active_operators: num(predictor.active_operators),
      total_lenders: totalLenders,
      active_lenders: num(contributor?.active_lenders),
      total_participants: totalParticipants,
      active_participants: activeParticipantsByDate.get(date) ?? 0,
    });
  }

  return history;
}
