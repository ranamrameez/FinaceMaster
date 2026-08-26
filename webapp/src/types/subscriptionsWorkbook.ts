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
/** User-requested (2026-08-26): renewal/expiry alerts. Exactly one of
 * `daysBefore`/`customAt` is set per alert — `daysBefore` is a relative
 * lead time re-evaluated against whatever the subscription's own NEXT
 * occurrence currently is (so it naturally rolls forward cycle to cycle,
 * no re-entry needed); `customAt` is a one-off absolute date+time (ISO,
 * `datetime-local`'s own format) for something that doesn't fit a regular
 * cycle at all — e.g. "remind me on this exact date my SIM expires,"
 * independent of `billingCycle`. Suggested lead times (3/2/1 days) are a
 * UI-level convenience for adding a `daysBefore` alert quickly — not a
 * separate stored concept. */
export interface SubscriptionAlert {
  id: string;
  daysBefore?: number;
  customAt?: string;
}

export interface Subscription {
  id: string;
  name: string; // "Netflix", "Gym membership"
  amount: number;
  currencyCode: string; // per-entity currency, same cross-cutting rule as every other module
  billingCycle: 'monthly' | 'yearly' | 'weekly' | 'custom';
  customDays?: number; // used when billingCycle === 'custom' — e.g. a 28-day mobile package or a 180-day SIM validity
  startDate: string;
  /** Which entity actually pays this — a Bank account (by id) or Cash.
   * Mirrors EMI/Loans' `linkedBankAccountId`/Rentals' lease-plan pattern:
   * once set, "Generate renewal plans" creates planned entries in that
   * entity's Planning tab for upcoming renewals. */
  paidVia?: { module: 'bank' | 'cash'; ref?: string };
  category?: string; // free-form, user-definable — same rule as every other module
  active: boolean; // toggled off instead of deleted when cancelled, keeps history
  cancelledDate?: string;
  alerts?: SubscriptionAlert[];
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
