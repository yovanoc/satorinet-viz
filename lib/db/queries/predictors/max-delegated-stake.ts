import { sql } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getMaxDelegatedStake(date: Date) {
  "use cache";
  cacheLife("max");

  const res = await db
    .select({
      max_delegated_stake: sql<number>`max(${dailyPredictorAddress.delegated_stake})`,
    })
    .from(dailyPredictorAddress)
    .where(sql`${dailyPredictorAddress.date} = ${date}`)
    .execute();

  return res[0]?.max_delegated_stake ?? null;
}

