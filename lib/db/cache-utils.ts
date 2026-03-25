import { cacheLife } from "next/cache";

/**
 * Applies the appropriate cache lifetime based on date recency.
 *
 * Data for recent dates (last 2 days) may not be fully written yet —
 * use a short TTL so stale empty results get revalidated quickly.
 * Older dates are immutable historical snapshots — cache forever.
 */
export function cacheLifeForDate(date: Date): void {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 2) {
    cacheLife("minutes");
  } else {
    cacheLife("max");
  }
}
