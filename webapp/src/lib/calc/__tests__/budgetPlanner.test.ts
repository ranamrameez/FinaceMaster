import { describe, expect, it } from 'vitest';
import { collectBudgetActivities, currentMonth, monthlyIncomeExpense, monthRange, threeMonthWindow } from '../budgetPlanner';

describe('collectBudgetActivities', () => {
  it('normalizes real Cash/Bank/Rentals entries onto one signed convention', () => {
    const activities = collectBudgetActivities({
      cashEntries: [{ id: 'c1', date: '2026-03-01', isDeposit: true, amount: 500, currencyCode: 'USD', source: 'manual' }],
      plannedCash: [],
      bankAccounts: [{ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 }],
      bankTransactions: [{ id: 'b1', accountId: 'a1', date: '2026-03-02', amount: -50, isDeposit: false, description: 'Groceries', source: 'manual' }],
      plannedBank: [],
      rentalProperties: [{ id: 'p1', name: 'Flat 1', currencyCode: 'USD' }],
      rentalEntries: [{ id: 'r1', propertyId: 'p1', date: '2026-03-03', isDeposit: true, amount: 800, source: 'manual' }],
      plannedRentals: [],
      categories: [],
    });
    expect(activities).toHaveLength(3);
    expect(activities.find((a) => a.id === 'c1')!.amount).toBe(500);
    expect(activities.find((a) => a.id === 'b1')!.amount).toBe(-50);
    expect(activities.find((a) => a.id === 'r1')!.amount).toBe(800);
    // sorted by date
    expect(activities.map((a) => a.id)).toEqual(['c1', 'b1', 'r1']);
  });

  it('includes a not-yet-executed planned entry but excludes an already-executed one (its real counterpart already covers it)', () => {
    const activities = collectBudgetActivities({
      cashEntries: [],
      plannedCash: [
        { id: 'p1', date: '2026-03-05', type: 'OUT', amount: 100, currencyCode: 'USD' },
        { id: 'p2', date: '2026-03-06', type: 'OUT', amount: 200, currencyCode: 'USD', executed: true },
      ],
      bankAccounts: [], bankTransactions: [], plannedBank: [],
      rentalProperties: [], rentalEntries: [], plannedRentals: [],
      categories: [],
    });
    expect(activities).toHaveLength(1);
    expect(activities[0].id).toBe('p1');
    expect(activities[0].executed).toBe(false);
  });

  it('excludes BOTH sides of a linked inter-account transfer — not income, not expense', () => {
    // Cash -> Bank: a real linked transfer creates a real CashEntry (money
    // out) AND a real BankTransaction (money in) — before the fix, the Bank
    // side counted as income even though nothing was actually earned.
    const activities = collectBudgetActivities({
      cashEntries: [{ id: 'c1', date: '2026-03-01', isDeposit: false, amount: 500, currencyCode: 'USD', source: 'manual' }],
      plannedCash: [],
      bankAccounts: [{ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 }],
      bankTransactions: [{ id: 'b1', accountId: 'a1', date: '2026-03-01', amount: 500, isDeposit: true, description: 'Transfer in', source: 'manual' }],
      plannedBank: [],
      rentalProperties: [], rentalEntries: [], plannedRentals: [],
      categories: [],
      links: [{
        id: 'link1', date: '2026-03-01', fromAmount: 500, toAmount: 500,
        from: { module: 'cash' }, to: { module: 'bank', ref: 'a1' },
        fromRecordId: 'c1', toRecordId: 'b1',
      }],
    });
    expect(activities).toEqual([]);
  });

  it('an UNLINKED transaction on the same day is unaffected by an unrelated link', () => {
    const activities = collectBudgetActivities({
      cashEntries: [{ id: 'c1', date: '2026-03-01', isDeposit: true, amount: 500, currencyCode: 'USD', source: 'manual' }],
      plannedCash: [],
      bankAccounts: [], bankTransactions: [], plannedBank: [],
      rentalProperties: [], rentalEntries: [], plannedRentals: [],
      categories: [],
      links: [{
        id: 'link1', date: '2026-03-01', fromAmount: 100, toAmount: 100,
        from: { module: 'cash' }, to: { module: 'bank', ref: 'a1' },
        fromRecordId: 'someone-else', toRecordId: 'b1',
      }],
    });
    expect(activities).toHaveLength(1);
    expect(activities[0].id).toBe('c1');
  });

  it('drops an entry whose account/property no longer exists rather than crashing', () => {
    const activities = collectBudgetActivities({
      cashEntries: [], plannedCash: [],
      bankAccounts: [],
      bankTransactions: [{ id: 'b1', accountId: 'missing', date: '2026-03-01', amount: 10, isDeposit: true, description: 'x', source: 'manual' }],
      plannedBank: [],
      rentalProperties: [], rentalEntries: [], plannedRentals: [],
      categories: [],
    });
    expect(activities).toEqual([]);
  });
});

describe('monthlyIncomeExpense', () => {
  it('buckets by month, split into income/expense per currency', () => {
    const activities = collectBudgetActivities({
      cashEntries: [
        { id: 'c1', date: '2026-03-01', isDeposit: true, amount: 500, currencyCode: 'USD', source: 'manual' },
        { id: 'c2', date: '2026-03-15', isDeposit: false, amount: 100, currencyCode: 'USD', source: 'manual' },
        { id: 'c3', date: '2026-04-01', isDeposit: true, amount: 1000, currencyCode: 'PKR', source: 'manual' },
      ],
      plannedCash: [], bankAccounts: [], bankTransactions: [], plannedBank: [],
      rentalProperties: [], rentalEntries: [], plannedRentals: [],
      categories: [],
    });
    const out = monthlyIncomeExpense(activities, ['2026-03', '2026-04']);
    expect(out[0]).toEqual({ month: '2026-03', income: { USD: 500 }, expense: { USD: 100 } });
    expect(out[1]).toEqual({ month: '2026-04', income: { PKR: 1000 }, expense: {} });
  });
});

describe('threeMonthWindow', () => {
  it('returns previous/current/next calendar months', () => {
    expect(threeMonthWindow(new Date(2026, 2, 15))).toEqual(['2026-02', '2026-03', '2026-04']);
  });

  it('correctly rolls across a year boundary', () => {
    expect(threeMonthWindow(new Date(2026, 0, 15))).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(threeMonthWindow(new Date(2026, 11, 15))).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('monthRange', () => {
  it('returns a 6-month window: 3 past + current + 2 future, the Budget Planner default', () => {
    expect(monthRange(-3, 2, new Date(2026, 5, 15))).toEqual([
      '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
  });

  it('rolls correctly across a year boundary at either end', () => {
    expect(monthRange(-2, 1, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('shifts by a windowOffset the same way scrolling the table would', () => {
    // offset -1 (scroll one month earlier) on top of the same -3..2 window
    expect(monthRange(-4, 1, new Date(2026, 5, 15))).toEqual([
      '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ]);
  });
});

describe('currentMonth', () => {
  it('returns the calendar month of the given date', () => {
    expect(currentMonth(new Date(2026, 2, 15))).toBe('2026-03');
    expect(currentMonth(new Date(2026, 11, 31))).toBe('2026-12');
  });
});
