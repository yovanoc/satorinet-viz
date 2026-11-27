import { Redis } from "ioredis";

import {
  POOL_NAME_INDEX_LIMITS,
  isPoolNameIndexDay,
  parsePoolNameIndex,
  poolNameIndexKey,
  type PoolNameIndex,
} from "./pool-name-index";

const DEADLINE_MS = 150;
const RECONNECT_COOLDOWN_MS = 1_000;
const BYTE_CAP = POOL_NAME_INDEX_LIMITS.serializedBytes;
const utf8 = new TextDecoder("utf-8", { fatal: true });

type IndexRedis = Pick<Redis, "connect" | "disconnect" | "getrangeBuffer">;

function createRedis(url: URL): IndexRedis {
  const options = {
    lazyConnect: true,
    connectTimeout: DEADLINE_MS,
    disconnectTimeout: 0,
    enableReadyCheck: false,
    disableClientInfo: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    reconnectOnError: null,
    autoResendUnfulfilledCommands: false,
  };
  // Strip URL overrides for reader safeguards, but keep the writer's keyPrefix.
  for (const option of Object.keys(options)) url.searchParams.delete(option);
  const client = new Redis(url.href, options);
  client.on("error", () => {}); // Suppress ioredis's default error logging.
  return client;
}

export function createPoolNameIndexReader(
  getUrl: () => string | undefined,
  createClient: (url: URL) => IndexRedis = createRedis,
) {
  let connection: { client: IndexRedis; ready: Promise<void> } | undefined;
  let reconnectAfter = 0;

  return async (day: string): Promise<PoolNameIndex["names"] | undefined> => {
    if (!isPoolNameIndexDay(day) || performance.now() < reconnectAfter) return;

    const deadline = performance.now() + DEADLINE_MS;
    const checkDeadline = () => {
      if (performance.now() >= deadline) throw new Error("Pool name index deadline exceeded");
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current = connection;
    try {
      if (!current) {
        const rawUrl = getUrl()?.trim();
        if (!rawUrl) return;
        const url = new URL(rawUrl);
        if (!url.hostname || !/^rediss?:\/\//.test(rawUrl)) return;
        const client = createClient(url);
        current = connection = { client, ready: Promise.resolve().then(() => client.connect()) };
      }

      const active = current;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Pool name index deadline exceeded")),
          Math.max(0, Math.ceil(deadline - performance.now())),
        );
      });
      const read = async () => {
        await active.ready;
        if (connection !== active) return;
        checkDeadline();
        // Redis's inclusive end returns one extra byte if the value is oversized.
        return active.client.getrangeBuffer(poolNameIndexKey(day), 0, BYTE_CAP);
      };
      const bytes = await Promise.race([read(), timeout]);
      checkDeadline();
      if (connection !== active || !bytes?.length || bytes.length > BYTE_CAP) return;

      let names: PoolNameIndex["names"] | undefined;
      try {
        names = parsePoolNameIndex(JSON.parse(utf8.decode(bytes)), day)?.names;
      } catch {
        // Invalid UTF-8 or JSON is a cache miss, not a connection failure.
      }
      checkDeadline();
      return names;
    } catch {
      if (current && connection === current) {
        connection = undefined;
        reconnectAfter = performance.now() + RECONNECT_COOLDOWN_MS;
        current.client.disconnect();
      }
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Reads the optional display names for an exact UTC day; explicit unknowns remain `null`. */
export const readPoolNameIndex = createPoolNameIndexReader(() => process.env.REDIS_URL);
