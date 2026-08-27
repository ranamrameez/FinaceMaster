import { describe, expect, it } from 'vitest';
import type { FeeCalculator, Transaction } from '../../../types/workbook';
import { computeClosedTrades } from '../closedTrades';

const flatFee: FeeCalculator = (amount) => Math.round(amount * 0.005 * 100) / 100; // flat 0.5%

function tx(partial: Partial<Transaction>): Transaction {
  return { date: '2026-01-01', ticker: 'ABC', action: 'BUY', shares: 0, price: 0, ...partial } as Transaction;
}

describe('computeClosedTrades', () => {
  it('produces one record for a simple full buy/sell match', () => {
    const trades = computeClosedTrades(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ date: '2026-01-10', action: 'SELL', shares: 10, price: 110 }),
      ],
      flatFee,
    );
    expect(trades).toHaveLength(1);
    const t = trades[0];
    expect(t.ticker).toBe('ABC');
    expect(t.shares).toBe(10);
    expect(t.buyPrice).toBe(100);
    expect(t.sellPrice).toBe(110);
    expect(t.buyFee).toBeCloseTo(5, 5); // 0.5% of 1000
    expect(t.sellFee).toBeCloseTo(5.5, 5); // 0.5% of 1100
    expect(t.netPL).toBeCloseTo(1100 - 5.5 - (1000 + 5), 5); // 89.5
    expect(t.holdingDays).toBe(9);
  });

  it('prorates the buy fee across a partial sell, leaving the rest as an open (unreported) lot', () => {
    const trades = computeClosedTrades(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }), // fee 5
        tx({ date: '2026-01-05', action: 'SELL', shares: 4, price: 120 }), // fee 0.6
      ],
      flatFee,
    );
    expect(trades).toHaveLength(1);
    const t = trades[0];
    expect(t.shares).toBe(4);
    expect(t.buyFee).toBeCloseTo((4 / 10) * 5, 5); // 2
    expect(t.sellFee).toBeCloseTo(2.4, 5); // full sell fee (0.5% of 480), since it's a single lot match
    expect(t.netPL).toBeCloseTo(480 - 2.4 - (400 + 2), 5); // 75.6
  });

  it('splits a sell across two buy lots into two individually-priced records', () => {
    const trades = computeClosedTrades(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 5, price: 100 }), // fee 2.5
        tx({ date: '2026-01-05', action: 'BUY', shares: 5, price: 120 }), // fee 3
        tx({ date: '2026-01-10', action: 'SELL', shares: 8, price: 130 }), // fee 5.2
      ],
      flatFee,
    );
    expect(trades).toHaveLength(2);
    const [first, second] = trades;
    // First (oldest) lot fully consumed: 5 shares @ 100.
    expect(first.buyDate).toBe('2026-01-01');
    expect(first.shares).toBe(5);
    expect(first.buyFee).toBeCloseTo(2.5, 5);
    expect(first.sellFee).toBeCloseTo((5 / 8) * 5.2, 5);
    // Second lot partially consumed: 3 of its 5 shares @ 120.
    expect(second.buyDate).toBe('2026-01-05');
    expect(second.shares).toBe(3);
    expect(second.buyFee).toBeCloseTo((3 / 5) * 3, 5);
    expect(second.sellFee).toBeCloseTo((3 / 8) * 5.2, 5);
    // Combined shares sold across both records equal the sell transaction's total.
    expect(first.shares + second.shares).toBe(8);
  });

  it('keeps different tickers fully independent', () => {
    const trades = computeClosedTrades(
      [
        tx({ ticker: 'AAA', date: '2026-01-01', action: 'BUY', shares: 10, price: 50 }),
        tx({ ticker: 'BBB', date: '2026-01-01', action: 'BUY', shares: 10, price: 200 }),
        tx({ ticker: 'AAA', date: '2026-01-05', action: 'SELL', shares: 10, price: 55 }),
      ],
      flatFee,
    );
    expect(trades).toHaveLength(1);
    expect(trades[0].ticker).toBe('AAA');
  });

  it('an unmatched buy (still fully open) produces no closed-trade record', () => {
    const trades = computeClosedTrades([tx({ date: '2026-01-01', action: 'BUY', shares: 10, price: 100 })], flatFee);
    expect(trades).toHaveLength(0);
  });

  it('a same-day buy-then-sell round trip closes correctly (BUY sorts before SELL on a tie)', () => {
    const trades = computeClosedTrades(
      [
        tx({ date: '2026-01-01', action: 'SELL', shares: 5, price: 110 }),
        tx({ date: '2026-01-01', action: 'BUY', shares: 5, price: 100 }),
      ],
      flatFee,
    );
    expect(trades).toHaveLength(1);
    expect(trades[0].holdingDays).toBe(0);
  });
});
