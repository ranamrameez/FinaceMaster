import type { Transaction } from '../../types/workbook';
import { toInstantMs } from '../datetime';

/** Chronological transaction order for every position/realized-P&L calc
 * function. Compares by real instant (Pending item 41: `time`/`timezone`
 * are optional per-record fields — see `lib/datetime.ts`), and falls back
 * to a BUY-before-SELL tiebreak when two records land on the exact same
 * instant, which is the common case for a record with no recorded time
 * (both default to the same noon-UTC placeholder) as well as a genuine
 * same-instant same-day pair. Plain `Array.prototype.sort`'s stability
 * would otherwise fall back to whatever order the transactions happen to
 * sit in the underlying array (entry order, not necessarily real trade
 * order), and a same-day SELL that lands before its matching BUY in that
 * array gets processed against a position that doesn't exist yet: the
 * running share count goes negative and gets clamped/dropped, so a same-day
 * round trip that should net out to a fully closed position instead shows
 * spurious open shares and a wrong realized P&L (the sale is treated as
 * pure profit with no cost basis). BUY-before-SELL on a tied instant is a
 * safe general fix, not a narrow hack: you can never legitimately sell
 * shares that don't exist yet without a same-day buy providing them first,
 * and for every other same-instant ordering (a sell against an already-open
 * position, followed by an unrelated same-day buy) the final share count
 * and invested total come out identical regardless of which order they're
 * summed in. */
export function sortTransactionsChronological<T extends Pick<Transaction, 'date' | 'action' | 'time' | 'timezone'>>(transactions: T[]): T[] {
  return [...transactions].sort((a, b) => {
    const byInstant = toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone);
    if (byInstant !== 0) return byInstant;
    if (a.action === b.action) return 0;
    return a.action === 'BUY' ? -1 : 1;
  });
}
