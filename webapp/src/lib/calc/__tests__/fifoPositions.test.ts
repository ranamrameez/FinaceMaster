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
