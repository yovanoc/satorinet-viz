import { sql, desc, and, or, eq } from "drizzle-orm";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getPredictors(
  poolAddress: string,
  poolVaultAddress: string,
  date: Date,
  limit = 4000
): Promise<
  {
    worker_address: string;
    worker_vault_address: string | null;
    reward_address: string;
    score: number;
    reward: number;
    balance: number;
    delegated_stake: number;
    pool_miner_percent: number;
    miner_earned: number;
  }[]
> {
  "use cache";
  cacheLife("max");

  return db
    .select({
      worker_address: dailyPredictorAddress.worker_address,
      worker_vault_address: dailyPredictorAddress.worker_vault_address,
      reward_address: dailyPredictorAddress.reward_address,
      score: dailyPredictorAddress.score,
      reward: dailyPredictorAddress.reward,
      balance: dailyPredictorAddress.balance,
      delegated_stake: dailyPredictorAddress.delegated_stake,
      pool_miner_percent: dailyPredictorAddress.pool_miner_percent,
      miner_earned: dailyPredictorAddress.miner_earned,
    })
    .from(dailyPredictorAddress)
    .where(
      and(
        sql`${dailyPredictorAddress.date} = ${date}`,
        or(
          eq(dailyPredictorAddress.reward_address, poolAddress),
          eq(dailyPredictorAddress.reward_address, poolVaultAddress)
        )
      )
    )
    .orderBy(
      desc(dailyPredictorAddress.reward),
      desc(dailyPredictorAddress.worker_address)
    )
    .limit(limit)
    .execute();
}
