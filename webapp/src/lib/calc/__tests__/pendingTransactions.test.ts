import { describe, expect, it } from 'vitest';
import type { FeeCalculator, Transaction } from '../../../types/workbook';
import { cashSummary } from '../cashSummary';
import { computeClosedTrades } from '../closedTrades';
import { computeFIFOPositions } from '../fifoPositions';
import { computePositions, pendingShareDeltaByTicker } from '../positions';
import { computeRealizedPLTimeSeries } from '../realizedPL';

const flatFee: FeeCalculator = (amount) => Math.round(amount * 0.01 * 100) / 100; // flat 1%

function tx(partial: Partial<Transaction>): Transaction {
  return { date: '2026-01-01', ticker: 'ABC', action: 'BUY', shares: 0, price: 0, ...partial } as Transaction;
}

describe('computePositions excludes pending transactions', () => {
  it('a pending BUY does not add shares/invested yet', () => {
    const positions = computePositions(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ date: '2026-01-05', action: 'BUY', shares: 5, price: 110, isPending: true }),
      ],
      flatFee,
    );
    expect(positions).toHaveLength(1);
    expect(positions[0].shares).toBe(10);
  });

  it('a pending SELL does not remove shares or realize P&L yet', () => {
    const positions = computePositions(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ date: '2026-01-10', action: 'SELL', shares: 5, price: 120, isPending: true }),
      ],
      flatFee,
    );
    expect(positions[0].shares).toBe(10);
    expect(positions[0].realized).toBe(0);
  });

  it('a record with no isPending field behaves exactly as before (zero-migration)', () => {
    const transactions = [tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 })];
    expect(transactions[0].isPending).toBeUndefined();
    expect(computePositions(transactions, flatFee)[0].shares).toBe(10);
  });
});

describe('pendingShareDeltaByTicker', () => {
  it('a pending BUY is a positive delta, a pending SELL is negative', () => {
    const delta = pendingShareDeltaByTicker([
      tx({ ticker: 'AAA', action: 'BUY', shares: 10, isPending: true }),
      tx({ ticker: 'AAA', action: 'SELL', shares: 3, isPending: true }),
      tx({ ticker: 'BBB', action: 'BUY', shares: 4, isPending: true }),
      tx({ ticker: 'CCC', action: 'BUY', shares: 100 }), // cleared, ignored
    ]);
    expect(delta).toEqual({ AAA: 7, BBB: 4 });
  });

  it('a ticker with no pending activity is simply absent, not zero', () => {
    const delta = pendingShareDeltaByTicker([tx({ ticker: 'AAA', action: 'BUY', shares: 10 })]);
    expect(delta.AAA).toBeUndefined();
  });
});

describe('computeFIFOPositions / computeClosedTrades / computeRealizedPLTimeSeries exclude pending', () => {
  it('a pending SELL leaves the FIFO lot untouched', () => {
    const { positions, lotsByTicker } = computeFIFOPositions(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ date: '2026-01-05', action: 'SELL', shares: 4, price: 120, isPending: true }),
      ],
      flatFee,
    );
    expect(positions[0].shares).toBe(10);
    expect(lotsByTicker.ABC[0].remainingShares).toBe(10);
  });

  it('a pending SELL produces no closed-trade record', () => {
    const trades = computeClosedTrades(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ date: '2026-01-05', action: 'SELL', shares: 4, price: 120, isPending: true }),
      ],
      flatFee,
    );
    expect(trades).toHaveLength(0);
  });

  it('a pending SELL contributes no point to the realized P&L series', () => {
    const points = computeRealizedPLTimeSeries(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ date: '2026-01-05', action: 'SELL', shares: 4, price: 120, isPending: true }),
      ],
      flatFee,
    );
    expect(points).toHaveLength(0);
  });
});

describe('cashSummary excludes pending trades from cashBalance and surfaces pendingCashImpact', () => {
  it('a pending BUY locks cash out of the headline balance', () => {
    const summary = cashSummary(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }), // cleared: -1010 (fee 1%=10)
        tx({ date: '2026-01-05', action: 'BUY', shares: 5, price: 100, isPending: true }), // pending: would be -505
      ],
      [{ id: 'd1', date: '2026-01-01', type: 'DEPOSIT', gross: 2000, fee: 0 }],
      [],
      {},
      flatFee,
    );
    // Cleared: 2000 deposit - 1010 cleared buy = 990. The pending buy's -505
    // is NOT included in cashBalance.
    expect(summary.cashBalance).toBeCloseTo(990, 5);
    expect(summary.pendingCashImpact).toBeCloseTo(-505, 5);
  });

  it('a pending SELL would add cash, shown as a positive pendingCashImpact', () => {
    const summary = cashSummary(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ date: '2026-01-10', action: 'SELL', shares: 5, price: 120, isPending: true }), // would be +594 (600-6 fee)
      ],
      [],
      [],
      {},
      flatFee,
    );
    expect(summary.pendingCashImpact).toBeCloseTo(594, 5);
  });

  it('no pending transactions: pendingCashImpact is 0 and cashBalance is unaffected (zero-migration)', () => {
    const summary = cashSummary(
      [tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 })],
      [{ id: 'd1', date: '2026-01-01', type: 'DEPOSIT', gross: 2000, fee: 0 }],
      [],
      {},
      flatFee,
    );
    expect(summary.pendingCashImpact).toBe(0);
    expect(summary.cashBalance).toBeCloseTo(990, 5);
  });
});
