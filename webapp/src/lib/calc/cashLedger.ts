import type { Adjustment, CashLedgerEvent, FeeCalculator, Transaction, Transfer } from '../../types/workbook';
import { fmt } from '../format';
import { toInstantMs } from '../datetime';

/** Merges every buy, sell, deposit, and withdrawal into one chronological cash
 * ledger with a running balance — same shape as a broker statement's
 * "Balance" column. Sorted by real instant (Pending item 41's optional
 * `time`/`timezone` on each record, see `lib/datetime.ts`); on an exact
 * tie (the common case for untimed records, which all default to the same
 * noon-UTC placeholder) transfers still go before trades, since that's how
 * money usually has to arrive before you can spend it — a domain rule, not
 * an ordering preference, so it's checked first. When that rule doesn't
 * disambiguate (two events of the SAME kind at the same instant), `seq`
 * (carried through from whichever record produced the event — see
 * `Transaction.seq`'s doc comment) decides real entry order.
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
      time: tx.time,
      timezone: tx.timezone,
      seq: tx.seq,
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
      time: t.time,
      timezone: t.timezone,
      seq: t.seq,
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
      time: a.time,
      timezone: a.timezone,
      seq: a.seq,
      kind: 'adjustment',
      action: a.amount >= 0 ? 'REWARD' : 'CORRECTION',
      label: a.note || (a.amount >= 0 ? 'Trading reward' : 'Adjustment'),
      amount: a.amount,
      fee: 0,
    });
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
