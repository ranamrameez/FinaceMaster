/** Rentals' "what if" / projected-income planner — same pattern as
 * `types/plannedCash.ts`/`types/plannedBank.ts` (a plan stays around after
 * being marked done, flagged `executed`, independent of the real
 * `RentalEntry` it created). Own store/localStorage key/Firebase path, no
 * migration risk to real Rentals data. See README item 38 / MODULES_PLAN.md
 * for the "auto-plan from lease info" feature this backs. */
export interface PlannedRentalEntry {
  id: string;
  propertyId: string;
  date: string;
  type: 'RENT_INCOME' | 'EXPENSE';
  amount: number;
  category?: string;
  note?: string;
  /** True once "Mark as done" created a real `RentalEntry` from this plan. */
  executed?: boolean;
  /** Set when this plan was auto-generated from a property's lease info
   * (`lib/calc/rentalPlanning.ts`) rather than typed in by hand — lets
   * regenerating find and replace a property's own still-pending
   * generated plans instead of piling up duplicates, same pattern as
   * EMI/Loans' `PlannedBankTransaction.sourceEmiLoanId`. */
  sourceLeasePropertyId?: string;
}

/** No Real-vs-Planned balance projection UI in v1 (unlike Cash/Bank's
 * Planning tab) — Rentals' "net income" isn't a single running balance the
 * same way, so this is just a plan list for now. Kept as its own settings
 * object (not `Record<string, never>`) so a future toggle can be added
 * without a shape migration. */
export type PlannedRentalSettings = Record<string, never>;

export interface PlannedRentalsWorkbook {
  settings: PlannedRentalSettings;
  entries: PlannedRentalEntry[];
}
