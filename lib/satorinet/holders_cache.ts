import { redis } from '../redis';
import type { AssetHolderWithRank } from './holders';

export type AssetHolderDataWithRankAndTotal = Omit<AssetHolderWithRank, 'address'> & {
  total: number;
};

const redisKey = 'satori:holders:evr';
export async function saveSatoriEvrHolders(data: AssetHolderWithRank[]) {
  await redis.del(redisKey);
  const p = redis.pipeline();
  for (const holder of data) {
    const d: AssetHolderDataWithRankAndTotal = {
      balance: holder.balance,
      rank: holder.rank,
      total: data.length,
    };
    p.hset(redisKey, holder.address, JSON.stringify(d));
  }
  p.expire(redisKey, 60 * 60 * 24); // 1 day
  return await p.exec();
}

export async function getSatoriHolder(address: string): Promise<AssetHolderDataWithRankAndTotal | null> {
  const data = await redis.hget(redisKey, address);
  if (data) {
    const parsedData = JSON.parse(data) as AssetHolderDataWithRankAndTotal;
    return parsedData;
  }
  return null;
}
