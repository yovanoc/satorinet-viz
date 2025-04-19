import { sql, and, asc, gte, lte, or } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "..";
import { dailyManifestAddress } from "../schema";

export async function getManifestForDate(date: Date) {
  "use cache";
  cacheLife("max");

  const res = await db
    .select({
      date: dailyManifestAddress.date,
      predictors_weighted: sql<number>`sum(${dailyManifestAddress.predictors_weighted})`,
      oracles_weighted: sql<number>`sum(${dailyManifestAddress.oracles_weighted})`,
      inviters_weighted: sql<number>`sum(${dailyManifestAddress.inviters_weighted})`,
      creators_weighted: sql<number>`sum(${dailyManifestAddress.creators_weighted})`,
      managers_weighted: sql<number>`sum(${dailyManifestAddress.managers_weighted})`,
    })
    .from(dailyManifestAddress)
    .where(sql`${dailyManifestAddress.date} = ${date}`)
    .groupBy(dailyManifestAddress.date)
    .orderBy(asc(dailyManifestAddress.date))
    .execute();
  return res[0] || null;
}

export async function getManifests(date: Date, days = 30) {
  "use cache";
  cacheLife("max");

  const res = await db
    .select({
      date: dailyManifestAddress.date,
      predictors_weighted: sql<number>`sum(${dailyManifestAddress.predictors_weighted})`,
      oracles_weighted: sql<number>`sum(${dailyManifestAddress.oracles_weighted})`,
      inviters_weighted: sql<number>`sum(${dailyManifestAddress.inviters_weighted})`,
      creators_weighted: sql<number>`sum(${dailyManifestAddress.creators_weighted})`,
      managers_weighted: sql<number>`sum(${dailyManifestAddress.managers_weighted})`,
    })
    .from(dailyManifestAddress)
    .where(
      and(
        gte(
          dailyManifestAddress.date,
          sql`${date}::timestamp - ${days} * interval '1 day'`
        ),
        lte(dailyManifestAddress.date, sql`${date}`)
      )
    )
    .groupBy(dailyManifestAddress.date)
    .orderBy(asc(dailyManifestAddress.date))
    .execute();

  return res;
}

export async function getManifestsForAddress(date: Date, address: string, days = 30) {
  "use cache";
  cacheLife("max");

  const res = await db
    .select({
      date: dailyManifestAddress.date,
      wallet: dailyManifestAddress.wallet,
      vault: dailyManifestAddress.vault,
      voting_power: dailyManifestAddress.voting_power,
      predictors: dailyManifestAddress.predictors,
      oracles: dailyManifestAddress.oracles,
      inviters: dailyManifestAddress.inviters,
      creators: dailyManifestAddress.creators,
      managers: dailyManifestAddress.managers,
    })
    .from(dailyManifestAddress)
    .where(
      and(
        gte(
          dailyManifestAddress.date,
          sql`${date}::timestamp - ${days} * interval '1 day'`
        ),
        lte(dailyManifestAddress.date, sql`${date}`),
        or(
          sql`${dailyManifestAddress.wallet} = ${address}`,
          sql`${dailyManifestAddress.vault} = ${address}`
        )
      )
    )
    .groupBy(
      dailyManifestAddress.date,
      dailyManifestAddress.wallet,
      dailyManifestAddress.vault,
      dailyManifestAddress.voting_power,
      dailyManifestAddress.predictors,
      dailyManifestAddress.oracles,
      dailyManifestAddress.inviters,
      dailyManifestAddress.creators,
      dailyManifestAddress.managers
    )
    .orderBy(asc(dailyManifestAddress.date))
    .execute();
  return res;
}
