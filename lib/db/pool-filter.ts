import { inArray, type AnyColumn, type SQL } from "drizzle-orm";
import { poolAddressForms } from "@/lib/pool-utils";

/**
 * Filter a column on every address a pool may be stored under (Evrmore and
 * Base, wallet and vault).
 *
 * `IN (exact spellings, lowercase EVM forms)` rather than `lower(col) = ...`:
 * the latter would bypass btree indexes on these columns. Covers the
 * checksum/lowercase mix; a third casing (e.g. all-uppercase hex) would not match.
 */
export function poolAddressIn(
  column: AnyColumn,
  address: string,
  vaultAddress?: string | null
): SQL {
  return inArray(column, poolAddressForms(address, vaultAddress));
}
