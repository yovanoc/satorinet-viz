import { NextResponse } from "next/server";
import { sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dailyContributorAddress,
  dailyPredictorAddress,
} from "@/lib/db/schema";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  const now = new Date();

  // Build both a Date object and a plain string for comparison testing
  let dateOnly: string;
  let targetDate: Date;

  if (dateParam) {
    dateOnly = dateParam; // already "YYYY-MM-DD"
    const [year, month, day] = dateParam.split("-").map(Number);
    targetDate = new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0));
  } else {
    targetDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0
      )
    );
    dateOnly = targetDate.toISOString().split("T")[0]!;
  }

  // ---- Test A: compare with JS Date object (current approach) ----
  const withDateObj = await db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      count: sql<number>`count(*)`,
    })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = ${targetDate}`)
    .groupBy(dailyContributorAddress.pool_address)
    .limit(5)
    .execute();

  // ---- Test B: compare with plain string "YYYY-MM-DD" ----
  const withString = await db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      count: sql<number>`count(*)`,
    })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = ${dateOnly}`)
    .groupBy(dailyContributorAddress.pool_address)
    .limit(5)
    .execute();

  // ---- Test C: cast to ::date explicitly ----
  const withCast = await db
    .select({
      pool_address: dailyContributorAddress.pool_address,
      count: sql<number>`count(*)`,
    })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = ${targetDate}::date`)
    .groupBy(dailyContributorAddress.pool_address)
    .limit(5)
    .execute();

  // ---- Nearby dates (string-based) ----
  const contributorDates = await db
    .select({
      date: dailyContributorAddress.date,
      count: sql<number>`count(*)`,
    })
    .from(dailyContributorAddress)
    .where(
      sql`${dailyContributorAddress.date} >= ${dateOnly}::date - interval '7 days'
          AND ${dailyContributorAddress.date} <= ${dateOnly}::date + interval '2 days'`
    )
    .groupBy(dailyContributorAddress.date)
    .orderBy(dailyContributorAddress.date)
    .execute();

  // ---- SQL inspection ----
  const testQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(dailyContributorAddress)
    .where(sql`${dailyContributorAddress.date} = ${targetDate}`);
  const testSQL = testQuery.toSQL();

  return NextResponse.json({
    input: {
      dateParam,
      dateOnly,
      jsDateISO: targetDate.toISOString(),
      jsDateToString: targetDate.toString(),
      serverNow: now.toISOString(),
      serverTZ: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    comparison: {
      withDateObj_rows: withDateObj.length,
      withDateObj,
      withString_rows: withString.length,
      withString,
      withCast_rows: withCast.length,
      withCast,
    },
    contributor_dates_nearby: contributorDates,
    sql_inspection: {
      query: testSQL.sql,
      params: testSQL.params.map((p) =>
        p instanceof Date
          ? {
              type: "Date",
              iso: p.toISOString(),
              toString: p.toString(),
              localDate: `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}-${String(p.getDate()).padStart(2, "0")}`,
              utcDate: `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}-${String(p.getUTCDate()).padStart(2, "0")}`,
            }
          : p
      ),
    },
  });
}
