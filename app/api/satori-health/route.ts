import { NextResponse } from "next/server";
import { impitFetch } from "@/lib/satorinet/api";


const TARGETS = {
  "satorinet.io": "https://satorinet.io/api/satori-price",
  "network.satorinet.io":
    "https://network.satorinet.io/api/v1/audit/predictors/latest",
} as const;

async function probe(url: string, fetcher: typeof fetch): Promise<string> {
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
    const body = await res.text();
    const challenged = body.includes("Just a moment");
    return `${res.status}${challenged ? " (cloudflare challenge)" : ""}`;
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Diagnostic: which satori hosts are reachable from this deployment. */
export async function GET() {
  const results: Record<string, { impit: string; plainFetch: string }> = {};
  for (const [host, url] of Object.entries(TARGETS)) {
    const [viaImpit, viaPlain] = await Promise.all([
      probe(url, impitFetch),
      probe(url, fetch),
    ]);
    results[host] = { impit: viaImpit, plainFetch: viaPlain };
  }
  return NextResponse.json(results);
}
