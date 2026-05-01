import {
  tiers as tierDefs,
  type TierName,
  classifyAssetHolders,
  getAllSatoriHolders,
} from "@/lib/satorinet/holders";
import { cacheLife } from "next/cache";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import {
  getAllSatoriEvrHolders,
  saveSatoriEvrHolders,
} from "./satorinet/holders_cache";

export async function getSatoriHolders() {
  "use cache";
  const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
  cacheLife({ revalidate: isBuild ? 60 : 3600 });

  console.log("Fetching Satori holders..." + new Date().toISOString());

  const fromCachedHolders = async () => {
    const cached = await getAllSatoriEvrHolders();
    if (!cached || cached.length === 0) {
      return null;
    }

    // Ensure stable ordering.
    const assetHolders = cached.toSorted((a, b) => a.rank - b.rank);

    const tiers = Object.fromEntries(
      tierDefs.map((t) => [
        t.name,
        { total: 0, count: 0, percentAmount: 0, percentCount: 0, wallets: [] },
      ]),
    ) as unknown as Record<
      TierName,
      {
        total: number;
        count: number;
        percentAmount: number;
        percentCount: number;
        wallets: { address: string; balance: number; rank: number }[];
      }
    >;

    let totalSatori = 0;
    for (const holder of assetHolders) {
      totalSatori += holder.balance;
      if (holder.tier) {
        const tier = tiers[holder.tier];
        tier.total += holder.balance;
        tier.count += 1;
        tier.wallets.push({
          address: holder.address,
          balance: holder.balance,
          rank: holder.rank,
        });
      }
    }

    const totalCount = assetHolders.length;
    for (const tierName of Object.keys(tiers) as TierName[]) {
      const tier = tiers[tierName];
      tier.percentAmount = totalSatori > 0 ? (tier.total / totalSatori) * 100 : 0;
      tier.percentCount = totalCount > 0 ? (tier.count / totalCount) * 100 : 0;
    }

    return { totalSatori, tiers, assetHolders };
  };

  // During `next build`, avoid slow external calls that can trip
  // USE_CACHE_TIMEOUT while prerendering.
  if (isBuild) {
    return fromCachedHolders();
  }

  // In runtime, prefer a fresh ElectrumX fetch. If that fails, gracefully
  // fall back to Redis so the dashboard still renders.
  const holders = await getAllSatoriHolders();

  if (holders) {
    const summary = classifyAssetHolders(holders);

    // Best-effort cache update; don't block the response path.
    void saveSatoriEvrHolders(summary.assetHolders).catch((e) => {
      console.error("Failed to save Satori holders cache:", e);
    });

    return summary;
  }

  return fromCachedHolders();
}
