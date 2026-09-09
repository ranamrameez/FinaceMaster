import type { Transfer } from '../../types/workbook';
import { dateOnlyMs } from '../datetime';

/** Running net-cash-contributed balance across a list of deposits/
 * withdrawals — user-reported gap: "no running balance column in the cash
 * transfers to know the balance." A deposit adds its gross amount minus its
 * fee (the fee is money that never reached the account); a withdrawal
 * subtracts its gross amount plus its fee (the fee is an extra cost on top
 * of what left the account). Sorted by calendar date, then by `seq` (a
 * stable, persisted per-transfer counter — see `Transaction.seq`'s doc
 * comment) on a same-date tie (Done item 235, extended 2026-09-08 to
 * same-date rather than same-instant — see `dateOnlyMs`'s own doc
 * comment), rather than relying on original array position — this is
 * deliberately its OWN running total, not `cashSummary()`'s combined
 * trades+transfers+adjustments ledger, since the Transfers section is
 * about cash moved in/out of the account, not the account's total cash
 * position including trading activity. Returns a map keyed by
 * `Transfer.id` so the caller can look up a balance regardless of what
 * order the table itself is currently sorted/displayed in. */
export function transferRunningBalance(transfers: Transfer[]): Map<string, number> {
  const ordered = transfers
    .map((t) => ({ t }))
    .sort((a, b) => dateOnlyMs(a.t.date) - dateOnlyMs(b.t.date) || (a.t.seq ?? 0) - (b.t.seq ?? 0));
  const out = new Map<string, number>();
  let running = 0;
  for (const { t } of ordered) {
    running += t.type === 'DEPOSIT' ? t.gross - t.fee : -(t.gross + t.fee);
    out.set(t.id, running);
  }
  return out;
}
