import { classifyAssetHolders, getAllSatoriHolders } from "@/lib/satorinet/holders";
import { unstable_cacheLife as cacheLife } from "next/cache";

export async function getSatoriHolders() {
  "use cache";
  cacheLife("hours");

  console.log("Fetching Satori holders..." + new Date().toISOString());

  const holders = await getAllSatoriHolders();

  if (!holders) {
    return null;
  }

  const summary = classifyAssetHolders(holders);

  return {
    holders,
    summary,
  }
}
