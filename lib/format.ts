export const formatCurrency = (value: number, fractionDigits: number = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

export const formatSatori = (value: number, fractionDigits: number = 8) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

export const formatUsd = (value: number, decimals = 2) =>
  `$${value.toFixed(decimals)}`;

export function formatCadence(seconds?: number) {
  if (!seconds || isNaN(seconds)) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}
