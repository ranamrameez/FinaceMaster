import { describe, expect, it } from 'vitest';
import type { CashEntry } from '../../../types/cashWorkbook';
import { cashBalanceByCurrency, cashByCategory, cashMonthlyFlow, cashRunningLedger } from '../cashModule';

let nextId = 0;
const entry = (over: Partial<CashEntry>): CashEntry => ({
  id: `entry-${nextId++}`,
  date: '2026-01-01',
  type: 'IN',
  amount: 100,
  currencyCode: 'USD',
  source: 'manual',
  ...over,
});

describe('cashRunningLedger', () => {
  it('tracks a running balance per currency independently', () => {
    const entries = [
      entry({ date: '2026-01-01', type: 'IN', amount: 500, currencyCode: 'USD' }),
      entry({ date: '2026-01-02', type: 'OUT', amount: 100, currencyCode: 'USD' }),
      entry({ date: '2026-01-01', type: 'IN', amount: 1000, currencyCode: 'PKR' }),
    ];
    const rows = cashRunningLedger(entries);
    const usdRows = rows.filter((r) => r.entry.currencyCode === 'USD');
    const pkrRows = rows.filter((r) => r.entry.currencyCode === 'PKR');
    expect(usdRows.map((r) => r.balance)).toEqual([500, 400]);
    expect(pkrRows.map((r) => r.balance)).toEqual([1000]);
  });

  it('sorts chronologically regardless of input order', () => {
    const entries = [
      entry({ date: '2026-03-01', type: 'IN', amount: 10 }),
      entry({ date: '2026-01-01', type: 'IN', amount: 20 }),
      entry({ date: '2026-02-01', type: 'IN', amount: 5 }),
    ];
    const rows = cashRunningLedger(entries);
    expect(rows.map((r) => r.entry.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(rows.map((r) => r.balance)).toEqual([20, 25, 35]);
  });

  it('breaks a same-instant tie by seq, not array position', () => {
    // Two untimed same-day entries default to the identical noon-UTC
    // instant — deliberately placed in the array in the OPPOSITE order
    // their seq implies, a real reorder (edit/delete-and-re-add/import)
    // that array-position-based tie-breaking would get wrong.
    const first = entry({ date: '2026-01-01', type: 'IN', amount: 5, seq: 1 });
    const second = entry({ date: '2026-01-01', type: 'IN', amount: 10, seq: 2 });
    const rows = cashRunningLedger([second, first]);
    expect(rows.map((r) => r.entry.amount)).toEqual([5, 10]);
    expect(rows.map((r) => r.balance)).toEqual([5, 15]);
  });
});

describe('cashBalanceByCurrency', () => {
  it('nets IN/OUT per currency without mixing currencies', () => {
    const entries = [
      entry({ type: 'IN', amount: 500, currencyCode: 'USD' }),
      entry({ type: 'OUT', amount: 200, currencyCode: 'USD' }),
      entry({ type: 'IN', amount: 1000, currencyCode: 'SAR' }),
    ];
    expect(cashBalanceByCurrency(entries)).toEqual({ USD: 300, SAR: 1000 });
  });
});

describe('cashByCategory', () => {
  it('groups by currency first, then nets by category within each', () => {
    const entries = [
      entry({ type: 'OUT', amount: 50, currencyCode: 'USD', category: 'Food' }),
      entry({ type: 'OUT', amount: 30, currencyCode: 'USD', category: 'Food' }),
      entry({ type: 'IN', amount: 200, currencyCode: 'USD', category: 'Gift' }),
      entry({ type: 'OUT', amount: 100, currencyCode: 'PKR', category: 'Food' }),
    ];
    const byCategory = cashByCategory(entries);
    expect(byCategory.USD.Food).toBe(-80);
    expect(byCategory.USD.Gift).toBe(200);
    expect(byCategory.PKR.Food).toBe(-100);
  });

  it('falls back to "Uncategorized" when no category is set', () => {
    const entries = [entry({ category: undefined })];
    expect(cashByCategory(entries).USD.Uncategorized).toBe(100);
  });
});

describe('cashMonthlyFlow', () => {
  it('sums income and expense per calendar month for one currency', () => {
    const entries = [
      entry({ date: '2026-01-05', type: 'IN', amount: 500, currencyCode: 'USD' }),
      entry({ date: '2026-01-20', type: 'OUT', amount: 200, currencyCode: 'USD' }),
      entry({ date: '2026-02-10', type: 'IN', amount: 100, currencyCode: 'USD' }),
    ];
    const flow = cashMonthlyFlow(entries, 'USD');
    expect(flow).toEqual([
      { month: '2026-01', income: 500, expense: 200, net: 300 },
      { month: '2026-02', income: 100, expense: 0, net: 100 },
    ]);
  });

  it('ignores entries in other currencies', () => {
    const entries = [
      entry({ date: '2026-01-05', type: 'IN', amount: 500, currencyCode: 'USD' }),
      entry({ date: '2026-01-05', type: 'IN', amount: 9999, currencyCode: 'PKR' }),
    ];
    expect(cashMonthlyFlow(entries, 'USD')).toEqual([{ month: '2026-01', income: 500, expense: 0, net: 500 }]);
  });

  it('returns months sorted chronologically regardless of input order', () => {
    const entries = [
      entry({ date: '2026-03-01', type: 'IN', amount: 10 }),
      entry({ date: '2026-01-01', type: 'IN', amount: 20 }),
    ];
    expect(cashMonthlyFlow(entries, 'USD').map((f) => f.month)).toEqual(['2026-01', '2026-03']);
  });
});
