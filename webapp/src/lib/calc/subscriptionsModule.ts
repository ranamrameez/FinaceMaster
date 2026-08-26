import type { Subscription, SubscriptionAlert } from '../../types/subscriptionsWorkbook';

const MAX_HORIZON_MONTHS = 12;

/** Advances one date by a subscription's own billing cycle — monthly/yearly
 * use real calendar arithmetic (`setMonth`/`setFullYear`, same clamping
 * behavior as EMI's `installmentDueDate`/Rentals' `cycleDate` for a day that
 * doesn't exist in the target month), weekly/custom use fixed day counts. */
function advance(date: Date, sub: Subscription): Date {
  const d = new Date(date);
  switch (sub.billingCycle) {
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      return d;
    case 'custom':
      d.setDate(d.getDate() + Math.max(1, sub.customDays || 30));
      return d;
    default:
      d.setMonth(d.getMonth() + 1);
      return d;
  }
}

/** Walks forward from `startDate` by whole cycles until reaching the first
 * occurrence on or after `asOf` — capped at 10,000 iterations so a
 * pathological cycle length (e.g. `customDays: 0`, guarded against above by
 * `Math.max(1, ...)` but kept here as defense-in-depth) can never hang. */
function nextOccurrence(sub: Subscription, asOf: Date): Date {
  let d = new Date(sub.startDate);
  const asOfStr = asOf.toISOString().slice(0, 10);
  let i = 0;
  while (d.toISOString().slice(0, 10) < asOfStr && i < 10000) {
    d = advance(d, sub);
    i++;
  }
  return d;
}

export function nextBillingDate(sub: Subscription, asOf: Date = new Date()): string {
  return nextOccurrence(sub, asOf).toISOString().slice(0, 10);
}

/** Normalizes any billing cycle to a per-month figure, for a fair
 * "total monthly recurring spend" comparison across subscriptions with
 * different cycles (a $120/year subscription and a $10/month one should
 * both read as $10/month here). */
export function monthlyEquivalent(sub: Subscription): number {
  switch (sub.billingCycle) {
    case 'yearly':
      return sub.amount / 12;
    case 'weekly':
      return (sub.amount * 52) / 12;
    case 'custom': {
      const days = Math.max(1, sub.customDays || 30);
      return (sub.amount * 30) / days;
    }
    default:
      return sub.amount;
  }
}

/** Portfolio-wide monthly recurring spend, grouped by currency — active
 * subscriptions only, never blended/converted across currencies (no live
 * FX-rate source, same rule as every other module). */
export function totalMonthlySpendByCurrency(subs: Subscription[]): Record<string, number> {
  const out: Record<string, number> = {};
  subs
    .filter((s) => s.active)
    .forEach((s) => {
      out[s.currencyCode] = (out[s.currencyCode] || 0) + monthlyEquivalent(s);
    });
  return out;
}

export interface UpcomingRenewal {
  subscription: Subscription;
  date: string;
}

/** Active subscriptions whose next billing date falls within `days` of
 * `asOf` (default 30) — feeds the Analytics tab's "Upcoming renewals" list. */
export function upcomingRenewals(subs: Subscription[], days = 30, asOf: Date = new Date()): UpcomingRenewal[] {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return subs
    .filter((s) => s.active)
    .map((s) => ({ subscription: s, date: nextBillingDate(s, asOf) }))
    .filter((r) => r.date <= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Monthly-equivalent spend by category, scoped to one currency — active
 * subscriptions only. An uncategorized subscription buckets into
 * "Uncategorized" rather than being dropped. */
export function spendByCategory(subs: Subscription[], currencyCode: string): Record<string, number> {
  const out: Record<string, number> = {};
  subs
    .filter((s) => s.active && s.currencyCode === currencyCode)
    .forEach((s) => {
      const cat = s.category?.trim() || 'Uncategorized';
      out[cat] = (out[cat] || 0) + monthlyEquivalent(s);
    });
  return out;
}

/** A `daysBefore` alert's trigger instant, re-evaluated against whatever
 * this subscription's NEXT occurrence currently is — so an alert added
 * once ("3 days before") automatically re-anchors to the following cycle
 * once the current one passes, no re-entry needed. Fires at local midnight
 * of that date (date-level precision — matches the rest of this module,
 * which has no time-of-day concept; only `customAt` alerts carry a real
 * time, since the user explicitly asked for date+time on those). Returns
 * `null` for a malformed alert (neither `daysBefore` nor a parseable
 * `customAt`). */
export function alertTriggerMs(sub: Subscription, alert: SubscriptionAlert, asOf: Date = new Date()): number | null {
  if (alert.customAt) {
    const t = new Date(alert.customAt).getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (alert.daysBefore != null && alert.daysBefore >= 0) {
    const next = new Date(nextBillingDate(sub, asOf));
    next.setDate(next.getDate() - alert.daysBefore);
    return next.getTime();
  }
  return null;
}

export interface DueAlert {
  subscription: Subscription;
  alert: SubscriptionAlert;
  /** Stable per-occurrence key: dismissing THIS key only silences the
   * alert for the current upcoming renewal/expiry — once that occurrence
   * passes and `nextBillingDate` rolls forward, a `daysBefore` alert
   * re-triggers with a fresh key for the new occurrence. A `customAt`
   * alert's key never changes (it has no cycle to roll forward to). */
  key: string;
  triggerMs: number;
}

/** Every active subscription's alert whose trigger instant has already
 * passed, and hasn't been dismissed for its current occurrence yet
 * (`isDismissed` is injected so this stays a pure function — the actual
 * dismissal state lives in a small localStorage-backed store, see
 * `store/subscriptionAlertDismissalStore.ts`). A cancelled subscription's
 * alerts never fire — nothing left to renew. */
export function dueSubscriptionAlerts(
  subs: Subscription[],
  asOf: Date = new Date(),
  isDismissed: (key: string) => boolean = () => false,
): DueAlert[] {
  const out: DueAlert[] = [];
  for (const sub of subs) {
    if (!sub.active) continue;
    for (const alert of sub.alerts ?? []) {
      const triggerMs = alertTriggerMs(sub, alert, asOf);
      if (triggerMs == null || triggerMs > asOf.getTime()) continue;
      const occurrenceTag = alert.customAt ? 'once' : nextBillingDate(sub, asOf);
      const key = `${sub.id}:${alert.id}:${occurrenceTag}`;
      if (isDismissed(key)) continue;
      out.push({ subscription: sub, alert, key, triggerMs });
    }
  }
  return out.sort((a, b) => a.triggerMs - b.triggerMs);
}

export interface RenewalOccurrence {
  date: string;
  amount: number;
}

/** Every renewal occurrence from the next one forward, capped at a 12-month
 * horizon (same "next 12 months means 12 cycle points, not 13" off-by-one
 * fix already applied in `rentalPlanning.ts`'s `generateLeaseRentPlans`) —
 * feeds both "Generate renewal plans" (turned into `PlannedBankTransaction`/
 * `PlannedCashEntry` rows by the page) and a read-only upcoming-occurrences
 * preview. Naturally yields ~12 rows for a monthly subscription, 1 for
 * yearly, ~52 for weekly — the horizon is time-based, not count-based, so
 * every cycle length gets a proportionate preview. */
export function generateRenewalOccurrences(sub: Subscription, asOf: Date = new Date()): RenewalOccurrence[] {
  const horizonEnd = new Date(asOf);
  horizonEnd.setMonth(horizonEnd.getMonth() + MAX_HORIZON_MONTHS);
  horizonEnd.setDate(horizonEnd.getDate() - 1);
  const horizonEndStr = horizonEnd.toISOString().slice(0, 10);

  const occurrences: RenewalOccurrence[] = [];
  let d = nextOccurrence(sub, asOf);
  let i = 0;
  while (d.toISOString().slice(0, 10) <= horizonEndStr && i < 1000) {
    occurrences.push({ date: d.toISOString().slice(0, 10), amount: sub.amount });
    d = advance(d, sub);
    i++;
  }
  return occurrences;
}
