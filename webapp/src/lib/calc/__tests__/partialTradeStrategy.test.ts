import { describe, expect, it } from 'vitest';
import { computeLotAdvice, findMissedOpportunity, perShareCommission, scanPortfolioForOpportunities, sellableShareSummary } from '../partialTradeStrategy';
import { computeFIFOPositions } from '../fifoPositions';
import { makeQSEFeeCalculator } from '../fees';
import type { PricePoint, Transaction } from '../../../types/workbook';

// Grounded in the user's own real reported IQCD position: 50 sh @ 10.40,
// then 14 sh @ 9.962 (QSE, flat 0.275% fee, no minFee) — the price rose to
// 10.37 (close to, but not past, the blended break-even for all 64 shares)
// then fell again. Every sell that window came out of the expensive
// 50-share lot (oldest-first FIFO), so the cheap 14-share lot — which was
// already clearly profitable at 10.37 — was never touched. This is the
// exact scenario Partial Trade Strategy exists to surface.
const calcFee = makeQSEFeeCalculator({ feePct: 0.275, minFee: 0 });
const IQCD_TXS: Transaction[] = [
  { date: '2026-08-10', ticker: 'IQCD', action: 'BUY', shares: 50, price: 10.4 },
  { date: '2026-09-01', ticker: 'IQCD', action: 'BUY', shares: 14, price: 9.962 },
];

describe('computeLotAdvice — real IQCD scenario', () => {
  it('flags the cheap lot as sellable and the expensive lot as hold, at the real 10.37 peak', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS, calcFee);
    const lots = lotsByTicker.IQCD;
    expect(lots).toHaveLength(2);

    const advice = computeLotAdvice(lots, calcFee, 10.37, 0.275, 0.01);
    const [expensiveLot, cheapLot] = advice; // FIFO: oldest (50@10.40) first

    expect(expensiveLot.remainingShares).toBe(50);
    expect(expensiveLot.suggestion).toBe('hold');
    expect(expensiveLot.unrealizedPL).toBeLessThan(0);

    expect(cheapLot.remainingShares).toBe(14);
    expect(cheapLot.suggestion).toBe('sell');
    expect(cheapLot.unrealizedPL).toBeGreaterThan(0);
    // Hand-traced: ~4.93 profit on the cheap lot at 10.37.
    expect(cheapLot.unrealizedPL).toBeCloseTo(4.93, 1);
  });

  it('both lots read as hold when price is below both break-evens', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS, calcFee);
    const advice = computeLotAdvice(lotsByTicker.IQCD, calcFee, 9.5, 0.275, 0.01);
    expect(advice.every((a) => a.suggestion === 'hold')).toBe(true);
  });

  it('both lots read as sell once price clears the more expensive lot\'s own break-even too', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS, calcFee);
    const advice = computeLotAdvice(lotsByTicker.IQCD, calcFee, 11, 0.275, 0.01);
    expect(advice.every((a) => a.suggestion === 'sell')).toBe(true);
  });
});

describe('sellableShareSummary', () => {
  it('reports the cheap lot only as sellable at the real 10.37 peak', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS, calcFee);
    const advice = computeLotAdvice(lotsByTicker.IQCD, calcFee, 10.37, 0.275, 0.01);
    expect(sellableShareSummary(advice)).toEqual({ sellable: 14, total: 64 });
  });
});

describe('findMissedOpportunity', () => {
  const today = () => new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  it('reports the cheap lot as a missed opportunity at a recent peak', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS, calcFee);
    const priceHistory: PricePoint[] = [
      { date: daysAgo(5), price: 9.9 },
      { date: daysAgo(3), price: 10.37 },
      { date: today(), price: 9.98 },
    ];
    const result = findMissedOpportunity(priceHistory, lotsByTicker.IQCD, calcFee, 30);
    expect(result).not.toBeNull();
    expect(result!.peakPrice).toBe(10.37);
    expect(result!.lots).toHaveLength(1);
    expect(result!.lots[0].buyPrice).toBe(9.962);
  });

  it('returns null when nothing in the window would have profited', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS, calcFee);
    const priceHistory: PricePoint[] = [{ date: daysAgo(2), price: 8 }];
    expect(findMissedOpportunity(priceHistory, lotsByTicker.IQCD, calcFee, 30)).toBeNull();
  });

  it('returns null when there is no price history in the window', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS, calcFee);
    const priceHistory: PricePoint[] = [{ date: daysAgo(90), price: 20 }];
    expect(findMissedOpportunity(priceHistory, lotsByTicker.IQCD, calcFee, 30)).toBeNull();
  });

  it('returns null with no lots or no price history at all', () => {
    expect(findMissedOpportunity([], [], calcFee)).toBeNull();
  });
});

describe('scanPortfolioForOpportunities', () => {
  it('surfaces IQCD as an opportunity given the real market price of 10.37', () => {
    const results = scanPortfolioForOpportunities(IQCD_TXS, calcFee, { IQCD: 10.37 }, 0.275, 0.01);
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('IQCD');
    expect(results[0].sellableShares).toBe(14);
    expect(results[0].bestUnrealizedPL).toBeGreaterThan(0);
  });

  it('skips a ticker with no open lots', () => {
    const closed: Transaction[] = [
      { date: '2026-08-01', ticker: 'CLOSED', action: 'BUY', shares: 10, price: 5 },
      { date: '2026-08-05', ticker: 'CLOSED', action: 'SELL', shares: 10, price: 6 },
    ];
    expect(scanPortfolioForOpportunities(closed, calcFee, { CLOSED: 6 }, 0.275, 0.01)).toEqual([]);
  });

  it('skips a ticker with no known market price', () => {
    expect(scanPortfolioForOpportunities(IQCD_TXS, calcFee, {}, 0.275, 0.01)).toEqual([]);
  });
});

describe('perShareCommission', () => {
  it('computes buy and sell commission for exactly one share at the given price', () => {
    const { buy, sell } = perShareCommission(100, calcFee);
    // makeQSEFeeCalculator rounds to 2dp: 100 * 0.275% = 0.275 -> 0.28.
    expect(buy).toBe(0.28);
    expect(sell).toBe(0.28);
  });

  it('returns zero for a non-positive price', () => {
    expect(perShareCommission(0, calcFee)).toEqual({ buy: 0, sell: 0 });
    expect(perShareCommission(-5, calcFee)).toEqual({ buy: 0, sell: 0 });
  });
});
