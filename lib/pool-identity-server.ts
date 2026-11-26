import { KNOWN_POOLS } from "./known_pools";
import { getAllBaseAddresses } from "./base/evr_to_base";
import { redis } from "./redis";
import { buildPoolIdentities } from "./pool-identity";

export async function getPoolIdentities() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const [mappings, keys] = await Promise.all([
          getAllBaseAddresses(),
          redis.keys("evr:wallet:*"),
        ]);
        const pipeline = redis.pipeline();
        keys.forEach((key) => pipeline.smembers(key));
        const rows = keys.length ? await pipeline.exec() : [];
        if (!rows || rows.length !== keys.length || rows.some(([error, value]) => error || !Array.isArray(value))) {
          throw new Error("Incomplete wallet-vault records");
        }
        const vaults = new Map<string, string[]>();
        rows.forEach(([, value], index) => vaults.set(keys[index]!.slice("evr:wallet:".length), value as string[]));
        return buildPoolIdentities(KNOWN_POOLS, mappings, vaults);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Pool identity read timed out")), 250);
        timer.unref();
      }),
    ]);
  } catch (error) {
    console.error("Unable to resolve pool identities", error);
    return buildPoolIdentities(KNOWN_POOLS, new Map(), new Map());
  } finally {
    clearTimeout(timer);
  }
}
