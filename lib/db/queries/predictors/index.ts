import { sql, desc, and, or, eq } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "../..";
import { dailyPredictorAddress } from "../../schema";

export async function getPredictors(
  poolAddress: string,
  poolVaultAddress: string | undefined,
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
  cacheLife("hours");

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
          // ! for before auto distribution
          eq(dailyPredictorAddress.reward_address, poolAddress),
          poolVaultAddress
            ? eq(dailyPredictorAddress.reward_address, poolVaultAddress)
            : undefined,
          // ! after auto distribution
          eq(dailyPredictorAddress.pool_wallet, poolAddress),
          poolVaultAddress
            ? eq(dailyPredictorAddress.pool_vault, poolVaultAddress)
            : undefined
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
