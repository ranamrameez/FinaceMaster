import { describe, expect, it } from 'vitest';
import type { Fund } from '../../../types/fundsWorkbook';
import type { Transaction } from '../../../types/workbook';
import { fundsValueByCurrency } from '../fundsModule';

const funds: Fund[] = [
  { id: 'f1', name: 'US Growth', code: 'USG', platform: 'Fidelity', category: 'Equity', currencyCode: 'USD' },
  { id: 'f2', name: 'PK Income', code: 'PKI', platform: 'MCB', category: 'Debt', currencyCode: 'PKR' },
];

const transactions: Transaction[] = [
  { date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 },
  { date: '2026-02-01', ticker: 'f2', action: 'BUY', shares: 1000, price: 5 },
];

describe('fundsValueByCurrency', () => {
  it('values each fund at its latest NAV, grouped by currency', () => {
    const result = fundsValueByCurrency(funds, transactions, { f1: 12 });
    expect(result.USD).toBeCloseTo(1200, 5); // 100 units * 12 NAV
    expect(result.PKR).toBeCloseTo(5000, 5); // falls back to last buy price (5) — no marketPrices entry
  });

  it('sums multiple funds sharing a currency', () => {
    const twoUsdFunds: Fund[] = [
      ...funds,
      { id: 'f3', name: 'US Bonds', code: 'USB', platform: 'Fidelity', category: 'Debt', currencyCode: 'USD' },
    ];
    const txs: Transaction[] = [...transactions, { date: '2026-01-01', ticker: 'f3', action: 'BUY', shares: 50, price: 20 }];
    const result = fundsValueByCurrency(twoUsdFunds, txs, { f1: 12, f3: 20 });
    expect(result.USD).toBeCloseTo(1200 + 1000, 5);
  });

  it('returns an empty object for no funds', () => {
    expect(fundsValueByCurrency([], [], {})).toEqual({});
  });
});
