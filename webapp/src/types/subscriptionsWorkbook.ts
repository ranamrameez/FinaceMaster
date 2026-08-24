/** Subscriptions module (README item 24 / MODULES_PLAN.md §12) — recurring
 * payments (streaming, gym, software, memberships) tracked independently of
 * any other module's ledger, optionally linked to whichever Bank account or
 * Cash pays them via the Planning feature (same "generate a planned entry,
 * mark it done later" pattern already used by EMI/Loans' "Link to bank" and
 * Rentals' lease-based rent projection — see `lib/calc/subscriptionsModule.ts`
 * for the generation logic). A subscription is never deleted on cancellation
 * (`active: false` + `cancelledDate` instead) so its spend history stays
 * visible, matching the "editable in place, not add/delete-only" and
 * "free-form category" cross-cutting rules locked in MODULES_PLAN.md. */
export interface Subscription {
  id: string;
  name: string; // "Netflix", "Gym membership"
  amount: number;
  currencyCode: string; // per-entity currency, same cross-cutting rule as every other module
  billingCycle: 'monthly' | 'yearly' | 'weekly' | 'custom';
  customDays?: number; // used when billingCycle === 'custom'
  startDate: string;
  /** Which entity actually pays this — a Bank account (by id) or Cash.
   * Mirrors EMI/Loans' `linkedBankAccountId`/Rentals' lease-plan pattern:
   * once set, "Generate renewal plans" creates planned entries in that
   * entity's Planning tab for upcoming renewals. */
  paidVia?: { module: 'bank' | 'cash'; ref?: string };
  category?: string; // free-form, user-definable — same rule as every other module
  active: boolean; // toggled off instead of deleted when cancelled, keeps history
  cancelledDate?: string;
}

export interface SubscriptionsSettings {
  /** Pre-fills new entries only — never converts existing ones. */
  defaultCurrency: string;
}

export interface SubscriptionsWorkbook {
  settings: SubscriptionsSettings;
  /** Named `entries` (not `subscriptions`) so this module can reuse the
   * generic `createEntryStore` factory (single-array shape), same reason
   * as EMI/Loans — see MODULES_PLAN.md §12. */
  entries: Subscription[];
}
