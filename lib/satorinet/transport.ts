import { Impit } from "impit";

/** A normal browser UA is required by the Satorinet Cloudflare edge. */
export const SATORI_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";
const SATORI_ACCEPT = "application/json, text/csv, */*";

// The generic "chrome" alias still emulates Chrome 124 in Impit 0.14.5.
const impit = new Impit({ browser: "chrome151" });

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
  // Keep Impit’s native UA aligned with its TLS profile and client hints.
  headers.delete("User-Agent");
  if (!headers.has("Accept")) headers.set("Accept", SATORI_ACCEPT);

  // SAFETY: Impit accepts the same request fields used by fetch; its narrower
  // RequestInit type only omits standard fields this adapter never supplies.
  const response = await impit.fetch(input, {
    ...init,
    signal: init?.signal ?? (input instanceof Request ? input.signal : undefined),
    headers,
  } as Parameters<Impit["fetch"]>[1]);
  // SAFETY: Ky only consumes status, headers, ok, url, clone, json, and text;
  // ImpitResponse implements all of those Response members.
  return response as unknown as Response;
};
