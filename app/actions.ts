"use server";

import { getSatoriPriceLivecoinwatch } from "@/lib/livecoinwatch";

export async function getPriceRange(
  period: "hourly" | "daily" | "weekly" | "monthly" | "yearly",
) {
  const end = new Date();
  let start = new Date(end);

  if (period === "hourly") {
    // last 1 hour
    start = new Date(end);
    start.setHours(end.getHours() - 1);
  } else if (period === "daily") {
    // last 24 hours (1 day)
    start.setDate(end.getDate() - 1);
  } else if (period === "weekly") {
    // last 7 days
    start.setDate(end.getDate() - 7);
  } else if (period === "monthly") {
    // last 30 days
    start.setDate(end.getDate() - 30);
  } else if (period === "yearly") {
    // last 365 days
    start.setDate(end.getDate() - 365);
  }

  return getSatoriPriceLivecoinwatch(
    start.getTime(),
    end.getTime()
  );
}
