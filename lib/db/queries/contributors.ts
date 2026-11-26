import { sql, desc, and } from "drizzle-orm";
import { db } from "..";
import { poolAddressIn } from "../pool-filter";
import { dailyContributorAddress } from "../schema";
import { cacheLifeForDate } from "../cache-utils";

const labelVault = sql<string | null>`case
  when btrim(${dailyContributorAddress.pool_vault}) = '' then null
  when ${dailyContributorAddress.pool_vault} ~* '^0x[0-9a-f]{40}$' then lower(${dailyContributorAddress.pool_vault})
  else ${dailyContributorAddress.pool_vault}
end`;

export async function getTopPools(date: Date) {
  "use cache";
  cacheLifeForDate(date);

  const ranked = db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`.as("total_staking_power"),
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`.as("contributor_count"),
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
    .as("ranked");

  return db
    .select({
      pool_address: ranked.pool_address,
      label_vault: sql<string | null>`(select case when count(distinct ${labelVault}) = 1 then min(${labelVault}) else null end
        from ${dailyContributorAddress}
        where ${dailyContributorAddress.date} = ${date} and ${dailyContributorAddress.pool_address} = "ranked"."pool_address")`,
      total_staking_power: ranked.total_staking_power,
      contributor_count: ranked.contributor_count,
    })
    .from(ranked)
    .orderBy(desc(ranked.total_staking_power))
    .execute();
}

/**
 * Checks if there are any contributions to a given pool address on a specific date.
 * Returns true if there is at least one contribution, false otherwise.
 */
export async function hasContributionsToPool(
  poolAddress: string,
  poolVaultAddress: string | undefined,
  date: Date
): Promise<boolean> {
  "use cache";
  cacheLifeForDate(date);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(dailyContributorAddress)
    .where(
      and(
        poolAddressIn(
          dailyContributorAddress.pool_address,
          poolAddress,
          poolVaultAddress
        ),
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
  poolVaultAddress: string | undefined,
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
  cacheLifeForDate(date);

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
        poolAddressIn(
          dailyContributorAddress.pool_address,
          poolAddress,
          poolVaultAddress
        ),
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
