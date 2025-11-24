import ky from "ky";
import { cacheLife } from "next/cache";
import * as z from "zod/mini";

const BASE_URL = "https://stage.satorinet.io";

const client = ky.create({
  prefixUrl: BASE_URL,
  retry: { limit: 5, methods: ["get", "post"] },
  timeout: 10_000,
  keepalive: true,
});

// TODO https://stage.satorinet.io/api/v0/content/created/get
// TODO getManifestVote - /votes_for/manifest

// export type PoolSize = {};
// export async function getPoolSize(address: string) {
//   'use cache';
//   cacheLife("weeks");;
//
//   return client.get(`pool/size/get/${address}`).json<PoolSize>();
// }

export type WorkerReward = {
  offer: number;
};
export async function getWorkerReward(address: string) {
  "use cache";
  cacheLife("hours");

  try {
    const res = await ky
      .get(`${BASE_URL}/pool/worker/reward/get/${address}`, { retry: 3 })
      .json<[WorkerReward]>();
    return res[0];
  } catch (e) {
    console.error("Error fetching worker reward for", address, e);
    return { offer: 0 };
  }
}

export async function getMiningMode(address: string): Promise<boolean> {
  "use cache";
  cacheLife("hours");

  const res = await ky
    .get(`${BASE_URL}/worker/mining/mode/get/${address}`, { retry: 3 })
    .text();
  return res === "True";
}

export async function getAvailablePublicWorkersCount(): Promise<number> {
  "use cache";
  cacheLife("hours");

  const res = await ky
    .get(`${BASE_URL}/api/v0/get/worker/public/available/count`, { retry: 3 })
    .text();
  const num = parseInt(res);
  return Number.isNaN(num) ? -1 : num;
}

const dailyCountsSchema = z.object({
  neuronCount: z.string(),
  oracleCount: z.string(),
  predictionCount: z.string(),
});
export type DailyCounts = z.infer<typeof dailyCountsSchema>;

export async function getDailyCounts(): Promise<DailyCounts> {
  "use cache";
  cacheLife("days");

  try {
    const res = await client.get(`daily/counts`).json();
    const parsed = dailyCountsSchema.safeParse(res);
    if (!parsed.success) {
      console.error("Failed to parse daily counts", parsed.error);
      return {
        neuronCount: "0",
        oracleCount: "0",
        predictionCount: "0",
      };
    }
    return parsed.data;
  } catch (e) {
    console.error("Error fetching daily counts", e);
    return {
      neuronCount: "0",
      oracleCount: "0",
      predictionCount: "0",
    };
  }
}

const dailyPredictorStatsSchema = z.object({
  "Average Score of Delegated-staked Neurons": z.number(),
  "Average Score of Self-staked Neurons": z.number(),
  "Competing Neurons": z.number(),
  "Current Neuron Version": z.string(),
  "Current Staking Requirement": z.number(),
  Date: z.string(),
  "Delegated-staked Neurons": z.number(),
  "Self-staked Neurons": z.number(),
});

export type DailyPredictorStats = z.infer<typeof dailyPredictorStatsSchema>;

export async function getDailyPredictorStats(
  date?: Date
): Promise<DailyPredictorStats> {
  "use cache";
  cacheLife("hours");

  if (date) {
    try {
      const res = await ky
        .get(
          `${BASE_URL}/reports/daily/stats/predictors/${
            date.toISOString().split("T")[0]
          }`,
          { retry: 3 }
        )
        .json();
      const parsed = dailyPredictorStatsSchema.safeParse(res);
      if (!parsed.success) {
        console.error("Failed to parse daily predictor stats", parsed.error);
        return {
          "Average Score of Delegated-staked Neurons": 0,
          "Average Score of Self-staked Neurons": 0,
          "Competing Neurons": 0,
          "Current Neuron Version": "",
          "Current Staking Requirement": 0,
          Date: "",
          "Delegated-staked Neurons": 0,
          "Self-staked Neurons": 0,
        };
      }
      return parsed.data;
    } catch (e) {
      console.error("Error fetching daily predictor stats", e);
      return {
        "Average Score of Delegated-staked Neurons": 0,
        "Average Score of Self-staked Neurons": 0,
        "Competing Neurons": 0,
        "Current Neuron Version": "",
        "Current Staking Requirement": 0,
        Date: "",
        "Delegated-staked Neurons": 0,
        "Self-staked Neurons": 0,
      };
    }
  }

  const res = await ky
    .get(`${BASE_URL}/reports/daily/stats/predictors/latest`, { retry: 3 })
    .json();
  const parsed = dailyPredictorStatsSchema.safeParse(res);
  if (!parsed.success) {
    console.error("Failed to parse daily predictor stats", parsed.error);
    return {
      "Average Score of Delegated-staked Neurons": 0,
      "Average Score of Self-staked Neurons": 0,
      "Competing Neurons": 0,
      "Current Neuron Version": "",
      "Current Staking Requirement": 0,
      Date: "",
      "Delegated-staked Neurons": 0,
      "Self-staked Neurons": 0,
    };
  }
  return parsed.data;
}

const streamSchema = z.object({
  author: z.int32(),
  cadence: z.int32(),
  datatype: z.nullable(
    z.union([z.literal("float"), z.literal("json"), z.literal("string")])
  ),
  description: z.nullable(z.string()),
  latest_observation_time: z.coerce.date(),
  latest_observation_value: z.string(),
  oracle_address: z.string(),
  oracle_alias: z.nullable(z.string()),
  oracle_pubkey: z.string(),
  predicting_id: z.nullable(z.int32()),
  predictors_count: z.int32(),
  sanctioned: z.int32(),
  source: z.string(),
  stream: z.string(),
  stream_created_ts: z.coerce.date(),
  stream_id: z.int32(),
  tags: z.nullable(z.string()),
  target: z.string(),
  total_vote: z.float64(),
  url: z.nullable(z.string()), // TODO no more url?
  utc_offset: z.int32(),
  uuid: z.uuid(),
});

export type Stream = z.infer<typeof streamSchema>;

const streamsArraySchema = z.array(streamSchema);

export async function streamsSearch(): Promise<Stream[]> {
  "use cache";
  cacheLife("minutes");

  let res: string;

  try {
    res = await client.post(`streams/search`).text();
  } catch (e) {
    console.error("Error fetching streams search", e);
    return [];
  }

  const parsed = safeParseAndSanitize(res);

  const parsedArray = streamsArraySchema.safeParse(parsed);
  if (!parsedArray.success) {
    // console.dir(parsed, { depth: 5 });
    console.error("Failed to parse streams");
    console.dir(parsedArray.error, { depth: 5 });
    return [];
  }

  const sortedStreams = parsedArray.data.toSorted(
    (a, b) => a.total_vote - b.total_vote
  );

  console.log(`Fetched and parsed ${sortedStreams.length} streams`);

  return sortedStreams;
}

export function safeParseAndSanitize(raw: string): unknown {
  try {
    const safe = raw
      .replace(/\bNaN\b/g, "0")
      .replace(/\bundefined\b/g, "0")
      .replace(/\bInfinity\b/g, "0")
      .replace(/\b-null\b/g, "0"); // optional if your source might use -null

    const parsed = JSON.parse(safe);
    return parsed;
  } catch (e) {
    console.error("Invalid JSON input:", e);
    return null;
  }
}

export async function getSubscribers(): Promise<unknown> {
  "use cache";
  cacheLife("seconds");

  const res = await ky
    .get(`${BASE_URL}/api/v0/get/subscribers`, {
      retry: 3,
    })
    .json();

  return res;
}

const streamsPubSubSchema = z.record(z.string(), z.array(z.string()));

export type StreamsPubSub = z.infer<typeof streamsPubSubSchema>;

export async function getStreamsSubscribers(
  streams: string[]
): Promise<StreamsPubSub> {
  "use cache";
  cacheLife("seconds");

  const res = await ky
    .post(`${BASE_URL}/api/v0/get/stream/subscribers`, {
      json: { streams },
      retry: 3,
    })
    .json();

  const parsed = streamsPubSubSchema.safeParse(res);
  if (!parsed.success) {
    console.error("Failed to parse streams subscribers", parsed.error);
    return {};
  }
  return parsed.data;
}

export async function getStreamsPublishers(
  streams: string[]
): Promise<StreamsPubSub> {
  "use cache";
  cacheLife("seconds");

  const res = await ky
    .post(`${BASE_URL}/api/v0/get/stream/publisher`, {
      json: { streams },
      retry: 3,
    })
    .json();

  const parsed = streamsPubSubSchema.safeParse(res);
  if (!parsed.success) {
    console.error("Failed to parse streams publishers", parsed.error);
    return {};
  }
  return parsed.data;
}

export async function getDataManagerPortByAddress(
  address: string
): Promise<number> {
  "use cache";
  cacheLife("seconds");

  const res = await ky
    .get(`${BASE_URL}/api/v0/datamanager/port/get/${address}`, { retry: 3 })
    .text();
  console.log(res);
  const num = parseInt(res);
  return Number.isNaN(num) ? -1 : num;
}
