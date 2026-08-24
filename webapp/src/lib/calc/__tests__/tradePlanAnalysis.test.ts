import { describe, expect, it } from 'vitest';
import type { FeeCalculator, TradePlanLeg } from '../../../types/workbook';
import { analyzeTradePlanByTicker, whatIfExit } from '../tradePlanAnalysis';

const leg = (over: Partial<TradePlanLeg>): TradePlanLeg => ({
  date: '2026-01-01',
  ticker: 'QGTS',
  action: 'BUY',
  shares: 0,
  price: 0,
  ...over,
});

const noFee: FeeCalculator = () => 0;
const flatFee: FeeCalculator = (amount) => amount * 0.01;

describe('analyzeTradePlanByTicker', () => {
  it('computes average cost and break-even from a plan\'s own pending buy legs, no fees', () => {
    const legs = [leg({ action: 'BUY', shares: 100, price: 10 })];
    const [summary] = analyzeTradePlanByTicker(legs, [], noFee, 0, 0.01);
    expect(summary.plannedBought).toBe(100);
    expect(summary.avgCost).toBeCloseTo(10, 5);
    expect(summary.breakEven).toBeCloseTo(10, 2);
    expect(summary.effectiveShares).toBe(100);
  });

  it('blends a real held position with the plan\'s own pending buys for average cost', () => {
    const legs = [leg({ action: 'BUY', shares: 100, price: 20 })];
    const real = [{ ticker: 'QGTS', shares: 100, invested: 1000 }]; // held at avg cost 10
    const [summary] = analyzeTradePlanByTicker(legs, real, noFee, 0, 0.01);
    // Blended: (1000 + 100*20) / (100+100) = 3000/200 = 15
    expect(summary.avgCost).toBeCloseTo(15, 5);
    expect(summary.effectiveShares).toBe(200);
  });

  it('computes planned realized P/L from a sell-only plan against a real holding, no fees', () => {
    const legs = [leg({ action: 'SELL', shares: 50, price: 15 })];
    const real = [{ ticker: 'QGTS', shares: 100, invested: 1000 }]; // avg cost 10
    const [summary] = analyzeTradePlanByTicker(legs, real, noFee, 0, 0.01);
    expect(summary.avgCost).toBeCloseTo(10, 5);
    // Proceeds 50*15=750, cost of sold shares 50*10=500, P/L = 250
    expect(summary.realizedPL).toBeCloseTo(250, 5);
    expect(summary.effectiveShares).toBe(50);
  });

  it('subtracts fees from both the buy cost basis and sell proceeds', () => {
    const legs = [leg({ action: 'BUY', shares: 100, price: 10 }), leg({ action: 'SELL', shares: 100, price: 15 })];
    const [summary] = analyzeTradePlanByTicker(legs, [], flatFee, 1, 0.01);
    // Buy cost basis: 100*10 + 1% fee(1000)=10 -> 1010, avgCost = 10.10
    expect(summary.avgCost).toBeCloseTo(10.1, 5);
    // Sell proceeds: 100*15 - 1% fee(1500)=15 -> 1485; cost of sold = 100*10.10=1010
    expect(summary.realizedPL).toBeCloseTo(1485 - 1010, 5);
  });

  it('returns one row per distinct ticker in the plan', () => {
    const legs = [leg({ ticker: 'QGTS', action: 'BUY', shares: 10, price: 1 }), leg({ ticker: 'MEZN', action: 'BUY', shares: 20, price: 2 })];
    const result = analyzeTradePlanByTicker(legs, [], noFee, 0, 0.01);
    expect(result.map((r) => r.ticker).sort()).toEqual(['MEZN', 'QGTS']);
  });

  it('leaves avgCost/breakEven at 0 when there is neither a real holding nor a pending buy leg', () => {
    const legs = [leg({ action: 'SELL', shares: 10, price: 5 })];
    const [summary] = analyzeTradePlanByTicker(legs, [], noFee, 0, 0.01);
    expect(summary.avgCost).toBe(0);
    expect(summary.breakEven).toBe(0);
  });

  it('excludes already-executed legs from the cost-basis math to avoid double-counting the real holding', () => {
    // This leg was already "Marked done" — it created a real Transaction,
    // so its 100 shares @ 10 are already reflected in `real`. Counting it
    // again here would double the average-cost calculation.
    const legs = [
      leg({ action: 'BUY', shares: 100, price: 10, executed: true }),
      leg({ action: 'BUY', shares: 50, price: 20, executed: false }),
    ];
    const real = [{ ticker: 'QGTS', shares: 100, invested: 1000 }]; // reflects the executed leg already
    const [summary] = analyzeTradePlanByTicker(legs, real, noFee, 0, 0.01);
    expect(summary.executedBought).toBe(100);
    expect(summary.plannedBought).toBe(50);
    // Blended: (1000 + 50*20) / (100+50) = 2000/150 = 13.33
    expect(summary.avgCost).toBeCloseTo(13.333, 2);
    expect(summary.effectiveShares).toBe(150);
  });

  it('reports executedSold separately and excludes it from plannedSold/realizedPL', () => {
    const legs = [leg({ action: 'SELL', shares: 30, price: 15, executed: true }), leg({ action: 'SELL', shares: 20, price: 18, executed: false })];
    const real = [{ ticker: 'QGTS', shares: 100, invested: 1000 }];
    const [summary] = analyzeTradePlanByTicker(legs, real, noFee, 0, 0.01);
    expect(summary.executedSold).toBe(30);
    expect(summary.plannedSold).toBe(20);
    // Only the pending sell (20 @ 18) counts toward realizedPL, against avgCost 10.
    expect(summary.realizedPL).toBeCloseTo(20 * 18 - 20 * 10, 5);
  });
});

describe('whatIfExit', () => {
  it('computes proceeds and P/L for a hypothetical exit price', () => {
    const result = whatIfExit(100, 10, 15, noFee);
    expect(result.proceeds).toBeCloseTo(1500, 5);
    expect(result.pl).toBeCloseTo(500, 5);
  });

  it('subtracts the sell fee from proceeds', () => {
    const result = whatIfExit(100, 10, 15, flatFee);
    expect(result.proceeds).toBeCloseTo(1500 - 15, 5); // 1% of 1500 = 15
    expect(result.pl).toBeCloseTo(1485 - 1000, 5);
  });

  it('returns zeroed results for non-positive shares or price', () => {
    expect(whatIfExit(0, 10, 15, noFee)).toEqual({ proceeds: 0, pl: 0 });
    expect(whatIfExit(100, 10, 0, noFee)).toEqual({ proceeds: 0, pl: 0 });
  });
});
