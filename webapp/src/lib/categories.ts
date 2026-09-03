import type { Category } from '../types/finance';

/** Bundled starting category list — extracted from the app owner's own
 * real Cash/Bank/Rentals data (2026-09-03), the same "safe merges only"
 * pass described in `lib/categorySeed.ts`'s own history: only exact/
 * whitespace/hyphen-vs-space/case duplicates were folded together (one
 * real instance found: "CC-Payment" + "CC payment" → one row, renamed to
 * the fuller "Credit Card Payment" per explicit request rather than kept
 * as an abbreviation). Everything else — including close-looking pairs
 * like "Touring"/"Travel" or "Health"/"Medical" — stays separate; merging
 * those would be a judgment call on the user's own real spending history,
 * not a mechanical safe merge.
 *
 * This list is a personal-finance-tracker's own real categories, not a
 * "generic" starter set — reasonable for this single-owner app today, but
 * worth reconsidering if the app ever supports multiple independent users
 * (a fresh signup shouldn't necessarily start with someone else's real
 * category history). `serialNumber` is just this array's own fixed order,
 * 1-indexed. Ids are stable slugs (not random) so every environment/import
 * resolves to the exact same id for the exact same category. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_grocery', serialNumber: 1, name: 'Grocery' },
  { id: 'cat_inevitable', serialNumber: 2, name: 'Inevitable' },
  { id: 'cat_accomodation', serialNumber: 3, name: 'Accomodation' },
  { id: 'cat_travel', serialNumber: 4, name: 'Travel' },
  { id: 'cat_health', serialNumber: 5, name: 'Health' },
  { id: 'cat_credit_card_payment', serialNumber: 6, name: 'Credit Card Payment' },
  { id: 'cat_income', serialNumber: 7, name: 'Income' },
  { id: 'cat_extra', serialNumber: 8, name: 'Extra' },
  { id: 'cat_reserve', serialNumber: 9, name: 'Reserve' },
  { id: 'cat_misk', serialNumber: 10, name: 'Misk' },
  { id: 'cat_touring', serialNumber: 11, name: 'Touring' },
  { id: 'cat_saving', serialNumber: 12, name: 'Saving' },
  { id: 'cat_pakistan', serialNumber: 13, name: 'Pakistan' },
  { id: 'cat_medical', serialNumber: 14, name: 'Medical' },
  { id: 'cat_food', serialNumber: 15, name: 'Food' },
  { id: 'cat_transfer', serialNumber: 16, name: 'Transfer' },
  { id: 'cat_ignore', serialNumber: 17, name: 'Ignore' },
  { id: 'cat_ignore_count', serialNumber: 18, name: 'IgnoreCount' },
  { id: 'cat_bill', serialNumber: 19, name: 'Bill' },
  { id: 'cat_psx', serialNumber: 20, name: 'PSX' },
  { id: 'cat_others', serialNumber: 21, name: 'Others' },
  { id: 'cat_reconcile', serialNumber: 22, name: 'Reconcile' },
  { id: 'cat_reconciliation_adjustment', serialNumber: 23, name: 'Reconciliation adjustment' },
  { id: 'cat_rent', serialNumber: 24, name: 'Rent' },
  { id: 'cat_rent_car_wash', serialNumber: 25, name: 'Rent: Car Wash' },
  { id: 'cat_opening_balance', serialNumber: 26, name: 'Opening balance' },
  { id: 'cat_uncategorized', serialNumber: 27, name: 'Uncategorized' },
];

export const UNCATEGORIZED_ID = 'cat_uncategorized';
/** Used by `lib/interEntityLink.ts`'s `buildSideRecord` for the Cash/Bank
 * side of an inter-module link — a linked transfer's own real category. */
export const TRANSFER_CATEGORY_ID = 'cat_transfer';
/** Used by `RentalsPage.tsx`'s semi-automated rent-collection flow — the
 * category a logged rent-income entry gets, same as the pre-restructure
 * hardcoded `category: 'Rent'`. */
export const RENT_CATEGORY_ID = 'cat_rent';

/** Matches how two category strings are compared for a "safe" merge: trim,
 * lowercase, and collapse any run of hyphens/spaces to one space — enough
 * to recognize "CC-Payment" and "CC payment" as the same category without
 * conflating genuinely different names. */
export function normalizeCategoryKey(name: string): string {
  return name.trim().toLowerCase().replace(/[-\s]+/g, ' ').trim();
}

/** Finds an existing category whose name matches (after normalization) —
 * used both by the one-time legacy-data migration and by any later record
 * that still carries the old free-text `category` field. */
export function findCategoryByName(name: string, categories: Category[]): Category | undefined {
  const key = normalizeCategoryKey(name);
  if (!key) return undefined;
  return categories.find((c) => normalizeCategoryKey(c.name) === key);
}

/** Resolves a `categoryID` to its display name — the one place every
 * category-breakdown chart/table looks this up, so a renamed or deleted
 * category can't leave a stale name baked into old chart code. Falls back
 * to "Uncategorized" for an id that's missing or no longer exists (e.g. the
 * category registry hasn't loaded yet, or was deleted after being used). */
export function categoryName(categoryID: string | undefined, categories: Category[]): string {
  if (!categoryID) return 'Uncategorized';
  return categories.find((c) => c.id === categoryID)?.name ?? 'Uncategorized';
}
