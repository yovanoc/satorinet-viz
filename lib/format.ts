export const formatCurrency = (value: number, fractionDigits: number = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

export const formatSatori = (value: number, fractionDigits: number = 8) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

export const formatUsd = (value: number, decimals = 2) =>
  `$${value.toFixed(decimals)}`;
