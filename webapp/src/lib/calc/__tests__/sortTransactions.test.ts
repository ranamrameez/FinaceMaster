import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../../types/workbook';
import { sortTransactionsChronological } from '../sortTransactions';

function tx(partial: Partial<Transaction>): Transaction {
  return { date: '2026-01-01', ticker: 'ABC', action: 'BUY', shares: 1, price: 100, ...partial };
}

describe('sortTransactionsChronological', () => {
  it('sorts by date first', () => {
    const sorted = sortTransactionsChronological([
      tx({ date: '2026-01-03', seq: 1 }),
      tx({ date: '2026-01-01', seq: 2 }),
      tx({ date: '2026-01-02', seq: 3 }),
    ]);
    expect(sorted.map((t) => t.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('puts BUY before SELL on an exact instant tie, regardless of seq', () => {
    const sorted = sortTransactionsChronological([
      tx({ action: 'SELL', seq: 1 }), // entered first, but a sell
      tx({ action: 'BUY', seq: 2 }), // entered second, but a buy
    ]);
    expect(sorted.map((t) => t.action)).toEqual(['BUY', 'SELL']);
  });

  it('falls back to seq (not array position) when BUY-before-SELL does not disambiguate', () => {
    // Two same-day BUYs, deliberately placed in the array in the OPPOSITE
    // order their seq implies — a real reorder (edit/delete-and-re-add/
    // import) that array-position-based tie-breaking would get wrong.
    const first = tx({ action: 'BUY', shares: 5, seq: 1 });
    const second = tx({ action: 'BUY', shares: 10, seq: 2 });
    const sorted = sortTransactionsChronological([second, first]); // array order: second, first
    expect(sorted.map((t) => t.shares)).toEqual([5, 10]); // seq order wins: first (seq 1), then second (seq 2)
  });

  it('treats a missing seq as 0, so an un-seq-ed record sorts before any seq-ed one on a tie', () => {
    const withSeq = tx({ action: 'SELL', shares: 10, seq: 5 });
    const withoutSeq = tx({ action: 'SELL', shares: 20 });
    const sorted = sortTransactionsChronological([withSeq, withoutSeq]);
    expect(sorted.map((t) => t.shares)).toEqual([20, 10]);
  });
});
