import { sql, desc, and } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "..";
import { dailyContributorAddress } from "../schema";

export async function getTopPools(date: Date) {
  "use cache";
  cacheLife("max");

  return db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(
      and(
        sql`${dailyContributorAddress.date} = ${date}`,
        sql`${dailyContributorAddress.staking_power_contribution} > 0`
      )
    )
    .groupBy(dailyContributorAddress.pool_address)
    .orderBy(
      desc(sql`sum(${dailyContributorAddress.staking_power_contribution})`)
    )
    .limit(30)
    .execute();
}

/**
 * Checks if there are any contributions to a given pool address on a specific date.
 * Returns true if there is at least one contribution, false otherwise.
 */
export async function hasContributionsToPool(
  poolAddress: string,
  date: Date
): Promise<boolean> {
  "use cache";
  cacheLife("max");

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(dailyContributorAddress)
    .where(
      and(
        sql`${dailyContributorAddress.pool_address} = ${poolAddress}`,
        sql`${dailyContributorAddress.date} = ${date}`,
        sql`${dailyContributorAddress.staking_power_contribution} > 0`
      )
    )
    .limit(1)
    .execute();

  return (result[0]?.count ?? 0) > 0;
}

export async function getContributors(
  poolAddress: string,
  date: Date,
  limit = 200
): Promise<{
  contributor: string;
  contributor_vault: string | null;
  pools_own_staking_power: number | null;
  poolAddress: string;
  staking_power_contribution: number;
}[]> {
  "use cache";
  cacheLife("max");

  return db
    .select({
      contributor: dailyContributorAddress.contributor,
      contributor_vault: dailyContributorAddress.contributor_vault,
      pools_own_staking_power: dailyContributorAddress.pools_own_staking_power,
      poolAddress: dailyContributorAddress.pool_address,
      staking_power_contribution:
        dailyContributorAddress.staking_power_contribution,
    })
    .from(dailyContributorAddress)
    .where(
      and(
        sql`${dailyContributorAddress.pool_address} = ${poolAddress}`,
        sql`${dailyContributorAddress.date} = ${date}`,
        sql`${dailyContributorAddress.staking_power_contribution} > 0`
      )
    )
    .orderBy(
      desc(dailyContributorAddress.staking_power_contribution),
      desc(dailyContributorAddress.contributor)
    )
    .limit(limit)
    .execute();
}
