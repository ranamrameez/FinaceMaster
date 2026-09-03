import { describe, expect, it } from 'vitest';
import type { CashEntry } from '../../../types/cashWorkbook';
import type { Category } from '../../../types/finance';
import { cashBalanceByCurrency, cashByCategory, cashMonthlyFlow, cashRunningLedger } from '../cashModule';

const TEST_CATEGORIES: Category[] = [
  { id: 'cat_food', serialNumber: 1, name: 'Food' },
  { id: 'cat_gift', serialNumber: 2, name: 'Gift' },
  { id: 'cat_uncategorized', serialNumber: 3, name: 'Uncategorized' },
];

let nextId = 0;
const entry = (over: Partial<CashEntry>): CashEntry => ({
  id: `entry-${nextId++}`,
  date: '2026-01-01',
  isDeposit: true,
  amount: 100,
  currencyCode: 'USD',
  source: 'manual',
  ...over,
});

describe('cashRunningLedger', () => {
  it('tracks a running balance per currency independently', () => {
    const entries = [
      entry({ date: '2026-01-01', isDeposit: true, amount: 500, currencyCode: 'USD' }),
      entry({ date: '2026-01-02', isDeposit: false, amount: 100, currencyCode: 'USD' }),
      entry({ date: '2026-01-01', isDeposit: true, amount: 1000, currencyCode: 'PKR' }),
    ];
    const rows = cashRunningLedger(entries);
    const usdRows = rows.filter((r) => r.entry.currencyCode === 'USD');
    const pkrRows = rows.filter((r) => r.entry.currencyCode === 'PKR');
    expect(usdRows.map((r) => r.balance)).toEqual([500, 400]);
    expect(pkrRows.map((r) => r.balance)).toEqual([1000]);
  });

  it('sorts chronologically regardless of input order', () => {
    const entries = [
      entry({ date: '2026-03-01', isDeposit: true, amount: 10 }),
      entry({ date: '2026-01-01', isDeposit: true, amount: 20 }),
      entry({ date: '2026-02-01', isDeposit: true, amount: 5 }),
    ];
    const rows = cashRunningLedger(entries);
    expect(rows.map((r) => r.entry.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(rows.map((r) => r.balance)).toEqual([20, 25, 35]);
  });

  it('breaks a same-instant tie by serialNumber, not array position', () => {
    // Two untimed same-day entries default to the identical noon-UTC
    // instant — deliberately placed in the array in the OPPOSITE order
    // their serialNumber implies, a real reorder (edit/delete-and-re-add/
    // import) that array-position-based tie-breaking would get wrong.
    const first = entry({ date: '2026-01-01', isDeposit: true, amount: 5, serialNumber: 1 });
    const second = entry({ date: '2026-01-01', isDeposit: true, amount: 10, serialNumber: 2 });
    const rows = cashRunningLedger([second, first]);
    expect(rows.map((r) => r.entry.amount)).toEqual([5, 10]);
    expect(rows.map((r) => r.balance)).toEqual([5, 15]);
  });
});

describe('cashBalanceByCurrency', () => {
  it('nets IN/OUT per currency without mixing currencies', () => {
    const entries = [
      entry({ isDeposit: true, amount: 500, currencyCode: 'USD' }),
      entry({ isDeposit: false, amount: 200, currencyCode: 'USD' }),
      entry({ isDeposit: true, amount: 1000, currencyCode: 'SAR' }),
    ];
    expect(cashBalanceByCurrency(entries)).toEqual({ USD: 300, SAR: 1000 });
  });
});

describe('cashByCategory', () => {
  it('groups by currency first, then nets by category within each', () => {
    const entries = [
      entry({ isDeposit: false, amount: 50, currencyCode: 'USD', categoryID: 'cat_food' }),
      entry({ isDeposit: false, amount: 30, currencyCode: 'USD', categoryID: 'cat_food' }),
      entry({ isDeposit: true, amount: 200, currencyCode: 'USD', categoryID: 'cat_gift' }),
      entry({ isDeposit: false, amount: 100, currencyCode: 'PKR', categoryID: 'cat_food' }),
    ];
    const byCategory = cashByCategory(entries, TEST_CATEGORIES);
    expect(byCategory.USD.Food).toBe(-80);
    expect(byCategory.USD.Gift).toBe(200);
    expect(byCategory.PKR.Food).toBe(-100);
  });

  it('falls back to "Uncategorized" when no category is set', () => {
    const entries = [entry({ categoryID: undefined })];
    expect(cashByCategory(entries, TEST_CATEGORIES).USD.Uncategorized).toBe(100);
  });
});

describe('cashMonthlyFlow', () => {
  it('sums income and expense per calendar month for one currency', () => {
    const entries = [
      entry({ date: '2026-01-05', isDeposit: true, amount: 500, currencyCode: 'USD' }),
      entry({ date: '2026-01-20', isDeposit: false, amount: 200, currencyCode: 'USD' }),
      entry({ date: '2026-02-10', isDeposit: true, amount: 100, currencyCode: 'USD' }),
    ];
    const flow = cashMonthlyFlow(entries, 'USD');
    expect(flow).toEqual([
      { month: '2026-01', income: 500, expense: 200, net: 300 },
      { month: '2026-02', income: 100, expense: 0, net: 100 },
    ]);
  });

  it('ignores entries in other currencies', () => {
    const entries = [
      entry({ date: '2026-01-05', isDeposit: true, amount: 500, currencyCode: 'USD' }),
      entry({ date: '2026-01-05', isDeposit: true, amount: 9999, currencyCode: 'PKR' }),
    ];
    expect(cashMonthlyFlow(entries, 'USD')).toEqual([{ month: '2026-01', income: 500, expense: 0, net: 500 }]);
  });

  it('returns months sorted chronologically regardless of input order', () => {
    const entries = [
      entry({ date: '2026-03-01', isDeposit: true, amount: 10 }),
      entry({ date: '2026-01-01', isDeposit: true, amount: 20 }),
    ];
    expect(cashMonthlyFlow(entries, 'USD').map((f) => f.month)).toEqual(['2026-01', '2026-03']);
  });
});
