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
      percent: holder.percent,
      tier: holder.tier,
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

export async function getAllSatoriEvrHolders(): Promise<AssetHolderWithRank[] | null> {
  const all = await redis.hgetall(redisKey);
  const entries = Object.entries(all);
  if (entries.length === 0) return null;

  const holders: AssetHolderWithRank[] = [];
  for (const [address, json] of entries) {
    try {
      const parsed = JSON.parse(json) as AssetHolderDataWithRankAndTotal;
      holders.push({
        address,
        balance: parsed.balance,
        rank: parsed.rank,
        percent: parsed.percent,
        tier: parsed.tier,
      });
    } catch {
      // Ignore malformed cache entries.
    }
  }

  return holders.length > 0 ? holders : null;
}
