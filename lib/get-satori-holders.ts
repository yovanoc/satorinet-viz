import {
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
    try {
      const cached = await getAllSatoriEvrHolders();
      return cached?.length ? classifyAssetHolders(cached) : null;
    } catch (e) {
      console.error("Failed to read Satori holders cache:", e);
      return null;
    }
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
