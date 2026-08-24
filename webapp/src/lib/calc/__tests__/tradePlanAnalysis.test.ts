import { describe, expect, it } from 'vitest';
import type { FeeCalculator, TradePlanLeg } from '../../../types/workbook';
import { analyzeTradePlanByTicker } from '../tradePlanAnalysis';

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
  it('computes average cost and break-even from a plan\'s own buy legs, no fees', () => {
    const legs = [leg({ action: 'BUY', shares: 100, price: 10 })];
    const [summary] = analyzeTradePlanByTicker(legs, [], noFee, 0, 0.01);
    expect(summary.planBought).toBe(100);
    expect(summary.avgCost).toBeCloseTo(10, 5);
    expect(summary.breakEven).toBeCloseTo(10, 2);
    expect(summary.effectiveShares).toBe(100);
  });

  it('blends a real held position with the plan\'s own buys for average cost', () => {
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

  it('leaves avgCost/breakEven at 0 when there is neither a real holding nor a buy leg', () => {
    const legs = [leg({ action: 'SELL', shares: 10, price: 5 })];
    const [summary] = analyzeTradePlanByTicker(legs, [], noFee, 0, 0.01);
    expect(summary.avgCost).toBe(0);
    expect(summary.breakEven).toBe(0);
  });
});
