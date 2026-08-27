import { describe, expect, it } from 'vitest';
import type { Adjustment, FeeCalculator, Transaction, Transfer } from '../../../types/workbook';
import { buildCashLedger } from '../cashLedger';

const flatFee: FeeCalculator = () => 0;

function tx(over: Partial<Transaction>): Transaction {
  return { date: '2026-01-01', ticker: 'ABC', action: 'BUY', shares: 1, price: 100, ...over };
}

describe('buildCashLedger', () => {
  it('puts a transfer before a trade on an exact instant tie, regardless of seq', () => {
    const t: Transaction = tx({ date: '2026-01-01', action: 'SELL', shares: 1, price: 100, seq: 1 });
    const xfer: Transfer = { id: 'x1', date: '2026-01-01', type: 'DEPOSIT', gross: 500, fee: 0, seq: 2 };
    const ledger = buildCashLedger([t], [xfer], [], flatFee);
    expect(ledger.map((e) => e.kind)).toEqual(['transfer', 'trade']);
  });

  it('breaks a same-kind, same-instant tie by seq, not array position', () => {
    // Two same-day trades, no time set -> identical noon-UTC instant.
    // Deliberately in the OPPOSITE order their seq implies.
    const first = tx({ date: '2026-01-01', action: 'SELL', shares: 1, price: 100, seq: 1 });
    const second = tx({ date: '2026-01-01', action: 'SELL', shares: 1, price: 200, seq: 2 });
    const ledger = buildCashLedger([second, first], [], [], flatFee);
    expect(ledger.map((e) => e.amount)).toEqual([100, 200]);
  });

  it('never orders adjustments before a same-instant transfer', () => {
    const adj: Adjustment = { date: '2026-01-01', amount: 10, seq: 1 };
    const xfer: Transfer = { id: 'x1', date: '2026-01-01', type: 'DEPOSIT', gross: 500, fee: 0, seq: 2 };
    const ledger = buildCashLedger([], [xfer], [adj], flatFee);
    expect(ledger.map((e) => e.kind)).toEqual(['transfer', 'adjustment']);
  });
});
