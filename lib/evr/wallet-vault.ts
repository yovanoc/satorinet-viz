import { redis } from "../redis";

export async function saveWalletVaults(walletToVaults: Map<string, string[]>) {
  const pipeline = redis.pipeline();

  for (const [wallet, vaults] of walletToVaults.entries()) {
    const walletKey = `evr:wallet:${wallet}`;
    // pipeline.del(walletKey); // ! clean existing vaults for wallet
    if (vaults.length > 0) {
      pipeline.sadd(walletKey, ...vaults);
      vaults.forEach(vault => {
        pipeline.set(`evr:vault:${vault}`, wallet);
      });
    }
  }

  await pipeline.exec();
}

export async function getAllWalletVaults(): Promise<Map<string, string[]>> {
  const keys = await redis.keys("evr:wallet:*");
  const walletToVaults = new Map<string, string[]>();

  if (keys.length === 0) return walletToVaults;

  const pipeline = redis.pipeline();
  keys.forEach(key => pipeline.smembers(key));
  const results = await pipeline.exec();

  results?.forEach((res, index) => {
    if (!res) {
      console.error(`Missing result for key: ${keys[index]}`);
      return;
    }

    const [err, vaults] = res;
    const wallet = keys[index]!.split(":").pop()!;
    if (!err && Array.isArray(vaults)) {
      walletToVaults.set(wallet, vaults);
    } else {
      console.error(`Error fetching vaults for ${keys[index]}:`, err);
    }
  });

  return walletToVaults;
}

export async function getVaultsForWallet(wallet: string): Promise<string[]> {
  return await redis.smembers(`evr:wallet:${wallet}`);
}

export async function getWalletForVault(vault: string): Promise<string | null> {
  return await redis.get(`evr:vault:${vault}`);
}

export async function resolveAddress(address: string): Promise<
  | { type: 'wallet'; vaults: string[] }
  | { type: 'vault'; wallet: string }
  | { type: 'unknown' }
> {
  const [vaults, wallet] = await Promise.all([
    redis.smembers(`evr:wallet:${address}`),
    redis.get(`evr:vault:${address}`),
  ]);

  if (vaults.length > 0) {
    return { type: 'wallet', vaults };
  } else if (wallet) {
    return { type: 'vault', wallet };
  } else {
    return { type: 'unknown' };
  }
}

export async function getTopWalletsByVaultCount(limit = 10): Promise<(readonly [string, number])[]> {
  const walletToVaults = await getAllWalletVaults();

  const sorted = [...walletToVaults.entries()]
    .map(([wallet, vaults]) => [wallet, vaults.length] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return sorted;
}
