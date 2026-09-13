import { describe, expect, it } from 'vitest';
import fixture from './fixtures/psx-workbook-backup.json';
import type { PSXSettings } from '../../../types/psxWorkbook';
import type { Transaction } from '../../../types/workbook';
import { computeFIFOPositions } from '../fifoPositions';
import { computePositions } from '../positions';
import { makePSXFeeCalculator } from '../psxFees';

// README item 8: FIFO lot matching should attribute cost basis to specific
// buy lots (oldest first) instead of blending every buy into one running
// average — hand-traced synthetic cases below, plus a sanity pass over the
// real backup fixture confirming the pipeline runs clean and genuinely
// differs from the weighted-average result once lots were bought at
// different prices (that's the whole point of the feature).

const NO_FEE_SETTINGS: PSXSettings = {
  feePct: 0,
  lowPriceThreshold: 0,
  lowPriceFee: 0,
  sstPct: 0,
  sstIncludedInCommission: true,
  psxFeePct: 0,
  nccplFeePct: 0,
  secpLevyPct: 0,
  cdcPerShare: 0,
  cvtPct: 0,
  minFee: 0,
  tick: 0.01,
  currency: 'PKR',
  depositFee: 0,
  cgtFilerPct: 15,
  cgtNonFilerPct: 30,
  filerStatus: 'filer',
  costBasisMethod: 'fifo',
};

const noFee = () => 0;

describe('computeFIFOPositions', () => {
  it('consumes the oldest lot first on a partial sell', () => {
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 10 },
      { date: '2026-02-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 20 },
      { date: '2026-03-01', ticker: 'TEST', action: 'SELL', shares: 150, price: 30 },
    ];
    const { positions, lotsByTicker } = computeFIFOPositions(txs, noFee);
    const p = positions.find((x) => x.ticker === 'TEST')!;

    // Sells 100 @ cost 10 (fully consumes lot 1) + 50 @ cost 20 (partial lot 2).
    const costRemoved = 100 * 10 + 50 * 20;
    const proceeds = 150 * 30;
    expect(p.realized).toBeCloseTo(proceeds - costRemoved, 5);

    // 50 shares left, all from the second (20/share) lot.
    expect(p.shares).toBe(50);
    expect(p.invested).toBeCloseTo(50 * 20, 5);
    expect(lotsByTicker.TEST).toHaveLength(1);
    expect(lotsByTicker.TEST[0]).toMatchObject({ buyPrice: 20, remainingShares: 50 });
  });

  it('differs from weighted-average when lots were bought at different prices', () => {
    // Same scenario as above: weighted-average blends to avg cost 15/share for
    // the sell, FIFO attributes the sell to the cheaper first lot — the two
    // methods must disagree here, or FIFO isn't doing anything.
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 10 },
      { date: '2026-02-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 20 },
      { date: '2026-03-01', ticker: 'TEST', action: 'SELL', shares: 100, price: 30 },
    ];
    const fifo = computeFIFOPositions(txs, noFee).positions.find((p) => p.ticker === 'TEST')!;
    const avg = computePositions(txs, noFee).find((p) => p.ticker === 'TEST')!;

    expect(fifo.realized).not.toBeCloseTo(avg.realized, 2);
    // FIFO: sold 100 @ cost 10 -> realized = 100*30 - 100*10 = 2000.
    expect(fifo.realized).toBeCloseTo(2000, 5);
    // Weighted-average: avg cost (100*10+100*20)/200=15 -> realized = 100*30-100*15=1500.
    expect(avg.realized).toBeCloseTo(1500, 5);
  });

  it('allocates each lot its own buy fee, divided per remaining share', () => {
    const feePerBuy = 50; // flat fee regardless of amount, for a simple hand-traceable case
    const calcFee = (_amount: number, isBuy: boolean) => (isBuy ? feePerBuy : 0);
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 100, price: 10 }, // cost/share incl fee = 10 + 50/100 = 10.5
      { date: '2026-02-01', ticker: 'TEST', action: 'SELL', shares: 40, price: 30 },
    ];
    const { positions, lotsByTicker } = computeFIFOPositions(txs, calcFee);
    const p = positions.find((x) => x.ticker === 'TEST')!;

    expect(lotsByTicker.TEST[0].remainingShares).toBe(60);
    // Remaining 60 shares still carry the original lot's per-share fee allocation.
    expect(p.invested).toBeCloseTo(60 * 10.5, 5);
    // Sold 40 @ cost 10.5/share (fee-inclusive), no sell fee in this test's calcFee.
    expect(p.realized).toBeCloseTo(40 * 30 - 40 * 10.5, 5);
  });

  it('treats oversold shares (more sold than held) as zero-cost-basis for the excess, matching computePositions', () => {
    const txs: Transaction[] = [
      { date: '2026-01-01', ticker: 'TEST', action: 'BUY', shares: 10, price: 10 },
      { date: '2026-02-01', ticker: 'TEST', action: 'SELL', shares: 15, price: 20 },
    ];
    const { positions } = computeFIFOPositions(txs, noFee);
    const p = positions.find((x) => x.ticker === 'TEST')!;
    expect(p.shares).toBe(0);
    // Cost removed = 10*10 (only lot available) — the other 5 oversold shares have no cost basis.
    expect(p.realized).toBeCloseTo(15 * 20 - 10 * 10, 5);
  });

  it('closes a same-day round trip correctly even when the SELL is entered before the matching BUY', () => {
    // Same root-cause bug as computePositions' equivalent test: with no
    // time-of-day on Transaction, a same-day SELL sitting before its
    // matching BUY in the array must not be processed against an
    // empty lot queue — this is exactly the user-reported scenario
    // (buy 2, sell 2, same day) that should net to a fully closed position.
    const sameDay: Transaction[] = [
      { date: '2026-08-24', ticker: 'ROUNDTRIP', action: 'SELL', shares: 2, price: 334.5 },
      { date: '2026-08-24', ticker: 'ROUNDTRIP', action: 'BUY', shares: 2, price: 330.5 },
    ];
    const { positions } = computeFIFOPositions(sameDay, noFee);
    const p = positions.find((x) => x.ticker === 'ROUNDTRIP')!;
    expect(p.shares).toBe(0);
    expect(p.invested).toBe(0);
    expect(p.realized).toBeCloseTo(669 - 661, 5);
  });

  describe('targetLotBuyId (specific lot identification, Partial Trade Strategy "Sell this lot")', () => {
    // The real IQCD case this exists for: 50 sh @10.40 (older, expensive) +
    // 14 sh @9.962 (newer, cheap) — a normal FIFO sell always drains the
    // OLDEST lot first, so selling exactly the cheap lot's 14 shares would
    // otherwise silently reduce the expensive lot instead, leaving a
    // misleading average cost/break-even for what's actually still held.
    const lots: Transaction[] = [
      { id: 'buy-old', date: '2026-01-01', ticker: 'IQCD', action: 'BUY', shares: 50, price: 10.4 },
      { id: 'buy-cheap', date: '2026-01-15', ticker: 'IQCD', action: 'BUY', shares: 14, price: 9.962 },
    ];

    it('without targetLotBuyId, a sell still drains the oldest lot first (unchanged default)', () => {
      const txs = [...lots, { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 14, price: 10.37 } as Transaction];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee);
      // The expensive lot lost 14 shares (36 left); the cheap lot is untouched.
      expect(lotsByTicker.IQCD).toEqual([
        expect.objectContaining({ buyId: 'buy-old', buyPrice: 10.4, remainingShares: 36 }),
        expect.objectContaining({ buyId: 'buy-cheap', buyPrice: 9.962, remainingShares: 14 }),
      ]);
    });

    it('with targetLotBuyId set, a sell closes that specific (non-oldest) lot instead, leaving the oldest lot untouched', () => {
      const txs = [
        ...lots,
        { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 14, price: 10.37, targetLotBuyId: 'buy-cheap' } as Transaction,
      ];
      const { positions, lotsByTicker } = computeFIFOPositions(txs, noFee);
      const p = positions.find((x) => x.ticker === 'IQCD')!;

      // The cheap lot is fully closed; only the expensive lot remains —
      // so avg cost / break-even for what's left is driven purely by the
      // 50-share @10.40 lot, not a blended or misattributed figure.
      expect(lotsByTicker.IQCD).toHaveLength(1);
      expect(lotsByTicker.IQCD[0]).toMatchObject({ buyId: 'buy-old', buyPrice: 10.4, remainingShares: 50 });
      expect(p.shares).toBe(50);
      expect(p.invested).toBeCloseTo(50 * 10.4, 5);
      // Realized P/L is priced off the CHEAP lot's own cost, not the old lot's.
      expect(p.realized).toBeCloseTo(14 * 10.37 - 14 * 9.962, 5);
    });

    it('falls through to normal oldest-first FIFO for shares beyond what the targeted lot holds', () => {
      const txs = [
        ...lots,
        // Sells 20 shares targeting the 14-share cheap lot — the cheap lot
        // covers 14 of them, the remaining 6 fall through to the next
        // oldest lot in the normal queue (the expensive lot).
        { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 20, price: 10.37, targetLotBuyId: 'buy-cheap' } as Transaction,
      ];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee);
      expect(lotsByTicker.IQCD).toEqual([expect.objectContaining({ buyId: 'buy-old', remainingShares: 44 })]);
    });

    it('ignores an unmatched targetLotBuyId and falls back to normal oldest-first FIFO', () => {
      const txs = [...lots, { date: '2026-02-01', ticker: 'IQCD', action: 'SELL', shares: 14, price: 10.37, targetLotBuyId: 'no-such-lot' } as Transaction];
      const { lotsByTicker } = computeFIFOPositions(txs, noFee);
      expect(lotsByTicker.IQCD).toEqual([
        expect.objectContaining({ buyId: 'buy-old', remainingShares: 36 }),
        expect.objectContaining({ buyId: 'buy-cheap', remainingShares: 14 }),
      ]);
    });
  });

  it('runs clean over the real PSX backup fixture and produces finite numbers', () => {
    const transactions = fixture.transactions as Transaction[];
    const calcFee = makePSXFeeCalculator(NO_FEE_SETTINGS, transactions);
    const { positions, realizedSeries } = computeFIFOPositions(transactions, calcFee);
    const tickers = new Set(transactions.map((t) => t.ticker));
    expect(positions.length).toBe(tickers.size);
    positions.forEach((p) => {
      expect(Number.isFinite(p.invested)).toBe(true);
      expect(Number.isFinite(p.realized)).toBe(true);
      expect(p.shares).toBeGreaterThanOrEqual(0);
    });
    realizedSeries.forEach((point) => expect(Number.isFinite(point.value)).toBe(true));
  });
});
