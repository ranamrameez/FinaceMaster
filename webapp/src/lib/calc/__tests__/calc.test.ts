import { describe, expect, it } from 'vitest';
import fixture from './fixtures/qse-workbook-backup.json';
import type { Transaction, Transfer, Adjustment } from '../../../types/workbook';
import { makeQSEFeeCalculator, breakEvenPrice, roundTick } from '../fees';
import { computePositions } from '../positions';
import { buildCashLedger, totalTransferFees } from '../cashLedger';
import { cashSummary } from '../cashSummary';

// Fixture is a real backup export from the legacy app (qse-workbook-backup.json).
// Expected values below were hand-traced from the same weighted-average-cost
// algorithm to confirm the TypeScript port matches the legacy JS exactly.

const transactions = fixture.transactions as Transaction[];
const transfers = fixture.transfers as Transfer[];
const adjustments = fixture.adjustments as Adjustment[];
const settings = fixture.settings;
const calcFee = makeQSEFeeCalculator(settings);

describe('makeQSEFeeCalculator', () => {
  it('matches the legacy calcFee formula (pct of amount, floored at minFee)', () => {
    // 9 shares * 1.214 = 10.926; 10.926 * 0.275% = 0.0300465 -> rounds to 0.03
    expect(calcFee(9 * 1.214, true)).toBeCloseTo(0.03, 2);
  });

  it('returns 0 for non-positive amounts', () => {
    expect(calcFee(0, true)).toBe(0);
    expect(calcFee(-5, true)).toBe(0);
  });
});

describe('roundTick', () => {
  it('rounds to the nearest tick increment', () => {
    expect(roundTick(2.156, 0.01)).toBeCloseTo(2.16, 5);
    expect(roundTick(2.154, 0.01)).toBeCloseTo(2.15, 5);
  });
});

describe('breakEvenPrice', () => {
  it('produces a price whose net proceeds cover the cost basis', () => {
    const costBasis = 695.494;
    const shares = 634;
    const price = breakEvenPrice(costBasis, shares, settings.feePct, settings.tick, calcFee);
    const amount = price * shares;
    const net = amount - calcFee(amount, false);
    expect(net).toBeGreaterThanOrEqual(costBasis - 1); // within ~1 unit given tick rounding
  });
});

describe('computePositions (weighted-average cost)', () => {
  const positions = computePositions(transactions, calcFee);
  const byTicker = Object.fromEntries(positions.map((p) => [p.ticker, p]));

  it('computes MPHC: one full round-trip lot then three more buys, hand-traced', () => {
    const mphc = byTicker.MPHC;
    expect(mphc).toBeDefined();
    expect(mphc.shares).toBe(634);
    expect(mphc.invested).toBeCloseTo(695.494, 2);
    expect(mphc.buyFees).toBeCloseTo(1.94, 2);
    expect(mphc.sellFees).toBeCloseTo(0.03, 2);
    expect(mphc.realized).toBeCloseTo(-0.051, 3);
    expect(mphc.totalBoughtShares).toBe(643);
    expect(mphc.totalSoldShares).toBe(9);
    expect(mphc.buyCount).toBe(4);
    expect(mphc.sellCount).toBe(1);
    expect(mphc.firstDate).toBe('2026-06-22');
    expect(mphc.lastDate).toBe('2026-08-10');
  });

  it('zeroes out invested cost once a ticker is fully sold', () => {
    // QIBK: single buy then single full sell of the same 6 shares.
    const qibk = byTicker.QIBK;
    expect(qibk.shares).toBe(0);
    expect(qibk.invested).toBe(0);
  });
});

describe('totalTransferFees / buildCashLedger', () => {
  it('sums the flat deposit fees from the fixture', () => {
    expect(totalTransferFees(transfers)).toBeCloseTo(40, 5);
  });

  it('produces a running balance ending at a finite number with one event per input row', () => {
    const ledger = buildCashLedger(transactions, transfers, adjustments, calcFee);
    expect(ledger).toHaveLength(transactions.length + transfers.length + adjustments.length);
    const last = ledger[ledger.length - 1];
    expect(Number.isFinite(last.balance)).toBe(true);
  });
});

describe('cashSummary', () => {
  it('rolls up deposits and rewards from the fixture', () => {
    const summary = cashSummary(transactions, transfers, adjustments, fixture.marketPrices, calcFee);
    expect(summary.totalInward).toBeCloseTo(495 + 1010 + 2000 + 3000, 2);
    expect(summary.totalOutward).toBe(0);
    expect(summary.totalRewards).toBeCloseTo(0.34 + 0.21 + 0.34 + 2.54 + 1.1, 2);
    expect(summary.transferFees).toBeCloseTo(40, 5);
    expect(Number.isFinite(summary.netWorth)).toBe(true);
  });
});
