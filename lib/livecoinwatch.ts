import ky from "ky";
import { env } from "./env";
import { cacheLife } from "next/cache";
import Bottleneck from "bottleneck";
import { redis } from "./redis";

const DELAY = 450 * 1000; // 450 seconds in milliseconds
const MAX_RETRIES = 10;

export async function getSatoriPriceForDate(date: Date): Promise<number> {
  const cacheKey = `satori-price-${date.toISOString()}`;
  const cachedPrice = await redis.get(cacheKey);
  if (cachedPrice) {
    return parseFloat(cachedPrice);
  }
  const price = await getSatoriPriceForDateLocal(date);
  await redis.setex(cacheKey, 60 * 60 * 24 * 7, price);
  return price;
}

interface LiveCoinWatchResult {
  history: { date: number; rate: number }[];
}

function getClosestPrice(
  result: LiveCoinWatchResult,
  date: Date,
  allowedDiff = DELAY,
  attempt?: number
): number {
    // Take the closest price to the time
  const closest = result.history.reduce((prev, curr) =>
    Math.abs(date.getTime() - curr.date) < Math.abs(date.getTime() - prev.date)
      ? curr
      : prev
  );

  const diff = Math.abs(closest.date - date.getTime());

  if (diff > allowedDiff) {
    console.error(
      `No price found for date: ${date} - attempt ${attempt ?? "n/a"} - ${JSON.stringify(
        closest
      )} - diff ${diff} ms (allowed ${allowedDiff} ms)`
    );
    throw new Error("No price found");
  }

  return closest.rate;
}

async function getSatoriPriceForDateLocal(date: Date): Promise<number> {
  "use cache";
  cacheLife("max");
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const windowSize = DELAY * Math.pow(2, attempt);
    const end = date.getTime() + windowSize;
    const start = date.getTime() - windowSize;
    const res = await getSatoriPriceLivecoinwatch(start, end);

    if (res.history.length > 0) {
      return getClosestPrice(res, date, windowSize, attempt + 1);
    }
  }

  console.error(
    `LiveCoinWatch history empty after ${MAX_RETRIES} attempts for ${date.toISOString()}`
  );
  throw new Error("No price history available");
}

const limiter = new Bottleneck({
  reservoir: 20,
  reservoirIncreaseAmount: 2,
  // ! must be divisible by 250
  reservoirIncreaseInterval: 1000,
  reservoirIncreaseMaximum: 20,
  maxConcurrent: 3,
  minTime: 250,
});

export async function getSatoriPriceLivecoinwatch(
  start: number,
  end: number
): Promise<LiveCoinWatchResult> {
  "use cache";
  cacheLife("max");

  return await limiter.schedule(() =>
    ky
      .post("https://api.livecoinwatch.com/coins/single/history", {
        headers: {
          "x-api-key": env.LIVECOINWATCH_API_KEY,
          "Content-Type": "application/json",
        },
        json: {
          currency: "USD",
          code: "SATORI",
          start,
          end,
        },
        timeout: 20_000,
      })
      .json<LiveCoinWatchResult>()
  );
}
