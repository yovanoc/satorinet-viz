import { getPoolIdentities } from "@/lib/pool-identity-server";
import { sql, desc, and, or } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "../..";
import { poolAddressIn } from "../../pool-filter";
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

  const identities = await getPoolIdentities();
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
          poolAddressIn(
            dailyPredictorAddress.reward_address,
            poolAddress,
            poolVaultAddress,
            identities
          ),
          // ! after auto distribution
          poolAddressIn(
            dailyPredictorAddress.pool_wallet,
            poolAddress,
            poolVaultAddress,
            identities
          ),
          poolAddressIn(
            dailyPredictorAddress.pool_vault,
            poolAddress,
            poolVaultAddress,
            identities
          )
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
