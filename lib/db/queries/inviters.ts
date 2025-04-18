import { sql, eq } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "..";

export async function getInvitersForDate(date: Date) {
  "use cache";
  cacheLife("max");

  const res = await db.query.dailyInviterAddress
    .findMany({
      where: (inviter) => eq(inviter.date, sql`${date}`),
    })
    .execute();
  return res;
}
