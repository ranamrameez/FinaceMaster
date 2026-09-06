/** Shared recurrence-rule shape, generalized out of `Subscription`'s own
 * `billingCycle`/`customDays`/`startDate` trio (2026-09-07, user-requested:
 * "they fail to plan recurring income and expense... salary deposit on 28
 * each month, expected utility bills on specific days of a month"). One
 * rule describes an indefinitely-repeating (or `endDate`-bounded) series of
 * occurrences — never materialized as separate stored rows; every consumer
 * computes occurrences live via `lib/calc/recurrence.ts`.
 *
 * `Subscription` itself keeps its own three fields unchanged (zero
 * migration risk to real stored data) — `subscriptionsModule.ts` just
 * builds one of these inline from a subscription's fields before calling
 * the shared functions, so the cycle math lives in exactly one place. */
export type RecurrenceCycle = 'monthly' | 'yearly' | 'weekly' | 'custom';

export interface RecurrenceRule {
  cycle: RecurrenceCycle;
  /** Used when `cycle === 'custom'` — e.g. a 28-day pay cycle. */
  customDays?: number;
  /** The anchor date — its day-of-month/week is what every future
   * occurrence repeats on. Also the first possible occurrence. */
  startDate: string;
  /** Optional — a recurring plan doesn't have to run forever (e.g. "salary
   * from this new job, for now"). `undefined` means indefinite. */
  endDate?: string;
}
