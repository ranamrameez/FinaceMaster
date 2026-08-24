import { describe, expect, it } from 'vitest';
import type { Fund } from '../../../types/fundsWorkbook';
import type { PricePoint, Transaction } from '../../../types/workbook';
import { allocationByCategory, contributionVsValueSeries, fundsValueByCurrency } from '../fundsModule';

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

describe('allocationByCategory', () => {
  it('sums current value by category, scoped to one currency', () => {
    const twoUsdFunds: Fund[] = [
      ...funds,
      { id: 'f3', name: 'US Bonds', code: 'USB', platform: 'Fidelity', category: 'Debt', currencyCode: 'USD' },
    ];
    const txs: Transaction[] = [...transactions, { date: '2026-01-01', ticker: 'f3', action: 'BUY', shares: 50, price: 20 }];
    const result = allocationByCategory(twoUsdFunds, txs, { f1: 12, f3: 20 }, 'USD');
    expect(result).toEqual({ Equity: 1200, Debt: 1000 }); // f1: 100*12; f3: 50*20
  });

  it('omits a fund with zero current value', () => {
    const sold: Transaction[] = [
      { date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 },
      { date: '2026-02-01', ticker: 'f1', action: 'SELL', shares: 100, price: 12 },
    ];
    const result = allocationByCategory(funds, sold, {}, 'USD');
    expect(result).toEqual({});
  });

  it('never blends currencies together', () => {
    const result = allocationByCategory(funds, transactions, { f1: 12 }, 'PKR');
    expect(Object.keys(result)).toEqual(['Debt']);
  });
});

describe('contributionVsValueSeries', () => {
  it('tracks cumulative invested and value using transaction prices when no NAV update exists', () => {
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 },
      { date: '2026-02-01', ticker: 'f1', action: 'BUY', shares: 50, price: 11 },
    ];
    const series = contributionVsValueSeries('f1', txs, {});
    expect(series).toEqual([
      { date: '2026-01-01', invested: 1000, value: 1000 }, // 100 units * NAV 10 (implicit from the buy)
      { date: '2026-02-01', invested: 1550, value: 1650 }, // 150 units * NAV 11 (implicit from the 2nd buy)
    ]);
  });

  it('prefers an explicit NAV update over a same-day transaction price, and carries the NAV forward', () => {
    const txs: Transaction[] = [{ date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 }];
    const priceHistory: Record<string, PricePoint[]> = { f1: [{ date: '2026-03-01', price: 15 }] };
    const series = contributionVsValueSeries('f1', txs, priceHistory);
    expect(series).toEqual([
      { date: '2026-01-01', invested: 1000, value: 1000 }, // no NAV known yet — falls back to the buy price
      { date: '2026-03-01', invested: 1000, value: 1500 }, // 100 units * the explicit NAV update
    ]);
  });

  it('reduces invested and units on a SELL, and returns empty for a fund with no history', () => {
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 },
      { date: '2026-02-01', ticker: 'f1', action: 'SELL', shares: 40, price: 12 },
    ];
    const series = contributionVsValueSeries('f1', txs, {});
    expect(series[1]).toEqual({ date: '2026-02-01', invested: 1000 - 480, value: 60 * 12 });
    expect(contributionVsValueSeries('nonexistent', txs, {})).toEqual([]);
  });
});
