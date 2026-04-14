function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number | null | undefined, fractionDigits: number) {
  if (!isFiniteNumber(value)) return "-";

  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  });
}

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export const formatCurrency = (
  value: number | null | undefined,
  fractionDigits: number = 2
) => formatNumber(value, fractionDigits);

export const formatSatori = (
  value: number | null | undefined,
  fractionDigits: number = 8
) => formatNumber(value, fractionDigits);

export const formatUsd = (value: number | null | undefined, decimals = 2) =>
  isFiniteNumber(value) ? `$${value.toFixed(decimals)}` : "-";

export function formatUtcDateTime(
  value: Date | string | number | null | undefined,
) {
  if (value == null) return "N/A";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return `${utcDateTimeFormatter.format(date)} UTC`;
}

export function formatCadence(seconds?: number) {
  if (!seconds || isNaN(seconds)) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}
