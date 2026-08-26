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

export interface EMISettings {
  /** Pre-fills new entries only — never converts existing ones. */
  defaultCurrency: string;
}

export interface EMIWorkbook {
  settings: EMISettings;
  /** Named `entries` (not `loans`) so this module can reuse the generic
   * `createEntryStore` factory (single-array shape) instead of a fourth
   * hand-written store — see MODULES_PLAN.md §5. */
  entries: EMILoan[];
}
