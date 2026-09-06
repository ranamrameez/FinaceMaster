import type { RecurrenceRule } from '../../types/recurrence';

const MAX_ITER = 10000;

/** Advances one date by a rule's own cycle — monthly/yearly use real
 * calendar arithmetic (`setMonth`/`setFullYear`, same day-clamping behavior
 * as EMI's `installmentDueDate`/Rentals' `cycleDate` for a day that doesn't
 * exist in the target month, e.g. day 31 landing on Feb 28), weekly/custom
 * use fixed day counts. Ported from `subscriptionsModule.ts`'s own
 * `advance()` — kept here as the one shared implementation. */
export function advanceRecurrence(date: Date, rule: Pick<RecurrenceRule, 'cycle' | 'customDays'>): Date {
  const d = new Date(date);
  switch (rule.cycle) {
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      return d;
    case 'custom':
      d.setDate(d.getDate() + Math.max(1, rule.customDays || 30));
      return d;
    default:
      d.setMonth(d.getMonth() + 1);
      return d;
  }
}

/** Walks forward from `startDate` by whole cycles until reaching the first
 * occurrence on or after `asOf` — capped at `MAX_ITER` so a pathological
 * cycle length can never hang. Returns `null` once that occurrence would
 * fall after the rule's own `endDate` (the rule has stopped recurring by
 * `asOf`). */
export function nextRecurrenceOccurrence(rule: RecurrenceRule, asOf: Date = new Date()): Date | null {
  let d = new Date(rule.startDate);
  const asOfStr = asOf.toISOString().slice(0, 10);
  let i = 0;
  while (d.toISOString().slice(0, 10) < asOfStr && i < MAX_ITER) {
    d = advanceRecurrence(d, rule);
    i++;
  }
  if (rule.endDate && d.toISOString().slice(0, 10) > rule.endDate) return null;
  return d;
}

/** Every occurrence date (inclusive) within `[fromDate, toDate]`, capped at
 * `MAX_ITER` occurrences as the same hang-guard as above. Used for the
 * Upcoming list's "next N days" window and for a subscription's own
 * multi-month renewal preview. */
export function recurrenceOccurrencesWithin(rule: RecurrenceRule, fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  let d = nextRecurrenceOccurrence(rule, new Date(fromDate));
  let i = 0;
  while (d && d.toISOString().slice(0, 10) <= toDate && i < MAX_ITER) {
    out.push(d.toISOString().slice(0, 10));
    const advanced = advanceRecurrence(d, rule);
    d = rule.endDate && advanced.toISOString().slice(0, 10) > rule.endDate ? null : advanced;
    i++;
  }
  return out;
}

/** Normalizes any cycle to a per-month figure — a $120/year rule and a
 * $10/month one should both read as $10/month for a fair "total monthly
 * recurring" comparison. */
export function recurrenceMonthlyEquivalent(rule: Pick<RecurrenceRule, 'cycle' | 'customDays'>, amount: number): number {
  switch (rule.cycle) {
    case 'yearly':
      return amount / 12;
    case 'weekly':
      return (amount * 52) / 12;
    case 'custom': {
      const days = Math.max(1, rule.customDays || 30);
      return (amount * 30) / days;
    }
    default:
      return amount;
  }
}
