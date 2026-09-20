/** Read-only comparison from the network where the warmer actually runs. */
import { execFileSync } from "node:child_process";
import { impitFetch, SATORI_BROWSER_USER_AGENT } from "../lib/satorinet/transport";
import { createSatoriBrowserFetcher } from "./satori-browser";

function report(url: string, client: string, status: number, body: string) {
  let validPrice = false;
  try {
    const value = JSON.parse(body);
    validPrice = typeof value.price === "number";
  } catch { /* A challenge response is not JSON. */ }
  console.log(JSON.stringify({ url, client, status, validPrice,
    challenge: body.includes("Just a moment") }));
}

async function main() {
  for (const host of ["satorinet.io", "www.satorinet.io"]) {
    const url = `https://${host}/api/satori-price`;
    for (const browser of [false, true]) {
      const client = browser ? "curl-browser-ua" : "curl-default";
      try {
        const result = execFileSync("curl", [
          "--silent", "--show-error", "--max-time", "20", "--write-out", "\n%{http_code}",
          ...(browser ? ["--user-agent", SATORI_BROWSER_USER_AGENT] : []), url,
        ], { encoding: "utf8", timeout: 25_000 });
        const split = result.lastIndexOf("\n");
        report(url, client, Number(result.slice(split + 1)), result.slice(0, split));
      } catch { console.log(JSON.stringify({ url, client, error: "Request failed" })); }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    for (const [client, request] of [["native-fetch", fetch], ["impit", impitFetch]] as const) {
      try {
        const response = await request(url, { signal: AbortSignal.timeout(20_000) });
        report(url, client, response.status, await response.text());
      } catch { console.log(JSON.stringify({ url, client, error: "Request failed" })); }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  if (process.env.SATORI_BROWSER_EXECUTABLE_PATH?.trim()) {
    const browser = createSatoriBrowserFetcher();
    const url = "https://satorinet.io/api/satori-price";
    try {
      const response = await browser.fetch(url);
      report(url, "chrome", response.status, response.body);
    } catch { console.log(JSON.stringify({ url, client: "chrome", error: "Request failed" })); }
    finally { await browser.close(); }
  }

}
void main();
