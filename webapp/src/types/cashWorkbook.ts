export interface CashEntry {
  /** Stable id, not the entry's array position — needed so cross-entity
   * transfer links (README item 19) can reference a specific entry that
   * survives other entries being added/edited/deleted around it. */
  id: string;
  date: string;
  /** Optional time-of-day ("HH:MM"), defaults to noon when absent — see
   * `lib/datetime.ts`. Lets same-day entries sort by real chronology. */
  time?: string;
  /** IANA timezone the `date`+`time` are in; defaults to UTC when absent. */
  timezone?: string;
  type: 'IN' | 'OUT';
  amount: number;
  /** Per-entry, not per-module — see MODULES_PLAN.md's cross-cutting
   * currency decision. Aggregates group by this rather than converting. */
  currencyCode: string;
  /** Free-form, user-definable — never a fixed enum (locked decision,
   * MODULES_PLAN.md). The UI offers autocomplete over previously-used
   * categories for convenience, not a hardcoded list. */
  category?: string;
  note?: string;
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
