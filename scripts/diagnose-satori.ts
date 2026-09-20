/** Read-only comparison from the network where the warmer actually runs. */
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { Impit, type ImpitOptions } from "impit";
import { impitFetch, SATORI_BROWSER_USER_AGENT } from "../lib/satorinet/transport";

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
  const profiles: [string, ImpitOptions][] = [
    ["impit-chrome151-native", { browser: "chrome151" }],
    ["impit-chrome151-ua124", { browser: "chrome151", headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } }],
    ["impit-chrome-native", { browser: "chrome" }],
    ["impit-chrome142-native", { browser: "chrome142" }],
    ["impit-firefox144-native", { browser: "firefox144" }],
  ];
  for (const [client, options] of profiles) {
    const impit = new Impit(options);
    // Capture actual emitted identity headers locally, without a third-party echo server.
    const server = createServer((request, response) => {
      console.log(JSON.stringify({ client, userAgent: request.headers["user-agent"],
        clientHints: request.headers["sec-ch-ua"] }));
      response.end("{}");
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing local probe address");
      const echo = await impit.fetch(`http://127.0.0.1:${address.port}`, { signal: AbortSignal.timeout(5_000) });
      await echo.text();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const url = "https://satorinet.io/api/satori-price";
    try {
      const response = await impit.fetch(url, { signal: AbortSignal.timeout(20_000) });
      report(url, client, response.status, await response.text());
    } catch { console.log(JSON.stringify({ url, client, error: "Request failed" })); }
    await new Promise((resolve) => setTimeout(resolve, 3500));
  }
}
void main();
