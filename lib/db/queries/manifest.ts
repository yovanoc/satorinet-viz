import { sql, and, asc, gte, lte } from "drizzle-orm";
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
