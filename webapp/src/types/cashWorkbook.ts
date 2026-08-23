export interface CashEntry {
  /** Stable id, not the entry's array position — needed so cross-entity
   * transfer links (README item 19) can reference a specific entry that
   * survives other entries being added/edited/deleted around it. */
  id: string;
  date: string;
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
  /** Only 'manual' exists for v1 — there's no statement to parse for
   * physical cash — kept for shape-consistency with other modules'
   * transaction-like records (see the "transaction doesn't care about its
   * source" cross-cutting decision). */
  source: 'manual';
}

export interface CashSettings {
  /** Pre-fills new entries only — never converts existing ones. */
  defaultCurrency: string;
}

export interface CashWorkbook {
  settings: CashSettings;
  entries: CashEntry[];
}
