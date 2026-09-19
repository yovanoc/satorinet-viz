import { Impit } from "impit";

/** A normal browser UA is required by the Satorinet Cloudflare edge. */
export const SATORI_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SATORI_ACCEPT = "application/json, text/csv, */*";

const impit = new Impit({
  browser: "chrome",
  headers: {
    "User-Agent": SATORI_BROWSER_USER_AGENT,
    Accept: SATORI_ACCEPT,
  },
});

/**
 * Keep the headers on the actual Impit request. Ky supplies request-specific
 * headers, which otherwise can override Impit's browser defaults.
 */
export const impitFetch: typeof fetch = async (input, init) => {
  const requestHeaders =
    init?.headers !== undefined
      ? init.headers
      : typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined;
  const headers = new Headers(requestHeaders);
  headers.set("User-Agent", SATORI_BROWSER_USER_AGENT);
  if (!headers.has("Accept")) headers.set("Accept", SATORI_ACCEPT);

  // SAFETY: Impit accepts the same request fields used by fetch; its narrower
  // RequestInit type only omits standard fields this adapter never supplies.
  const response = await impit.fetch(input, {
    ...init,
    headers,
  } as Parameters<Impit["fetch"]>[1]);
  // SAFETY: Ky only consumes status, headers, ok, url, clone, json, and text;
  // ImpitResponse implements all of those Response members.
  return response as unknown as Response;
};
