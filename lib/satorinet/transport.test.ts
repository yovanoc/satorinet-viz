import { strict as assert } from "node:assert";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { test } from "node:test";
import ky from "ky";

import { impitFetch, SATORI_BROWSER_USER_AGENT } from "./transport";

async function startServer() {
  const received: IncomingHttpHeaders[] = [];
  const server = createServer((request, response) => {
    received.push(request.headers);
    if (request.url?.endsWith("/json")) {
      response.setHeader("content-type", "application/json");
      response.end("{}");
    } else {
      response.setHeader("content-type", "text/csv");
      response.end("column\nvalue\n");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  return { server, received, url: `http://127.0.0.1:${address.port}` };
}

test("shared Satorinet fetch preserves Ky Request headers and UA", async () => {
  const { server, received, url } = await startServer();
  const client = ky.create({ fetch: impitFetch, retry: { limit: 0 } });

  try {
    const request = new Request(`${url}/json`, {
      headers: {
        "x-request-header": "from-request",
        // Request-specific headers must not remove the required UA.
        "user-agent": "",
      },
    });
    await client(request).json();
    await client
      .get(`${url}/csv`, { headers: { "x-option-header": "from-options" } })
      .text();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  assert.equal(received.length, 2);
  assert.equal(received[0]?.["user-agent"], SATORI_BROWSER_USER_AGENT);
  assert.match(String(received[0]?.["sec-ch-ua"]), /"Chromium";v="151"/);
  assert.equal(received[0]?.["x-request-header"], "from-request");
  assert.equal(received[0]?.accept, "application/json");
  assert.equal(received[1]?.["user-agent"], SATORI_BROWSER_USER_AGENT);
  assert.equal(received[1]?.["x-option-header"], "from-options");
  assert.equal(received[1]?.accept, "text/*");
});

test("explicit init headers replace Request headers", async () => {
  const { server, received, url } = await startServer();

  try {
    await impitFetch(
      new Request(`${url}/json`, { headers: { "x-request-header": "old" } }),
      { headers: { "x-init-header": "new" } },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  assert.equal(received[0]?.["x-request-header"], undefined);
  assert.equal(received[0]?.["x-init-header"], "new");
  assert.equal(received[0]?.["user-agent"], SATORI_BROWSER_USER_AGENT);
});


test("Request abort signals reach the underlying transport", async () => {
  const { server, received, url } = await startServer();
  try {
    await assert.rejects(impitFetch(new Request(`${url}/json`, {
      signal: AbortSignal.abort(),
    })));
    assert.equal(received.length, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
