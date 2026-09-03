import { DEFAULT_CATEGORIES, UNCATEGORIZED_ID, findCategoryByName } from './categories';

/** Resolves a Finance-based record's `categoryID`: an already-set value
 * wins outright; otherwise this falls back to matching its legacy
 * free-text `category` field (from before this migration, kept around
 * marked `@deprecated` on each type) against the bundled default category
 * list, landing on "Uncategorized" if nothing matches (a genuinely new,
 * not-yet-seen category string, or no category at all).
 *
 * Used by each Finance-based store's own `normalize()` so real historical
 * data resolves to a real `categoryID` the moment it's loaded, without a
 * cross-store dependency (this only needs the bundled list, not the live
 * `categoryStore`) — the deprecated `category` string itself is never
 * deleted, so nothing is lost even in the Uncategorized fallback case; the
 * user can always re-categorize it later via the edit UI. New categories a
 * user creates going forward are added straight to the live
 * `useCategoryStore` by the UI, never through this fallback path. */
export function resolveLegacyCategoryId(legacyCategory: string | undefined): string {
  if (!legacyCategory || !legacyCategory.trim()) return UNCATEGORIZED_ID;
  const match = findCategoryByName(legacyCategory, DEFAULT_CATEGORIES);
  return match ? match.id : UNCATEGORIZED_ID;
}

/** Resolves `Finance.isDeposit` for a record that might still carry the old
 * `type` enum instead (real pre-restructure Cash/Rentals data does, and has
 * NO `isDeposit` key at all — `isDeposit` is a required field on the type,
 * but JSON parsing doesn't enforce that, so a real stored record can be
 * missing it entirely). Caught via live testing against real seeded data,
 * not assumed: without this, an existing `isDeposit: undefined` record is
 * falsy everywhere it's read, so every old "IN"/"RENT_INCOME" entry would
 * silently render and behave as an OUT/EXPENSE — a real, serious
 * regression on real financial data, exactly the class of bug this
 * project's own cloud-sync-safety rules exist to prevent. `depositType` is
 * whichever of the record's own two enum values means "money in". */
export function resolveIsDeposit(
  isDeposit: boolean | undefined,
  legacyType: string | undefined,
  depositType: string,
): boolean {
  if (isDeposit !== undefined) return isDeposit;
  if (legacyType !== undefined) return legacyType === depositType;
  return false;
}
