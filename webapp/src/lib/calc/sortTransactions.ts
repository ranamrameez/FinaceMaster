import type { Transaction } from '../../types/workbook';
import { toInstantMs } from '../datetime';

/** Chronological transaction order for every position/realized-P&L calculation.
 * Real instant is primary. For exact ties, a persisted `seq` is authoritative
 * when BOTH records have one: it records the actual insertion order and must
 * not be overridden by the BUY/SELL action. Legacy records without `seq` keep
 * the defensive BUY-before-SELL fallback that prevents an empty-position
 * same-day round trip from becoming a zero-cost sale. */
export function sortTransactionsChronological<T extends Pick<Transaction, 'date' | 'action' | 'time' | 'timezone' | 'seq'>>(transactions: T[]): T[] {
  return [...transactions].sort((a, b) => {
    const byInstant = toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone);
    if (byInstant !== 0) return byInstant;

    if (a.seq !== undefined && b.seq !== undefined && a.seq !== b.seq) {
      return a.seq - b.seq;
    }

    if (a.action !== b.action) return a.action === 'BUY' ? -1 : 1;
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
}
