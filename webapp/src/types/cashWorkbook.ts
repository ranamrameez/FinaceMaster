import type { Finance } from './finance';

/** Extends the shared `Finance` base (2026-09-03 restructure — see
 * `types/finance.ts`'s file-level comment) — `id`/`serialNumber`/`title`/
 * `amount`/`isDeposit`/`categoryID`/`note`/`timestamp`/`date`/`time`/
 * `timezone`/`isLinked` all now come from there; only what's genuinely
 * Cash-specific stays declared here. */
export interface CashEntry extends Finance {
  /** Per-entry, not per-module — see MODULES_PLAN.md's cross-cutting
   * currency decision. Aggregates group by this rather than converting. */
  currencyCode: string;
  /** @deprecated superseded by `Finance.categoryID`. Kept optional, never
   * written by new code — only read as a fallback by
   * `lib/financeMigration.ts` for a record that hasn't been migrated onto
   * `categoryID` yet (e.g. data pulled from Firebase before this field
   * existed), so display never breaks while the one-time migration catches
   * up. */
  category?: string;
  /** @deprecated superseded by `Finance.isDeposit`. Kept optional, never
   * written by new code — real pre-restructure data has this field and NO
   * `isDeposit` at all, so `cashWorkbookStore.ts`'s own migration reads
   * this as a fallback the same way `category` above does. Without this,
   * every existing "IN" entry would silently read as `isDeposit: undefined`
   * (falsy) and render/behave as an OUT — a real regression caught via live
   * testing against real data, not a hypothetical. */
  type?: 'IN' | 'OUT';
  /** 'statement-import' added 2026-08-23 (README item 25 / MODULES_PLAN.md
   * §13's CSV-import scope) — a CSV export doesn't map cleanly to "a
   * statement" for physical cash, but the same simple column-mapping
   * pattern from Banking's CSV import still applies to any spreadsheet
   * export of cash entries a user keeps elsewhere. See the "transaction
   * doesn't care about its source" cross-cutting decision. */
  source: 'manual' | 'statement-import';
  /** File name of the CSV a 'statement-import' entry came from — same
   * purpose as `BankTransaction.statementRef`. Unset for manual entries. */
  statementRef?: string;
}

export interface CashSettings {
  /** Pre-fills new entries only — never converts existing ones. */
  defaultCurrency: string;
}

export interface CashWorkbook {
  settings: CashSettings;
  entries: CashEntry[];
}
