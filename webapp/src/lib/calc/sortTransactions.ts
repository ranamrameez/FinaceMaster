import type { Transaction } from '../../types/workbook';

/** Chronological transaction order for every position/realized-P&L calc
 * function. `Transaction` only stores a date (no time-of-day), so same-day
 * transactions need a tiebreak — plain `Array.prototype.sort`'s stability
 * would otherwise fall back to whatever order the transactions happen to
 * sit in the underlying array (entry order, not necessarily real trade
 * order), and a same-day SELL that lands before its matching BUY in that
 * array gets processed against a position that doesn't exist yet: the
 * running share count goes negative and gets clamped/dropped, so a same-day
 * round trip that should net out to a fully closed position instead shows
 * spurious open shares and a wrong realized P&L (the sale is treated as
 * pure profit with no cost basis). BUY-before-SELL on a tied date is a safe
 * general fix, not a narrow hack: you can never legitimately sell shares
 * that don't exist yet without a same-day buy providing them first, and for
 * every other same-day ordering (a sell against an already-open position,
 * followed by an unrelated same-day buy) the final share count and invested
 * total come out identical regardless of which order they're summed in. */
export function sortTransactionsChronological<T extends Pick<Transaction, 'date' | 'action'>>(transactions: T[]): T[] {
  return [...transactions].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    if (a.action === b.action) return 0;
    return a.action === 'BUY' ? -1 : 1;
  });
}
