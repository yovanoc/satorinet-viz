"use server";

import ky from "ky";
import { env } from "./env";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Bottleneck from "bottleneck";
import { redis } from "./redis";

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
async function getSatoriPriceForDateLocal(date: Date): Promise<number> {
  "use cache";
  cacheLife("max");

  const delay = 450 * 1000; // 450 seconds in milliseconds
  const end = date.getTime() + delay;
  const start = date.getTime() - delay;

  const res = await getSatoriPriceLivecoinwatch(start, end);

  // Take the closest price to the time
  const closest = res.history.reduce((prev, curr) =>
    Math.abs(date.getTime() - curr.date) < Math.abs(date.getTime() - prev.date)
      ? curr
      : prev
  );

  const diff = Math.abs(closest.date - date.getTime());

  if (diff > delay) {
    console.error(
      `No price found for date: ${date} - ${JSON.stringify(
        closest
      )} - diff ${diff} ms`
    );
    throw new Error("No price found");
  }

  return closest.rate;
}

const limiter = new Bottleneck({
  reservoir: 40, // initial value
  reservoirIncreaseAmount: 2,
  reservoirIncreaseInterval: 1000, // must be divisible by 250
  reservoirIncreaseMaximum: 40,

  // also use maxConcurrent and/or minTime for safety
  maxConcurrent: 5,
  minTime: 250, // pick a value that makes sense for your use case
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
