export function getTodayMidnightUTC() {
  const today = new Date();
  return normalizeToUTCMidnight(today);
}

/**
 * Generate a continuous date range going backwards from the end date
 * All dates are normalized to UTC midnight for consistency
 */
export function generateDateRangeBackwards(endDate: Date, days: number): Date[] {
  const dates: Date[] = [];

  // Normalize end date to UTC midnight
  const normalizedEndDate = new Date(endDate);
  normalizedEndDate.setUTCHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(normalizedEndDate);
    date.setUTCDate(date.getUTCDate() - i);
    dates.push(date);
  }
  return dates;
}

/**
 * Normalize a date to UTC midnight for consistent comparisons
 */
export function normalizeToUTCMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Compare two dates by their UTC date component only (ignoring time)
 */
export function isSameUTCDate(date1: Date, date2: Date): boolean {
  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
}
