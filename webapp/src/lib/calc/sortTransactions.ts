import type { Transaction } from '../../types/workbook';
import { toInstantMs } from '../datetime';

/** Chronological transaction order for every position/realized-P&L calculation.
 * Real instant is primary. For an exact tie, BUY-before-SELL is a real
 * financial-correctness rule, not a preference, and must be checked BEFORE
 * `seq` — a same-day SELL can never legitimately precede the BUY that
 * supplies its shares (processing it first would hit an empty/insufficient
 * lot queue, corrupting FIFO matching and the oversell guard alike; see the
 * 2026-08-25 "same-day buy+sell of equal quantity showed spurious open
 * shares" incident this rule was originally added to fix). `seq` (a
 * persisted, monotonically-increasing per-record counter recording real
 * insertion order) only breaks a tie that BUY-before-SELL doesn't resolve
 * — i.e. two same-action records (two BUYs, or two SELLs) at the exact same
 * instant — never the other way around.
 *
 * Fixed 2026-09-18: a 2026-09-16 commit ("honor persisted transaction
 * sequence for exact-time ties") had inserted the `seq` check ABOVE this
 * one, so `seq` silently overrode BUY-before-SELL whenever the two differed
 * — which is almost always true for two records entered at different
 * times, meaning the defensive rule was effectively never exercised in
 * real usage. Caught by this file's own pre-existing test ("puts BUY
 * before SELL on an exact instant tie, regardless of seq"), which had been
 * silently failing since that commit — found while verifying an unrelated
 * change (a true per-lot cost-basis engine) that depends on this ordering
 * being correct. */
export function sortTransactionsChronological<T extends Pick<Transaction, 'date' | 'action' | 'time' | 'timezone' | 'seq'>>(transactions: T[]): T[] {
  return [...transactions].sort((a, b) => {
    const byInstant = toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone);
    if (byInstant !== 0) return byInstant;

    if (a.action !== b.action) return a.action === 'BUY' ? -1 : 1;

    if (a.seq !== undefined && b.seq !== undefined && a.seq !== b.seq) {
      return a.seq - b.seq;
    }
    return (a.seq ?? 0) - (b.seq ?? 0);
  });
}
