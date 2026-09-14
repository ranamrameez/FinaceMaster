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

describe('computeLotAdvice buyId passthrough + end-to-end "Sell this lot"', () => {
  const IQCD_TXS_WITH_IDS: Transaction[] = [
    { id: 'buy-old', date: '2026-08-10', ticker: 'IQCD', action: 'BUY', shares: 50, price: 10.4 },
    { id: 'buy-cheap', date: '2026-09-01', ticker: 'IQCD', action: 'BUY', shares: 14, price: 9.962 },
  ];

  it('exposes each lot\'s originating buy id, so a "Sell this lot" click can target it', () => {
    const { lotsByTicker } = computeFIFOPositions(IQCD_TXS_WITH_IDS, calcFee);
    const advice = computeLotAdvice(lotsByTicker.IQCD, calcFee, 10.37, 0.275, 0.01);
    expect(advice.map((a) => a.buyId)).toEqual(['buy-old', 'buy-cheap']);
  });

  it('selling the cheap lot via its buyId leaves the expensive lot\'s own avg cost/break-even untouched — the real bug this exists to prevent', () => {
    const cheapLotAdvice = computeLotAdvice(computeFIFOPositions(IQCD_TXS_WITH_IDS, calcFee).lotsByTicker.IQCD, calcFee, 10.37, 0.275, 0.01)[1];
    const sellTx: Transaction = {
      date: '2026-09-15',
      ticker: 'IQCD',
      action: 'SELL',
      shares: cheapLotAdvice.remainingShares,
      price: 10.37,
      targetLotBuyId: cheapLotAdvice.buyId,
    };
    const { positions } = computeFIFOPositions([...IQCD_TXS_WITH_IDS, sellTx], calcFee);
    const p = positions.find((x) => x.ticker === 'IQCD')!;
    // 50 shares remain, entirely from the expensive lot — average cost for
    // what's left must be driven purely by the 50@10.40 lot's own
    // fee-inclusive cost per share, never a blended or misattributed figure
    // pulled in from the now fully-closed-out cheap lot.
    const oldLotFee = calcFee(50 * 10.4, true, { shares: 50 });
    expect(p.shares).toBe(50);
    expect(p.invested / p.shares).toBeCloseTo(10.4 + oldLotFee / 50, 5);
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

  it('end-to-end regression (2026-09-13): does NOT flag the real IQCD position as sellable once every cheap lot is actually sold and only the losing expensive lot remains — the real reported bug', () => {
    // The neighboring `IQCD_TXS` fixture above has no sells at all, so it
    // never actually exercised which lot gets drained — every existing test
    // in this file passed unchanged even before this function switched to
    // 'lowestCostFirst' internally, purely because none of them had a SELL
    // transaction. This reproduces the user's own real full transaction
    // sequence (see `fifoPositions.test.ts`'s identical fixture) to prove
    // the fix end to end, not just inside `computeFIFOPositions` alone.
    const realTxs: Transaction[] = [
      { date: '2026-08-10', ticker: 'IQCD', action: 'BUY', shares: 50, price: 10.4 },
      { date: '2026-09-01', ticker: 'IQCD', action: 'BUY', shares: 14, price: 9.962 },
      { date: '2026-09-07', ticker: 'IQCD', action: 'SELL', shares: 20, price: 10.02 },
      { date: '2026-09-08', ticker: 'IQCD', action: 'SELL', shares: 5, price: 10.37 },
      { date: '2026-09-08', ticker: 'IQCD', action: 'SELL', shares: 2, price: 10.37 },
      { date: '2026-09-08', ticker: 'IQCD', action: 'SELL', shares: 1, price: 10.37 },
      { date: '2026-09-09', ticker: 'IQCD', action: 'BUY', shares: 1, price: 10.08 },
      { date: '2026-09-09', ticker: 'IQCD', action: 'BUY', shares: 1, price: 10.08 },
      { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 6, price: 10.25 },
      { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 10, price: 10.25 },
      { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 6, price: 10.26 },
      { date: '2026-09-13', ticker: 'IQCD', action: 'SELL', shares: 3, price: 10.26 },
    ];
    // Real market price at the time of the report: 10.20 — below the
    // remaining expensive lot's own break-even, so the correct advice is
    // "hold," not "sell."
    expect(scanPortfolioForOpportunities(realTxs, calcFee, { IQCD: 10.2 }, 0.275, 0.01)).toEqual([]);
  });
});

describe('perShareCommission', () => {
  it('computes buy and sell commission for exactly one share at the given price', () => {
    const { buy, sell } = perShareCommission(100, calcFee);
    // Scaled to 1000 shares internally (see the function's own doc comment):
    // 100,000 * 0.275% = 275.00 exactly, divided back down = 0.275/share —
    // the true rate, not QSE's real per-transaction 2dp-cent rounding.
    expect(buy).toBe(0.275);
    expect(sell).toBe(0.275);
  });

  // User-reported (2026-09-14): a cheap stock (1.068 QAR) showed "0" RT —
  // a lone 1-share fee (0.275% of ~1 QAR ≈ 0.003) rounds straight down to
  // 0.00 under QSE's real cents-rounding. The scaled computation recovers
  // a real, nonzero per-share estimate instead.
  it('does not round a genuinely tiny per-share fee down to zero', () => {
    const { buy, sell } = perShareCommission(1.068, calcFee);
    expect(buy).toBeGreaterThan(0);
    expect(sell).toBeGreaterThan(0);
    expect(buy).toBeCloseTo(1.068 * 0.00275, 5);
  });

  it('returns zero for a non-positive price', () => {
    expect(perShareCommission(0, calcFee)).toEqual({ buy: 0, sell: 0 });
    expect(perShareCommission(-5, calcFee)).toEqual({ buy: 0, sell: 0 });
  });
});
