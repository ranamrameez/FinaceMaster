export interface EMILoan {
  id: string;
  name: string; // "Home Mortgage", "Car Financing"
  lender: string;
  currencyCode: string;
  principal: number;
  tenureMonths: number;
  startDate: string;
  repaymentMode: 'interest' | 'fixedTotal';
  annualRatePct?: number; // used when repaymentMode === 'interest'
  totalToReturn?: number; // used when repaymentMode === 'fixedTotal'
  /** Set once "Link to bank" (README item 37) generates a recurring
   * Planning-feature plan for this loan's remaining installments —
   * lets the UI show "Linked to X" and re-generate cleanly instead of
   * creating duplicate plans on a second click. */
  linkedBankAccountId?: string;
  /** Per-month installment overrides (README item 6 of a 2026-08-26
   * feedback batch): keyed by 1-indexed schedule month, value = the
   * actual amount paid that month instead of the regular computed
   * installment. Models real-world irregular loans (e.g. a bigger
   * payment every 6th month) — `emiSchedule()` recalculates every later
   * month's balance/interest from whatever was actually paid, and stops
   * early if an override pays the loan off before its full tenure. */
  installmentOverrides?: Record<number, number>;
}

/** A real, dated record of an actual payment made against a loan —
 * previously EMI had no such ledger, only the computed schedule
 * (`emiSchedule`) and the per-month `installmentOverrides` shortcut, which
 * has no id and can't be referenced by anything else (README Pending items
 * 21/62's long-standing "EMI has no repayment ledger to link into" gap).
 * Deliberately keyed by `month` (the 1-indexed schedule row it applies to,
 * same indexing as `installmentOverrides`) rather than free-floating by
 * date alone — `emiWorkbookStore.ts`'s `addRepayment`/`updateRepayment`/
 * `deleteRepayment` keep this array and the matching loan's
 * `installmentOverrides` in sync as one write, so `emiSchedule`'s
 * calculation logic stays the single source of truth for the actual
 * numbers and never has to be duplicated here — this type only adds an
 * addressable id/date/source on top, for display, editing, and cross-entity
 * linking (a Bank/Cash payment can now link to a specific loan's repayment,
 * the same way Personal Loans' `PersonalLoanRepayment` already works). No
 * time-of-day field, unlike Transaction/Transfer/etc. — at most one
 * repayment exists per loan per month, so there's no same-day-ordering
 * scenario a time would resolve. */
export interface EMIRepayment {
  id: string;
  loanId: string;
  month: number;
  amount: number;
  date: string;
  /** 'statement-import' mirrors every other module's ledger source field —
   * unset (implicitly manual) for now since EMI has no CSV import yet. */
  source?: 'manual' | 'statement-import';
  statementRef?: string;
}

export interface EMISettings {
  /** Pre-fills new entries only — never converts existing ones. */
  defaultCurrency: string;
}

export interface EMIWorkbook {
  settings: EMISettings;
  /** Named `entries` (not `loans`) — a holdover from when this module
   * reused the generic `createEntryStore` factory (single-array shape).
   * Adding `repayments` as a second array (below) needed a hand-written
   * store instead (same reasoning as Personal Loans' loans+repayments
   * shape — see `store/emiWorkbookStore.ts`), but the field itself was
   * kept named `entries` rather than renamed to `loans`, to avoid a
   * needless storage-shape migration for every existing user's real data. */
  entries: EMILoan[];
  repayments: EMIRepayment[];
}
