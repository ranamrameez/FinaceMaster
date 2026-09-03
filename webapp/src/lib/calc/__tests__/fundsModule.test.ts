import { describe, expect, it } from 'vitest';
import type { Fund } from '../../../types/fundsWorkbook';
import type { PricePoint, Transaction } from '../../../types/workbook';
import { allocationByCategory, contributionVsValueSeries, expectedPLRate, fundNetProfit, fundsValueByCurrency, organicPLByPeriod } from '../fundsModule';
import { averagePeriodPL, reconstructFundDailyHistory } from '../fundsDailyHistoryImport';
import { computePositions } from '../positions';

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

describe('organicPLByPeriod', () => {
  it('separates a deposit from organic growth within the same month', () => {
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 1000, price: 1 }, // 1000 invested
      { date: '2026-01-15', ticker: 'f1', action: 'BUY', shares: 500, price: 1 }, // +500 deposit, no growth yet
    ];
    // NAV rises to 1.1 by month end — 150 of organic growth on the 1500 units held.
    const priceHistory: Record<string, PricePoint[]> = { f1: [{ date: '2026-01-31', price: 1.1 }] };
    const monthly = organicPLByPeriod('f1', txs, priceHistory, 'month');
    expect(monthly).toHaveLength(1);
    expect(monthly[0].period).toBe('2026-01');
    expect(monthly[0].total).toBeCloseTo(150, 6);
  });

  it('averages only real periods, and empty history returns nothing to average', () => {
    expect(averagePeriodPL(organicPLByPeriod('nonexistent', [], {}, 'month'))).toBe(0);
  });

  it('cross-checks against the daily-history reconstruction: deriving monthly PL from stored transactions/priceHistory reproduces the same totals as deriving it directly from the source daily balance log', () => {
    // Same real ALDDF rows used in fundsDailyHistoryImport.test.ts (no cash-flow gaps).
    const rows = [
      { date: '2026-07-07', prvBlc: 300000.0, newBlc: 301154.69, profitLoss: 1154.69 },
      { date: '2026-07-08', prvBlc: 301154.69, newBlc: 301223.02, profitLoss: 68.33 },
      { date: '2026-07-09', prvBlc: 301223.02, newBlc: 301351.12, profitLoss: 128.1 },
      { date: '2026-07-13', prvBlc: 301351.12, newBlc: 301542.62, profitLoss: 191.5 },
      { date: '2026-07-14', prvBlc: 301542.62, newBlc: 301607.03, profitLoss: 64.41 },
      { date: '2026-07-27', prvBlc: 301607.03, newBlc: 301798.14, profitLoss: 191.11 },
      { date: '2026-07-31', prvBlc: 301798.14, newBlc: 302688.31, profitLoss: 890.17 },
      { date: '2026-08-14', prvBlc: 302688.31, newBlc: 303500.72, profitLoss: 812.41 },
      { date: '2026-08-25', prvBlc: 303500.72, newBlc: 304143.43, profitLoss: 642.71 },
    ];
    const reconstruction = reconstructFundDailyHistory(rows);
    const transactions: Transaction[] = reconstruction.transactions.map((t) => ({ ...t, ticker: 'aladdf' }));
    const priceHistory: Record<string, PricePoint[]> = {
      aladdf: reconstruction.navPoints.map((p) => ({ date: p.date, price: p.price })),
    };

    const derivedMonthly = organicPLByPeriod('aladdf', transactions, priceHistory, 'month');
    // The source log's own monthly totals (computed directly from the raw
    // Profit-Loss column, independent of any reconstruction).
    expect(derivedMonthly.length).toBe(reconstruction.monthlyPL.length);
    derivedMonthly.forEach((m, i) => {
      expect(m.period).toBe(reconstruction.monthlyPL[i].month);
      expect(m.total).toBeCloseTo(reconstruction.monthlyPL[i].total, 2);
    });
    expect(averagePeriodPL(derivedMonthly)).toBeCloseTo(averagePeriodPL(reconstruction.monthlyPL), 2);
  });
});

describe('expectedPLRate', () => {
  it('returns null with fewer than 2 data points', () => {
    const txs: Transaction[] = [{ date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 }];
    expect(expectedPLRate('f1', txs, {})).toBeNull();
  });

  it('hand-traced: 100 units bought at NAV 10 (day 1), NAV rises to 11 ten days later, no further cash flow', () => {
    const txs: Transaction[] = [{ date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 }];
    const priceHistory: Record<string, PricePoint[]> = { f1: [{ date: '2026-01-11', price: 11 }] };
    // Point 1 (day 1): value=1000, invested=1000 → organic = 1000-0-(1000-0) = 0.
    // Point 2 (day 11): value=1100, invested=1000 → organic = 1100-1000-(1000-1000) = 100.
    // Total organic = 100 over a real 10-day span. avgInvested = (1000+1000)/2 = 1000.
    const rate = expectedPLRate('f1', txs, priceHistory);
    expect(rate).not.toBeNull();
    expect(rate!.dailyAmount).toBeCloseTo(10, 6); // 100 / 10 days
    expect(rate!.dailyPct).toBeCloseTo(1, 6); // 10 / 1000 * 100
    expect(rate!.monthlyAmount).toBeCloseTo(304.4, 6); // 10 * 30.44
    expect(rate!.monthlyPct).toBeCloseTo(30.44, 6); // 304.4 / 1000 * 100
  });

  it('a fund with zero organic growth (NAV unchanged) returns zero rates, not null', () => {
    const txs: Transaction[] = [{ date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 }];
    const priceHistory: Record<string, PricePoint[]> = { f1: [{ date: '2026-01-11', price: 10 }] };
    const rate = expectedPLRate('f1', txs, priceHistory);
    expect(rate).toEqual({ dailyAmount: 0, dailyPct: 0, monthlyAmount: 0, monthlyPct: 0 });
  });
});

describe('fundNetProfit', () => {
  const calcFee = () => 0;

  it('is just the unrealized gain when nothing has ever been sold', () => {
    const txs: Transaction[] = [{ date: '2026-01-01', ticker: 'f1', action: 'BUY', shares: 100, price: 10 }];
    const position = computePositions(txs, calcFee).find((p) => p.ticker === 'f1');
    expect(fundNetProfit(position, 100 * 12)).toBeCloseTo(200, 6); // (1200 value - 1000 invested)
  });

  it('undefined position (fund never bought) nets to just the current value', () => {
    expect(fundNetProfit(undefined, 500)).toBeCloseTo(500, 6);
  });

  it('real user-reported bug: withdrawals must not drop their own realized profit from Net P/L (JCSLM, 2026-09-03)', () => {
    // Real transaction log for one fund: 2 buys, then 3 sells (withdrawals)
    // that only partially drain the position.
    const txs: Transaction[] = [
      { date: '2026-08-13', ticker: 'jcslm', action: 'BUY', shares: 50000.46, price: 1 },
      { date: '2026-08-23', ticker: 'jcslm', action: 'BUY', shares: 59873.90671252166, price: 1.0021059806249784 },
      { date: '2026-08-24', ticker: 'jcslm', action: 'SELL', shares: 9975.817001425237, price: 1.0024241622085999 },
      { date: '2026-08-29', ticker: 'jcslm', action: 'SELL', shares: 49838.45904186861, price: 1.0032412911883106 },
      { date: '2026-09-02', ticker: 'jcslm', action: 'SELL', shares: 39833.67178039146, price: 1.004175568361499 },
    ];
    const position = computePositions(txs, calcFee).find((p) => p.ticker === 'jcslm');
    const nav = 1.004175568361499;
    const currentValue = (position?.shares ?? 0) * nav;

    // The bug: `value - invested` alone (the old, wrong formula) only
    // reflects the ~31 PKR unrealized gain on the units still held —
    // it silently drops the ~238 PKR already realized across 3 withdrawals.
    const oldWrongFormula = currentValue - (position?.invested ?? 0);
    expect(oldWrongFormula).toBeCloseTo(30.97, 1);

    // The fix: realized + unrealized is the true Net P/L, ~269 PKR.
    expect(fundNetProfit(position, currentValue)).toBeCloseTo(268.66, 1);
  });
});
