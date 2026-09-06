import { describe, expect, it } from 'vitest';
import { advanceRecurrence, nextRecurrenceOccurrence, recurrenceMonthlyEquivalent, recurrenceOccurrencesWithin } from '../recurrence';
import type { RecurrenceRule } from '../../../types/recurrence';

const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  cycle: 'monthly',
  startDate: '2026-01-28',
  ...over,
});

describe('advanceRecurrence', () => {
  it('advances a month/year/week/custom-days cycle correctly', () => {
    expect(advanceRecurrence(new Date('2026-01-28'), { cycle: 'monthly' }).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(advanceRecurrence(new Date('2026-01-28'), { cycle: 'yearly' }).toISOString().slice(0, 10)).toBe('2027-01-28');
    expect(advanceRecurrence(new Date('2026-01-28'), { cycle: 'weekly' }).toISOString().slice(0, 10)).toBe('2026-02-04');
    expect(advanceRecurrence(new Date('2026-01-01'), { cycle: 'custom', customDays: 10 }).toISOString().slice(0, 10)).toBe('2026-01-11');
  });

  it('clamps a day-of-month that does not exist in the target month (day 31 -> Feb)', () => {
    expect(advanceRecurrence(new Date('2026-01-31'), { cycle: 'monthly' }).toISOString().slice(0, 10)).toBe('2026-03-03');
  });
});

describe('nextRecurrenceOccurrence', () => {
  it('returns the start date itself when asOf lands exactly on it', () => {
    const r = rule({ startDate: '2026-01-28' });
    expect(nextRecurrenceOccurrence(r, new Date('2026-01-28'))?.toISOString().slice(0, 10)).toBe('2026-01-28');
  });

  it('advances forward to the first occurrence on or after asOf', () => {
    const r = rule({ startDate: '2026-01-28' });
    expect(nextRecurrenceOccurrence(r, new Date('2026-03-15'))?.toISOString().slice(0, 10)).toBe('2026-03-28');
  });

  it('returns null once the next occurrence would fall after endDate', () => {
    const r = rule({ startDate: '2026-01-28', endDate: '2026-02-28' });
    expect(nextRecurrenceOccurrence(r, new Date('2026-01-01'))?.toISOString().slice(0, 10)).toBe('2026-01-28');
    expect(nextRecurrenceOccurrence(r, new Date('2026-03-01'))).toBeNull();
  });
});

describe('recurrenceOccurrencesWithin', () => {
  it('lists every occurrence inside a window, inclusive', () => {
    const r = rule({ startDate: '2026-01-28' });
    expect(recurrenceOccurrencesWithin(r, '2026-01-01', '2026-04-01')).toEqual([
      '2026-01-28', '2026-02-28', '2026-03-28',
    ]);
  });

  it('stops at endDate even mid-window', () => {
    const r = rule({ startDate: '2026-01-28', endDate: '2026-02-28' });
    expect(recurrenceOccurrencesWithin(r, '2026-01-01', '2026-04-01')).toEqual(['2026-01-28', '2026-02-28']);
  });

  it('returns an empty array when the window is entirely before the start date', () => {
    const r = rule({ startDate: '2026-06-01' });
    expect(recurrenceOccurrencesWithin(r, '2026-01-01', '2026-03-01')).toEqual([]);
  });
});

describe('recurrenceMonthlyEquivalent', () => {
  it('normalizes yearly/weekly/custom/monthly to a comparable monthly figure', () => {
    expect(recurrenceMonthlyEquivalent({ cycle: 'monthly' }, 100)).toBe(100);
    expect(recurrenceMonthlyEquivalent({ cycle: 'yearly' }, 1200)).toBe(100);
    expect(recurrenceMonthlyEquivalent({ cycle: 'weekly' }, 100)).toBeCloseTo((100 * 52) / 12, 6);
    expect(recurrenceMonthlyEquivalent({ cycle: 'custom', customDays: 10 }, 100)).toBe(300);
  });
});
