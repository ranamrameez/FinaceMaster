import { describe, expect, it } from 'vitest';
import type { Adjustment, FeeCalculator, Transaction, Transfer } from '../../../types/workbook';
import { buildCashLedger } from '../cashLedger';

const flatFee: FeeCalculator = () => 0;

function tx(over: Partial<Transaction>): Transaction {
  return { date: '2026-01-01', ticker: 'ABC', action: 'BUY', shares: 1, price: 100, ...over };
}

describe('buildCashLedger', () => {
  it('puts a transfer before a trade on an exact instant tie, regardless of seq', () => {
    // A preceding BUY (seq 1, an earlier date so it's never part of the
    // tie itself) supplies the share the SELL needs — a lone SELL with
    // nothing held is correctly rejected by buildCashLedger's own oversell
    // guard regardless of ordering, which an earlier version of this test
    // didn't account for (corrected 2026-09-18 while verifying an
    // unrelated change: it always produced an empty ledger, for a reason
    // unrelated to the tie-breaking this test means to exercise).
    const buy: Transaction = tx({ date: '2025-12-31', action: 'BUY', shares: 1, price: 90, seq: 1 });
    const t: Transaction = tx({ date: '2026-01-01', action: 'SELL', shares: 1, price: 100, seq: 2 });
    const xfer: Transfer = { id: 'x1', date: '2026-01-01', type: 'DEPOSIT', gross: 500, fee: 0, seq: 3 };
    const ledger = buildCashLedger([buy, t], [xfer], [], flatFee);
    expect(ledger.map((e) => e.kind)).toEqual(['trade', 'transfer', 'trade']);
  });

  it('breaks a same-kind, same-instant tie by seq, not array position', () => {
    // A preceding BUY of 2 shares supplies both same-day SELLs below —
    // same fix as the test above, unrelated to the tie-breaking itself.
    const buy = tx({ date: '2025-12-31', action: 'BUY', shares: 2, price: 90, seq: 1 });
    // Two same-day trades, no time set -> identical noon-UTC instant.
    // Deliberately in the OPPOSITE order their seq implies.
    const first = tx({ date: '2026-01-01', action: 'SELL', shares: 1, price: 100, seq: 2 });
    const second = tx({ date: '2026-01-01', action: 'SELL', shares: 1, price: 200, seq: 3 });
    const ledger = buildCashLedger([second, buy, first], [], [], flatFee);
    expect(ledger.map((e) => e.amount)).toEqual([-180, 100, 200]);
  });

  it('never orders adjustments before a same-instant transfer', () => {
    const adj: Adjustment = { date: '2026-01-01', amount: 10, seq: 1 };
    const xfer: Transfer = { id: 'x1', date: '2026-01-01', type: 'DEPOSIT', gross: 500, fee: 0, seq: 2 };
    const ledger = buildCashLedger([], [xfer], [adj], flatFee);
    expect(ledger.map((e) => e.kind)).toEqual(['transfer', 'adjustment']);
  });
});
