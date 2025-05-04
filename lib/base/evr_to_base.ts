import { redis } from "../redis";

const redisKey = "satori:evr_to_base";
export async function saveEvrToBaseAddresses(data: Map<string, string>) {
  await redis.del(redisKey);
  const p = redis.pipeline();

  for (const [evr, base] of data) {
    p.hset(redisKey, evr, base);
  }
  // p.expire(redisKey, 60 * 60 * 24); // 1 day
  return await p.exec();
}

export async function getBaseAddress(
  address: string
): Promise<string | null> {
  const data = await redis.hget(redisKey, address);
  return data;
}

export async function getAllBaseAddresses(): Promise<Map<string, string>> {
  const data = await redis.hgetall(redisKey);
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(data)) {
    result.set(key, value);
  }
  return result;
}
