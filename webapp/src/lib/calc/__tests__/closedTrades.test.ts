import { describe, expect, it } from 'vitest';
import type { FeeCalculator, Transaction } from '../../../types/workbook';
import { closedPLBySellTxId, computeClosedTrades } from '../closedTrades';

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

  it('honors lotAllocations/targetLotBuyId, matching the official Open-lots numbers exactly (closes README Pending item 134)', () => {
    // Before 2026-09-18, this reporting ledger always matched oldest-first/
    // cheapest-first regardless of a real manual allocation — meaning it
    // could disagree with the official computeFIFOPositions numbers about
    // which lot(s) a sale actually drew from. Both now go through the same
    // shared `consumeLotsForSell` priority walk.
    const lotA = tx({ id: 'lot-a', date: '2026-01-01', action: 'BUY', shares: 10, price: 100 });
    const lotB = tx({ id: 'lot-b', date: '2026-02-01', action: 'BUY', shares: 10, price: 110 });
    const sell = tx({
      date: '2026-03-01', action: 'SELL', shares: 10, price: 130,
      targetLotBuyId: 'lot-b', // targets the NON-oldest lot deliberately
    });
    const trades = computeClosedTrades([lotA, lotB, sell], flatFee, 'fifo');
    // Split, never merged: one record, priced off the TARGETED lot (110),
    // not the oldest (100) that plain FIFO would otherwise have picked.
    expect(trades).toHaveLength(1);
    expect(trades[0].buyDate).toBe('2026-02-01');
    expect(trades[0].buyPrice).toBe(110);
    expect(trades[0].shares).toBe(10);
  });

  it('honors lotAllocations for a genuinely split (never merged) multi-lot sell', () => {
    const lotA = tx({ id: 'lot-a', date: '2026-01-01', action: 'BUY', shares: 10, price: 100 });
    const lotB = tx({ id: 'lot-b', date: '2026-02-01', action: 'BUY', shares: 10, price: 110 });
    const lotC = tx({ id: 'lot-c', date: '2026-03-01', action: 'BUY', shares: 10, price: 120 });
    const sell = tx({
      date: '2026-04-01', action: 'SELL', shares: 15, price: 200,
      lotAllocations: [{ buyId: 'lot-c', shares: 10 }, { buyId: 'lot-a', shares: 5 }],
    });
    const trades = computeClosedTrades([lotA, lotB, lotC, sell], flatFee, 'fifo');
    // Two individually-priced records (lot A and lot C) — never a single
    // blended-average record — and lot B (never allocated) doesn't appear
    // at all, matching what the shared lot-consumption walk actually did.
    expect(trades).toHaveLength(2);
    const byBuyPrice = Object.fromEntries(trades.map((t) => [t.buyPrice, t]));
    expect(byBuyPrice[120].shares).toBe(10);
    expect(byBuyPrice[100].shares).toBe(5);
    expect(byBuyPrice[110]).toBeUndefined();
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

describe('closedPLBySellTxId', () => {
  it('sums P&L across every lot a single sell drained into one figure keyed by that sell', () => {
    // A sell (id "s1") that drains two buy lots produces two ClosedTrade
    // records sharing the same sellTxId — the inline row figure should
    // blend them into one net number for that sell transaction.
    const trades = computeClosedTrades(
      [
        tx({ id: 'b1', date: '2026-01-01', action: 'BUY', shares: 5, price: 100 }),
        tx({ id: 'b2', date: '2026-01-02', action: 'BUY', shares: 5, price: 120 }),
        tx({ id: 's1', date: '2026-01-10', action: 'SELL', shares: 10, price: 130 }),
      ],
      flatFee,
    );
    expect(trades).toHaveLength(2);
    const byId = closedPLBySellTxId(trades);
    expect(Object.keys(byId)).toEqual(['s1']);
    expect(byId.s1.shares).toBe(10);
    expect(byId.s1.netPL).toBeCloseTo(
      trades[0].netPL + trades[1].netPL,
      5,
    );
  });

  it('keeps two different sells fully independent', () => {
    const trades = computeClosedTrades(
      [
        tx({ id: 'b1', date: '2026-01-01', action: 'BUY', shares: 10, price: 100 }),
        tx({ id: 's1', date: '2026-01-05', action: 'SELL', shares: 4, price: 110 }),
        tx({ id: 's2', date: '2026-01-10', action: 'SELL', shares: 6, price: 120 }),
      ],
      flatFee,
    );
    const byId = closedPLBySellTxId(trades);
    expect(byId.s1.shares).toBe(4);
    expect(byId.s2.shares).toBe(6);
    expect(byId.s1.netPL).not.toBeCloseTo(byId.s2.netPL, 0);
  });

  it('a sell with no id (legacy data) is simply excluded, not thrown into an "undefined" bucket', () => {
    const trades = computeClosedTrades(
      [
        tx({ date: '2026-01-01', action: 'BUY', shares: 5, price: 100 }),
        tx({ date: '2026-01-05', action: 'SELL', shares: 5, price: 110 }),
      ],
      flatFee,
    );
    expect(Object.keys(closedPLBySellTxId(trades))).toHaveLength(0);
  });

  describe('matchOrder (user-reported 2026-09-13: neither exchange\'s fee depends on which lot a sale is attributed to)', () => {
    // The real shape this exists for: an older, EXPENSIVE lot and a newer,
    // CHEAP lot both open when a sell happens at a price above the cheap
    // lot's cost but below the expensive lot's — FIFO (default) locks in a
    // loss against the expensive lot while the cheap lot sits untouched;
    // 'lowestCostFirst' instead credits the sale to the cheap lot, showing
    // a gain, and leaves the expensive lot open instead.
    const lots: Transaction[] = [
      tx({ id: 'buy-old-expensive', date: '2026-01-01', action: 'BUY', shares: 50, price: 10.40 }),
      tx({ id: 'buy-new-cheap', date: '2026-01-15', action: 'BUY', shares: 14, price: 9.96 }),
    ];

    it('defaults to FIFO (oldest lot first), unchanged from before this parameter existed', () => {
      const trades = computeClosedTrades([...lots, tx({ date: '2026-02-01', action: 'SELL', shares: 14, price: 10.20 })], flatFee);
      expect(trades).toHaveLength(1);
      expect(trades[0].buyPrice).toBe(10.40);
    });

    it('lowestCostFirst matches the cheaper lot instead, even though it was bought later', () => {
      const trades = computeClosedTrades(
        [...lots, tx({ date: '2026-02-01', action: 'SELL', shares: 14, price: 10.20 })],
        flatFee,
        'lowestCostFirst',
      );
      expect(trades).toHaveLength(1);
      expect(trades[0].buyPrice).toBe(9.96);
      // Same sale, cheaper cost basis credited -> strictly more favorable P/L than FIFO's.
      const fifoTrades = computeClosedTrades([...lots, tx({ date: '2026-02-01', action: 'SELL', shares: 14, price: 10.20 })], flatFee);
      expect(trades[0].netPL).toBeGreaterThan(fifoTrades[0].netPL);
    });

    it('falls through to the next-cheapest lot once the cheapest is exhausted', () => {
      const trades = computeClosedTrades(
        [...lots, tx({ date: '2026-02-01', action: 'SELL', shares: 20, price: 10.20 })],
        flatFee,
        'lowestCostFirst',
      );
      expect(trades).toHaveLength(2);
      expect(trades[0].buyPrice).toBe(9.96);
      expect(trades[0].shares).toBe(14);
      expect(trades[1].buyPrice).toBe(10.40);
      expect(trades[1].shares).toBe(6);
    });

    it('total realized P/L is identical between match orders ONLY once every share is sold — with shares still open, the two methods leave a genuinely different remainder behind, so their realized totals differ on purpose', () => {
      // Partial close (44 of 64 shares) — the two methods leave DIFFERENT
      // shares open (FIFO: a mix of both lots; lowestCostFirst: only the
      // expensive lot), so their realized-so-far totals are NOT expected
      // to match — this is the real, intentional tradeoff being tested,
      // not a bug.
      const partial: Transaction[] = [
        ...lots,
        tx({ date: '2026-02-01', action: 'SELL', shares: 14, price: 10.20 }),
        tx({ date: '2026-03-01', action: 'SELL', shares: 30, price: 10.05 }),
      ];
      const fifoPartial = computeClosedTrades(partial, flatFee).reduce((s, t) => s + t.netPL, 0);
      const lcfPartial = computeClosedTrades(partial, flatFee, 'lowestCostFirst').reduce((s, t) => s + t.netPL, 0);
      expect(lcfPartial).not.toBeCloseTo(fifoPartial, 1);

      // Fully closed (all 64 shares sold) — now there's no remainder left
      // for the two methods to attribute differently, so the total must
      // match exactly: it's just (total sell proceeds) - (total buy cost),
      // independent of which lot each sale was said to close.
      const full: Transaction[] = [
        ...lots,
        tx({ date: '2026-02-01', action: 'SELL', shares: 14, price: 10.20 }),
        tx({ date: '2026-03-01', action: 'SELL', shares: 50, price: 10.05 }),
      ];
      const fifoFull = computeClosedTrades(full, flatFee).reduce((s, t) => s + t.netPL, 0);
      const lcfFull = computeClosedTrades(full, flatFee, 'lowestCostFirst').reduce((s, t) => s + t.netPL, 0);
      expect(lcfFull).toBeCloseTo(fifoFull, 5);
    });
  });
});
