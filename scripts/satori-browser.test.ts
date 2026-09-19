import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSatoriBrowserFetcher,
  isApprovedSatoriApiUrl,
  isJsonBody,
  SATORI_BROWSER_EXECUTABLE_PATH_ENV,
} from "./satori-browser";

test("browser URL validation stays on the approved Satori JSON origin", () => {
  assert.equal(
    isApprovedSatoriApiUrl("https://satorinet.io/api/satori-price"),
    true,
  );
  assert.equal(
    isApprovedSatoriApiUrl("https://satorinet.io/api/leaderboard?date=2026-01-01"),
    true,
  );

  for (const url of [
    "http://satorinet.io/api/satori-price",
    "https://www.satorinet.io/api/satori-price",
    "https://network.satorinet.io/api/v1/audit/stakers/latest",
    "https://satorinet.io/not-api/satori-price",
    "https://example.com/api/satori-price",
  ]) {
    assert.equal(isApprovedSatoriApiUrl(url), false, url);
  }
});

test("JSON body detection distinguishes API data from a challenge page", () => {
  assert.equal(isJsonBody('{"price":0.12}'), true);
  assert.equal(isJsonBody("Just a moment..."), false);
  assert.equal(isJsonBody("<html><body>challenge</body></html>"), false);
});

test("browser initialization is lazy and closes without a launched browser", async () => {
  const fetcher = createSatoriBrowserFetcher({
    executablePath: "/does-not-exist/google-chrome",
    timeoutMs: 25,
  });

  await assert.rejects(
    fetcher.fetch("https://network.satorinet.io/api/v1/audit/stakers/latest"),
    /only supports https:\/\/satorinet\.io\/api\/\* URLs/,
  );
  await fetcher.close();
  await fetcher.close();
  await assert.rejects(
    fetcher.fetch("https://satorinet.io/api/satori-price"),
    /fetcher is closed/,
  );
});

test(
  "headed Chrome fetches the public JSON endpoint and can be closed",
  { skip: !process.env[SATORI_BROWSER_EXECUTABLE_PATH_ENV] },
  async () => {
    const fetcher = createSatoriBrowserFetcher();
    try {
      const response = await fetcher.fetch("https://satorinet.io/api/satori-price");
      assert.equal(response.status, 200);
      assert.equal(isJsonBody(response.body), true);
    } finally {
      await fetcher.close();
    }
  },
);
