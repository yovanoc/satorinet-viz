import { unstable_cacheLife as cacheLife } from 'next/cache'
import { electrumxClient, type AssetHolder } from './electrumx';

export const getAllSatoriHolders = async () => {
  'use cache';
  cacheLife('hours');
  try {
    await electrumxClient.connectToServer();
    const holders = await electrumxClient.getAssetHolders(null, 'SATORI');
    electrumxClient.disconnect();
    return holders;
  } catch (e) {
    console.error('Error connecting to ElectrumX server:', e);
    return null;
  }
}

export const tiers = [
  { name: '🦐 Shrimp', min: 0, max: 0.19 },
  { name: '🦀 Crab', min: 0.19, max: 1.90 },
  { name: '🐙 Octopus', min: 1.90, max: 9.52 },
  { name: '🐟 Fish', min: 9.52, max: 19.05 },
  { name: '🐬 Dolphin', min: 19.05, max: 95.24 },
  { name: '🦈 Shark', min: 95.24, max: 190.48 },
  { name: '🐋 Whale', min: 190.48, max: 952.38 },
  { name: '🐳 Mega Whale', min: 952.38, max: 10000 },
  { name: '🔱 Aquaman', min: 10000, max: Infinity },
] as const;

export type TierName = typeof tiers[number]['name'];
export type TierData = {
  total: number,
  count: number,
  percentAmount: number,
  percentCount: number,
  wallets: { address: string, balance: number }[]
};
export type Tiers = Record<TierName, TierData>;

export type HoldersSummary = {
  totalSatori: number;
  tiers: Tiers;
};

export const classifyAssetHolders = (assetHolders: AssetHolder[]) => {
  const summary: HoldersSummary = {
      totalSatori: 0,
      tiers: {
          '🦐 Shrimp': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🦀 Crab': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🐙 Octopus': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🐟 Fish': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🐬 Dolphin': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🦈 Shark': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🐋 Whale': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🐳 Mega Whale': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
          '🔱 Aquaman': { total: 0, percentAmount: 0, percentCount: 0, count: 0, wallets: [] },
      },
  };

  tiers.forEach(tier => {
      summary.tiers[tier.name] = { total: 0, percentCount: 0, percentAmount: 0, count: 0, wallets: [] };
  });

  const scale = Math.pow(10, 8);
  assetHolders.forEach(({ address, balance }) => {
      summary.totalSatori += Math.round(balance * scale);
      const tier = tiers.find(tier => balance >= tier.min && balance < tier.max);
      if (tier) {
          const tierData = summary.tiers[tier.name];
          tierData.total += balance;
          tierData.count += 1;
          tierData.wallets.push({ address, balance });
      }
  });

  summary.totalSatori /= scale;

  for (const tierName of Object.keys(summary.tiers) as TierName[]) {
      const tierData = summary.tiers[tierName];
      tierData.percentAmount = (tierData.total / summary.totalSatori) * 100;
      tierData.percentCount = (tierData.count / assetHolders.length) * 100;
  }

  return summary;
};
