import { NextResponse } from "next/server";
import { sql, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyContributorAddress, dailyPredictorAddress } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const now = new Date();
  let targetDate: Date;

  if (dateParam) {
    const [year, month, day] = dateParam.split("-").map(Number);
    targetDate = new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0));
  } else {
    targetDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    );
  }

  const dateStr = targetDate.toISOString();
  const dateOnly = dateStr.split("T")[0];

  const [contributors, predictors, contributorDates, predictorDates] =
    await Promise.all([
      db
        .select({
          pool_address: dailyContributorAddress.pool_address,
          total_sp: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
          count: sql<number>`count(*)`,
          has_sp: sql<number>`count(*) filter (where ${dailyContributorAddress.staking_power_contribution} > 0)`,
        })
        .from(dailyContributorAddress)
        .where(sql`${dailyContributorAddress.date} = ${targetDate}`)
        .groupBy(dailyContributorAddress.pool_address)
        .orderBy(desc(sql`sum(${dailyContributorAddress.staking_power_contribution})`))
        .limit(10)
        .execute(),

      db
        .select({
          reward_address: dailyPredictorAddress.reward_address,
          count: sql<number>`count(*)`,
          total_reward: sql<number>`sum(${dailyPredictorAddress.reward})`,
        })
        .from(dailyPredictorAddress)
        .where(sql`${dailyPredictorAddress.date} = ${targetDate}`)
        .groupBy(dailyPredictorAddress.reward_address)
        .orderBy(desc(sql<number>`count(*)`))
        .limit(10)
        .execute(),

      db
        .select({
          date: dailyContributorAddress.date,
          count: sql<number>`count(*)`,
        })
        .from(dailyContributorAddress)
        .where(
          sql`${dailyContributorAddress.date} >= ${targetDate}::date - interval '7 days'
              AND ${dailyContributorAddress.date} <= ${targetDate}::date + interval '2 days'`
        )
        .groupBy(dailyContributorAddress.date)
        .orderBy(dailyContributorAddress.date)
        .execute(),

      db
        .select({
          date: dailyPredictorAddress.date,
          count: sql<number>`count(*)`,
        })
        .from(dailyPredictorAddress)
        .where(
          sql`${dailyPredictorAddress.date} >= ${targetDate}::date - interval '7 days'
              AND ${dailyPredictorAddress.date} <= ${targetDate}::date + interval '2 days'`
        )
        .groupBy(dailyPredictorAddress.date)
        .orderBy(dailyPredictorAddress.date)
        .execute(),
    ]);

  const topPoolsQuery = db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      total_staking_power: sql<number>`sum(${dailyContributorAddress.staking_power_contribution})`,
      contributor_count: sql<number>`count(distinct ${dailyContributorAddress.contributor})`,
    })
    .from(dailyContributorAddress)
    .where(
      and(
        sql`${dailyContributorAddress.date} = ${targetDate}`,
        sql`${dailyContributorAddress.staking_power_contribution} > 0`
      )
    )
    .groupBy(dailyContributorAddress.pool_address)
    .orderBy(desc(sql`sum(${dailyContributorAddress.staking_power_contribution})`))
    .limit(30);

  const topPoolsSQL = topPoolsQuery.toSQL();
  const topPools = await topPoolsQuery.execute();

  return NextResponse.json({
    input: {
      dateParam,
      jsDate: dateStr,
      dateOnly,
      serverNow: now.toISOString(),
      serverTZ: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    topPools_result: topPools,
    topPools_sql: {
      query: topPoolsSQL.sql,
      params: topPoolsSQL.params.map((p) =>
        p instanceof Date ? { type: "Date", iso: p.toISOString(), toString: p.toString() } : p
      ),
    },
    contributors_for_date: contributors,
    predictors_for_date: predictors,
    contributor_dates_nearby: contributorDates,
    predictor_dates_nearby: predictorDates,
  });
}
