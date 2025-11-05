import { classifyAssetHolders, getAllSatoriHolders } from "@/lib/satorinet/holders";
import { cacheLife } from "next/cache";
import { saveSatoriEvrHolders } from "./satorinet/holders_cache";

export async function getSatoriHolders() {
  "use cache";
  cacheLife("hours");

  console.log("Fetching Satori holders..." + new Date().toISOString());

  const holders = await getAllSatoriHolders();

  if (!holders) {
    return null;
  }

  const summary = classifyAssetHolders(holders);

  await saveSatoriEvrHolders(summary.assetHolders);

  return summary;
}
