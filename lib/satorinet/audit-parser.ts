/** Audit staker commission values are percentage points, not fractions. */
export function parseAuditCommission(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const commission = Number(value);
  return Number.isFinite(commission) ? commission : null;
}

export type AuditKind = "stakers" | "workers" | "predictors";

export function auditDateParam(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

export function parsedAuditCacheKey(kind: AuditKind, date: Date): string {
  const version = kind === "stakers" ? ":v2" : "";
  return `satorinet:audit:${kind}${version}:${auditDateParam(date)}`;
}
