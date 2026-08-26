import { describe, expect, it } from 'vitest';
import type { Subscription } from '../../../types/subscriptionsWorkbook';
import {
  alertTriggerMs,
  dueSubscriptionAlerts,
  generateRenewalOccurrences,
  monthlyEquivalent,
  nextBillingDate,
  spendByCategory,
  totalMonthlySpendByCurrency,
  upcomingRenewals,
} from '../subscriptionsModule';

const sub = (over: Partial<Subscription>): Subscription => ({
  id: 's1',
  name: 'Netflix',
  amount: 10,
  currencyCode: 'USD',
  billingCycle: 'monthly',
  startDate: '2026-01-01',
  active: true,
  ...over,
});

describe('nextBillingDate', () => {
  it('returns the start date itself when asOf lands exactly on it', () => {
    const s = sub({ startDate: '2026-01-01' });
    expect(nextBillingDate(s, new Date('2026-01-01'))).toBe('2026-01-01');
  });

  it('advances by a month for a monthly subscription', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'monthly' });
    expect(nextBillingDate(s, new Date('2026-01-15'))).toBe('2026-02-01');
  });

  it('advances by a year for a yearly subscription', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'yearly' });
    expect(nextBillingDate(s, new Date('2026-06-01'))).toBe('2027-01-01');
  });

  it('advances by 7 days for a weekly subscription', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'weekly' });
    expect(nextBillingDate(s, new Date('2026-01-10'))).toBe('2026-01-15');
  });

  it('advances by customDays for a custom-cycle subscription', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'custom', customDays: 10 });
    expect(nextBillingDate(s, new Date('2026-01-25'))).toBe('2026-01-31');
  });
});

describe('monthlyEquivalent', () => {
  it('is the amount itself for monthly', () => {
    expect(monthlyEquivalent(sub({ amount: 10, billingCycle: 'monthly' }))).toBe(10);
  });

  it('divides by 12 for yearly', () => {
    expect(monthlyEquivalent(sub({ amount: 120, billingCycle: 'yearly' }))).toBeCloseTo(10, 5);
  });

  it('scales by 52/12 for weekly', () => {
    expect(monthlyEquivalent(sub({ amount: 2.307692, billingCycle: 'weekly' }))).toBeCloseTo(10, 1);
  });

  it('scales by 30/customDays for a custom cycle', () => {
    expect(monthlyEquivalent(sub({ amount: 5, billingCycle: 'custom', customDays: 15 }))).toBeCloseTo(10, 5);
  });
});

describe('totalMonthlySpendByCurrency', () => {
  it('sums active subscriptions by currency, excluding cancelled ones', () => {
    const subs = [
      sub({ id: 'a', amount: 10, billingCycle: 'monthly', currencyCode: 'USD' }),
      sub({ id: 'b', amount: 120, billingCycle: 'yearly', currencyCode: 'USD' }),
      sub({ id: 'c', amount: 999, billingCycle: 'monthly', currencyCode: 'USD', active: false }),
      sub({ id: 'd', amount: 500, billingCycle: 'monthly', currencyCode: 'PKR' }),
    ];
    const totals = totalMonthlySpendByCurrency(subs);
    expect(totals.USD).toBeCloseTo(20, 5);
    expect(totals.PKR).toBeCloseTo(500, 5);
  });
});

describe('upcomingRenewals', () => {
  it('includes only active subscriptions renewing within the window, sorted by date', () => {
    const asOf = new Date('2026-01-01');
    const subs = [
      sub({ id: 'soon', startDate: '2026-01-10', billingCycle: 'monthly' }),
      sub({ id: 'far', startDate: '2026-03-01', billingCycle: 'monthly' }),
      sub({ id: 'cancelled', startDate: '2026-01-05', billingCycle: 'monthly', active: false }),
    ];
    const result = upcomingRenewals(subs, 30, asOf);
    expect(result.map((r) => r.subscription.id)).toEqual(['soon']);
    expect(result[0].date).toBe('2026-01-10');
  });
});

describe('spendByCategory', () => {
  it('buckets by category, defaulting to Uncategorized, scoped to one currency', () => {
    const subs = [
      sub({ id: 'a', amount: 10, category: 'Streaming', currencyCode: 'USD' }),
      sub({ id: 'b', amount: 5, currencyCode: 'USD' }),
      sub({ id: 'c', amount: 999, category: 'Streaming', currencyCode: 'PKR' }),
    ];
    expect(spendByCategory(subs, 'USD')).toEqual({ Streaming: 10, Uncategorized: 5 });
  });
});

describe('generateRenewalOccurrences', () => {
  it('generates exactly 12 monthly occurrences over a 12-month horizon', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'monthly', amount: 10 });
    const occurrences = generateRenewalOccurrences(s, new Date('2026-01-01'));
    expect(occurrences).toHaveLength(12);
    expect(occurrences[0]).toEqual({ date: '2026-01-01', amount: 10 });
    expect(occurrences[11].date).toBe('2026-12-01');
  });

  it('generates exactly 1 yearly occurrence over a 12-month horizon', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'yearly', amount: 120 });
    const occurrences = generateRenewalOccurrences(s, new Date('2026-01-01'));
    expect(occurrences).toEqual([{ date: '2026-01-01', amount: 120 }]);
  });
});

describe('alertTriggerMs', () => {
  it('a daysBefore alert fires N days before the next occurrence', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'monthly' });
    const asOf = new Date('2026-01-05'); // next occurrence is 2026-02-01
    const ms = alertTriggerMs(s, { id: 'a1', daysBefore: 3 }, asOf);
    expect(new Date(ms!).toISOString().slice(0, 10)).toBe('2026-01-29');
  });

  it('a customAt alert fires at its own literal instant, independent of billing cycle', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'custom', customDays: 180 });
    const ms = alertTriggerMs(s, { id: 'a1', customAt: '2026-03-15T09:00' });
    expect(ms).toBe(new Date('2026-03-15T09:00').getTime());
  });

  it('returns null for a malformed alert (neither daysBefore nor a parseable customAt)', () => {
    const s = sub({});
    expect(alertTriggerMs(s, { id: 'a1' })).toBeNull();
    expect(alertTriggerMs(s, { id: 'a1', customAt: 'not a date' })).toBeNull();
  });
});

describe('dueSubscriptionAlerts', () => {
  it('includes an alert once its trigger instant has passed', () => {
    const s = sub({ id: 's1', startDate: '2026-01-01', billingCycle: 'monthly', alerts: [{ id: 'a1', daysBefore: 3 }] });
    // Next occurrence from 2026-01-30 is 2026-02-01 -> trigger is 2026-01-29, already passed.
    const due = dueSubscriptionAlerts([s], new Date('2026-01-30'));
    expect(due).toHaveLength(1);
    expect(due[0].subscription.id).toBe('s1');
  });

  it('excludes an alert whose trigger instant is still in the future', () => {
    const s = sub({ startDate: '2026-01-01', billingCycle: 'monthly', alerts: [{ id: 'a1', daysBefore: 3 }] });
    // Next occurrence from 2026-01-10 is 2026-02-01, so the trigger is 2026-01-29 — still ahead of asOf.
    const due = dueSubscriptionAlerts([s], new Date('2026-01-10'));
    expect(due).toHaveLength(0);
  });

  it('excludes alerts on an inactive (cancelled) subscription', () => {
    const s = sub({ active: false, startDate: '2026-01-01', billingCycle: 'monthly', alerts: [{ id: 'a1', daysBefore: 3 }] });
    expect(dueSubscriptionAlerts([s], new Date('2026-01-30'))).toHaveLength(0);
  });

  it('respects an injected dismissal check, keyed per-occurrence', () => {
    const s = sub({ id: 's1', startDate: '2026-01-01', billingCycle: 'monthly', alerts: [{ id: 'a1', daysBefore: 3 }] });
    const dismissedKey = `s1:a1:${nextBillingDate(s, new Date('2026-01-30'))}`;
    const due = dueSubscriptionAlerts([s], new Date('2026-01-30'), (key) => key === dismissedKey);
    expect(due).toHaveLength(0);
  });

  it('a dismissed occurrence still lets the NEXT cycle re-trigger with a fresh key', () => {
    const s = sub({ id: 's1', startDate: '2026-01-01', billingCycle: 'monthly', alerts: [{ id: 'a1', daysBefore: 3 }] });
    const staleKey = 's1:a1:2026-02-01'; // dismissed for an earlier cycle
    const due = dueSubscriptionAlerts([s], new Date('2026-02-28'), (key) => key === staleKey);
    expect(due).toHaveLength(1); // now anchored to the March occurrence, a different key
  });
});
