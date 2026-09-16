import type { Adjustment, CashLedgerEvent, FeeCalculator, Transaction, Transfer } from '../../types/workbook';
import { fmt } from '../format';
import { toInstantMs } from '../datetime';
import { sortTransactionsChronological } from './sortTransactions';

/** Merges completed valid trades, transfers and adjustments into one
 * chronological cash ledger. Pending orders and unmatched sells are not cash
 * events because this app does not model short positions. */
export function buildCashLedger(
  transactions: Transaction[],
  transfers: Transfer[],
  adjustments: Adjustment[],
  calcFee: FeeCalculator,
): CashLedgerEvent[] {
  const events: Omit<CashLedgerEvent, 'balance'>[] = [];
  const heldByTicker: Record<string, number> = {};

  sortTransactionsChronological(transactions.filter((tx) => !tx.isPending)).forEach((tx) => {
    const isBuy = tx.action === 'BUY';
    if (!isBuy && tx.shares > (heldByTicker[tx.ticker] || 0) + 1e-7) return;

    const amount = tx.shares * tx.price;
    const fee = calcFee(amount, isBuy, { shares: tx.shares, tx });
    const cashDelta = isBuy ? -(amount + fee) : amount - fee;
    events.push({ date: tx.date, time: tx.time, timezone: tx.timezone, seq: tx.seq, kind: 'trade', action: tx.action, label: `${tx.action} ${fmt(tx.shares, 0)} ${tx.ticker} @ ${fmt(tx.price, 3)}`, amount: cashDelta, fee });
    heldByTicker[tx.ticker] = (heldByTicker[tx.ticker] || 0) + (isBuy ? tx.shares : -tx.shares);
  });

  transfers.forEach((t) => {
    const cashDelta = t.type === 'DEPOSIT' ? t.gross - t.fee : -(t.gross + t.fee);
    events.push({ date: t.date, time: t.time, timezone: t.timezone, seq: t.seq, kind: 'transfer', action: t.type, label: t.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal', amount: cashDelta, fee: t.fee });
  });

  (adjustments || []).forEach((a) => {
    events.push({ date: a.date, time: a.time, timezone: a.timezone, seq: a.seq, kind: 'adjustment', action: a.amount >= 0 ? 'REWARD' : 'CORRECTION', label: a.note || (a.amount >= 0 ? 'Trading reward' : 'Adjustment'), amount: a.amount, fee: 0 });
  });

  events.sort((a, b) => {
    const byInstant = toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone);
    if (byInstant !== 0) return byInstant;
    const byKind = (a.kind === 'transfer' ? -1 : 1) - (b.kind === 'transfer' ? -1 : 1);
    if (byKind !== 0) return byKind;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });

  let balance = 0;
  return events.map((e) => {
    balance += e.amount;
    return { ...e, balance };
  });
}

export function totalTransferFees(transfers: Transfer[]): number {
  return transfers.reduce((sum, t) => sum + (t.fee || 0), 0);
}
