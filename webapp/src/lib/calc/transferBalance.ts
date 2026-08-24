import type { Transfer } from '../../types/workbook';

/** Running net-cash-contributed balance across a list of deposits/
 * withdrawals — user-reported gap: "no running balance column in the cash
 * transfers to know the balance." A deposit adds its gross amount minus its
 * fee (the fee is money that never reached the account); a withdrawal
 * subtracts its gross amount plus its fee (the fee is an extra cost on top
 * of what left the account). Sorted by date (stable for same-date ties, so
 * two transfers on the same day keep their original entry order) — this is
 * deliberately its OWN running total, not `cashSummary()`'s combined
 * trades+transfers+adjustments ledger, since the Transfers section is about
 * cash moved in/out of the account, not the account's total cash position
 * including trading activity. Returns a map keyed by `Transfer.id` so the
 * caller can look up a balance regardless of what order the table itself is
 * currently sorted/displayed in. */
export function transferRunningBalance(transfers: Transfer[]): Map<string, number> {
  const ordered = transfers
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.date.localeCompare(b.t.date) || a.i - b.i);
  const out = new Map<string, number>();
  let running = 0;
  for (const { t } of ordered) {
    running += t.type === 'DEPOSIT' ? t.gross - t.fee : -(t.gross + t.fee);
    out.set(t.id, running);
  }
  return out;
}
