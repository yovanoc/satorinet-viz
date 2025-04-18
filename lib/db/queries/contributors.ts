import { sql, desc } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
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
    .where(sql`${dailyContributorAddress.date} = ${date}`)
    .groupBy(dailyContributorAddress.pool_address)
    .orderBy(
      desc(sql`sum(${dailyContributorAddress.staking_power_contribution})`)
    )
    .limit(15)
    .execute();
}
