import { describe, expect, it } from 'vitest';
import type { CashEntry } from '../../../types/cashWorkbook';
import { cashBalanceByCurrency, cashByCategory, cashRunningLedger } from '../cashModule';

const entry = (over: Partial<CashEntry>): CashEntry => ({
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
