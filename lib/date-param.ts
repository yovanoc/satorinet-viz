/** Parses a `?date=YYYY-MM-DD` search param into a UTC-midnight Date (today by default). */
export function parseDateParam(param?: string): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [year, month, day] = param.split("-").map(Number);
    return new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0));
  }
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  );
}
