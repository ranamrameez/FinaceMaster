import type { Adjustment, CashLedgerEvent, FeeCalculator, Transaction, Transfer } from '../../types/workbook';
import { fmt } from '../format';

/** Merges every buy, sell, deposit, and withdrawal into one chronological cash
 * ledger with a running balance — same shape as a broker statement's
 * "Balance" column. Order ties (same date) go transfers-then-trades, since
 * that's how money usually has to arrive before you can spend it.
 * Ported 1:1 from the legacy `buildCashLedger()` in index.html. */
export function buildCashLedger(
  transactions: Transaction[],
  transfers: Transfer[],
  adjustments: Adjustment[],
  calcFee: FeeCalculator,
): CashLedgerEvent[] {
  const events: Omit<CashLedgerEvent, 'balance'>[] = [];

  transactions.forEach((tx) => {
    const amount = tx.shares * tx.price;
    const fee = calcFee(amount, tx.action === 'BUY', { shares: tx.shares, tx });
    const cashDelta = tx.action === 'BUY' ? -(amount + fee) : amount - fee;
    events.push({
      date: tx.date,
      kind: 'trade',
      action: tx.action,
      label: `${tx.action} ${fmt(tx.shares, 0)} ${tx.ticker} @ ${fmt(tx.price, 3)}`,
      amount: cashDelta,
      fee,
    });
  });

  transfers.forEach((t) => {
    const cashDelta = t.type === 'DEPOSIT' ? t.gross - t.fee : -(t.gross + t.fee);
    events.push({
      date: t.date,
      kind: 'transfer',
      action: t.type,
      label: t.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal',
      amount: cashDelta,
      fee: t.fee,
    });
  });

  (adjustments || []).forEach((a) => {
    events.push({
      date: a.date,
      kind: 'adjustment',
      action: a.amount >= 0 ? 'REWARD' : 'CORRECTION',
      label: a.note || (a.amount >= 0 ? 'Trading reward' : 'Adjustment'),
      amount: a.amount,
      fee: 0,
    });
  });

  events.sort((a, b) =>
    a.date === b.date
      ? (a.kind === 'transfer' ? -1 : 1) - (b.kind === 'transfer' ? -1 : 1)
      : a.date.localeCompare(b.date),
  );

  let balance = 0;
  return events.map((e) => {
    balance += e.amount;
    return { ...e, balance };
  });
}

export function totalTransferFees(transfers: Transfer[]): number {
  return transfers.reduce((sum, t) => sum + (t.fee || 0), 0);
}
