import type { BaseWorkbook } from '../store/createWorkbookStore';

export interface Fund {
  id: string;
  name: string;
  code: string; // fund's ticker/symbol equivalent
  platform: string; // "Fidelity", "Al Rajhi Capital", ...
  /** @deprecated (2026-09-08) — Funds' one deliberate deviation from this
   * project's own "category fields must be free-form" rule (MODULES_PLAN.md),
   * since Analytics' "Allocation by category" chart needed *some* grouping
   * before the shared category registry existed. Superseded by `categoryID`
   * below (README Done item 248, mirroring the identical Subscriptions
   * retrofit — Done item 245) — kept, still populated on old records, and
   * read as a display fallback when `categoryID` is unset, so a fund saved
   * before this change keeps showing its real asset-class label instead of
   * silently becoming "Uncategorized". Never written to by new code. */
  category?: 'Equity' | 'Debt' | 'Hybrid' | 'International' | 'Other';
  /** Points into the app-wide shared category registry (`lib/categories.ts`)
   * — the same one Cash/Bank/Rentals/Subscriptions use, per the user's own
   * "single shared category list used everywhere + per-user customization"
   * request. Undefined until the user picks/renames a category via
   * `CategorySelect`; display code falls back to the legacy `category`
   * enum string above, then to "Uncategorized" — see `fundCategoryLabel()`
   * in `features/funds/pages/FundsPage.tsx`. */
  categoryID?: string;
  /** Per-fund, not per-module. */
  currencyCode: string;
  /** User-requested (2026-09-03): "Funds can also be closed!" — same
   * archive/restore pattern as `BankAccount.isActive` (see that field's
   * own doc comment for the full reasoning). Optional, absent = active,
   * zero-migration for real existing funds. Visibility only: hidden from
   * the default fund list and from "add a NEW transaction into" pickers,
   * never from a total (positions/Net Worth keep counting a closed fund's
   * value unchanged — a closed fund isn't a claim that its money vanished,
   * just that it's no longer being actively contributed to). */
  isActive?: boolean;
  /** User-requested (2026-09-06): "let the user choose (checkboxes?) to
   * include the accounts in the Net calcs" — independent of `isActive`
   * above, whose own comment explicitly keeps counting a closed fund's
   * value toward totals. Optional, defaults to included (true) when
   * absent. Checked from the Dashboard's "Include in Net Worth" panel
   * (`NetWorthPage.tsx`), not this fund's own edit form. */
  includeInNetWorth?: boolean;
  /** Pending item 115(c): "favorite an entity, to view it on top." Purely
   * a display/sort preference — see `BankAccount.isFavorite`'s own comment
   * for why this is a separate field from `isActive`/`includeInNetWorth`. */
  isFavorite?: boolean;
}

export interface FundsSettings {
  /** Pre-fills new funds only — never converts existing ones. */
  defaultCurrency: string;
}

/** Structurally closest of the new modules to QSE/PSX (buy/sell units at a
 * NAV is the same shape as buy/sell shares at a price), so this one
 * genuinely reuses the full `createWorkbookStore` factory — `Transaction`
 * records use each fund's `id` as the `ticker` field, `shares` = units
 * held, `price` = NAV per unit, letting `computePositions`/`cashSummary`/
 * `computeRealizedPLTimeSeries` and `marketPrices`/`priceHistory` (NAV
 * updates) all work completely unmodified. See MODULES_PLAN.md §3.
 * `transfers`/`watchlist`/`dividends`/`tradePlans` from `BaseWorkbook` are
 * inherited but intentionally unused (no UI exposes them) — an accepted,
 * documented tradeoff for genuine factory reuse over a parallel type. */
export interface FundsWorkbook extends BaseWorkbook<FundsSettings> {
  funds: Fund[];
}
