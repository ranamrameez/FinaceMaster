import type { BaseWorkbook } from '../store/createWorkbookStore';

export interface Fund {
  id: string;
  name: string;
  code: string; // fund's ticker/symbol equivalent
  platform: string; // "Fidelity", "Al Rajhi Capital", ...
  category: 'Equity' | 'Debt' | 'Hybrid' | 'International' | 'Other';
  /** Per-fund, not per-module. */
  currencyCode: string;
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
