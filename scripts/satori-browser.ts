import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright-core";

export const SATORI_API_ORIGIN = "https://satorinet.io";
export const SATORI_BROWSER_EXECUTABLE_PATH_ENV = "SATORI_BROWSER_EXECUTABLE_PATH";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface SatoriBrowserResponse {
  status: number;
  body: string;
}

export interface SatoriBrowserFetcher {
  fetch(url: string): Promise<SatoriBrowserResponse>;
  close(): Promise<void>;
}

export interface SatoriBrowserFetcherOptions {
  executablePath?: string;
  timeoutMs?: number;
}

function parseApprovedSatoriApiUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (
      url.origin !== SATORI_API_ORIGIN ||
      !url.pathname.startsWith("/api/") ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

export function isApprovedSatoriApiUrl(value: string): boolean {
  return parseApprovedSatoriApiUrl(value) !== undefined;
}

export function isJsonBody(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

function assertApprovedSatoriApiUrl(value: string): URL {
  const url = parseApprovedSatoriApiUrl(value);
  if (!url) {
    throw new Error(
      `Satori browser fetch only supports ${SATORI_API_ORIGIN}/api/* URLs`,
    );
  }
  return url;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

async function readBody(page: Page, timeoutMs: number): Promise<string> {
  try {
    return (await page.locator("body").textContent({ timeout: Math.max(1, timeoutMs) })) ?? "";
  } catch {
    return "";
  }
}

async function waitForJsonBody(
  page: Page,
  timeoutMs: number,
): Promise<string> {
  try {
    await page.waitForFunction(
      () => {
        try {
          JSON.parse(document.body?.textContent ?? "");
          return true;
        } catch {
          return false;
        }
      },
      undefined,
      { polling: 100, timeout: timeoutMs },
    );
  } catch (error) {
    if (!isTimeout(error)) throw error;
  }
  // Return the body after the bounded wait so callers retain HTTP/challenge errors.
  return readBody(page, Math.min(timeoutMs, 1_000));
}

async function fetchFromPage(
  page: Page,
  target: URL,
  timeoutMs: number,
): Promise<SatoriBrowserResponse> {
  let status: number | undefined;
  const matchesTarget = (value: string): boolean => {
    try {
      const responseUrl = new URL(value);
      return (
        responseUrl.origin === target.origin &&
        responseUrl.pathname === target.pathname &&
        responseUrl.search === target.search
      );
    } catch {
      return false;
    }
  };
  const onResponse = (response: { url(): string; status(): number }) => {
    if (matchesTarget(response.url())) status = response.status();
  };

  page.on("response", onResponse);
  const deadline = Date.now() + timeoutMs;
  try {
    let navigation;
    try {
      navigation = await page.goto(target.href, {
        waitUntil: "commit",
        timeout: Math.max(1, deadline - Date.now()),
      });
    } catch (error) {
      if (isTimeout(error)) {
        throw new Error(`Timed out navigating to ${target.href}`, { cause: error });
      }
      throw error;
    }

    if (navigation) status = navigation.status();
    const body = await waitForJsonBody(
      page,
      Math.max(1, deadline - Date.now()),
    );
    if (!isApprovedSatoriApiUrl(page.url())) {
      throw new Error(`Satori browser navigation left the approved API URL`);
    }
    return { status: status ?? navigation?.status() ?? 0, body };
  } finally {
    page.off("response", onResponse);
  }
}

export function createSatoriBrowserFetcher(
  options: SatoriBrowserFetcherOptions = {},
): SatoriBrowserFetcher {
  const executablePath = (
    options.executablePath ?? process.env[SATORI_BROWSER_EXECUTABLE_PATH_ENV]
  )?.trim();
  if (!executablePath) {
    throw new Error(
      `${SATORI_BROWSER_EXECUTABLE_PATH_ENV} is required to enable browser-backed Satori fetching`,
    );
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Satori browser timeout must be a positive finite number");
  }

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let closed = false;

  const getPage = async (): Promise<Page> => {
    if (closed) throw new Error("Satori browser fetcher is closed");
    if (page) return page;

    try {
      browser = await chromium.launch({ executablePath, headless: false });
      context = await browser.newContext();
      page = await context.newPage();
      return page;
    } catch (error) {
      const failedContext = context;
      const failedBrowser = browser;
      page = undefined;
      context = undefined;
      browser = undefined;
      await failedContext?.close().catch(() => undefined);
      await failedBrowser?.close().catch(() => undefined);
      throw error;
    }
  };

  return {
    async fetch(url) {
      const target = assertApprovedSatoriApiUrl(url);
      return fetchFromPage(await getPage(), target, timeoutMs);
    },

    async close() {
      if (closed) return;
      closed = true;
      const currentContext = context;
      const currentBrowser = browser;
      page = undefined;
      context = undefined;
      browser = undefined;
      try {
        await currentContext?.close();
      } finally {
        await currentBrowser?.close();
      }
    },
  };
}
