/** User-reported (2026-09-06): "if some transaction is missed and logged
 * later, it is/will cause problem. some interactive option should be
 * there to drag the transactions up or down to correct their order and
 * update the ids according to new order to find the correct account
 * balance at a given time."
 *
 * The scenario: a transaction dated the same day as another one already
 * on record gets logged later, and its INSERTION order — not its real
 * chronological order — is all `seq`/`serialNumber` (the app's own
 * "definitive persisted tie-breaker," see `lib/seq.ts`'s own doc comment)
 * has to go on once two records land on the exact same real instant. The
 * final cumulative balance is always correct regardless of same-day order
 * (addition is commutative), but the INTERMEDIATE per-row running balance
 * shown for that day can look wrong/misleading if the two same-day rows
 * are in the wrong relative order.
 *
 * Confirmed with the user before building (`AskUserQuestion`): reordering
 * is up/down move buttons (not drag-and-drop), and it must NEVER touch a
 * record's own `id` — every cross-entity link references records by `id`
 * (`InterEntityTransfer.fromRecordId`/`toRecordId`, `TradePlanLeg.
 * executedTransactionId`), so `id` has to stay a stable primary key. What
 * DOES change is exactly the field "meant to track order" — `seq` for
 * QSE/PSX/Funds/EMI/Personal Loans (`lib/seq.ts`) or `serialNumber` for
 * Cash/Bank/Rentals (`lib/financeSerial.ts`), whichever the record type
 * already uses (every relevant type already has one, per Done items
 * 212/227 — nothing new needed there). This module is deliberately
 * FIELD-NAME-AGNOSTIC (`idOf`/`orderOf` getters, not a hardcoded `.id`/
 * `.seq` property) so one shared implementation covers both field names
 * without either module having to rename its own field to match the
 * other's convention.
 *
 * Moving a row swaps its order value with the ADJACENT tied row's — a
 * pure, minimal operation that can't affect anything outside the two rows
 * being swapped, and needs no new field.
 *
 * Deliberately scoped to ADJACENT rows within the same tie group (rows
 * whose `instantOf` value is EXACTLY equal) — a row that's genuinely on a
 * different real date never needs reordering against a tied neighbor:
 * date already places it correctly. Reordering across a date boundary
 * isn't offered at all (the move buttons simply don't render past the
 * edge of a tie group) — there's nothing ambiguous left to fix there.
 * `instantOf` itself is caller-supplied and generic — every current
 * caller passes `dateOnlyMs(date)` (Done item 235, extended 2026-09-08
 * from same-instant to same-CALENDAR-DATE — see that function's own doc
 * comment for why), not a real instant despite the parameter's name; the
 * function itself only ever compares whatever number `instantOf` returns
 * for exact equality, so it works identically either way.
 *
 * `rows` must already be sorted into the table's real display order
 * (instant, then current order value — i.e. whatever
 * `accountRunningLedger`/`buildCashLedger`/etc. already produce), NEWEST
 * FIRST OR OLDEST FIRST — either works, `canMoveInTie`/`moveInTie` always
 * mean "swap with the array's previous/next element," which is
 * direction-agnostic by construction. */

function tie<T>(rows: T[], i: number, j: number, instantOf: (r: T) => number): boolean {
  return i >= 0 && j >= 0 && i < rows.length && j < rows.length && instantOf(rows[i]) === instantOf(rows[j]);
}

export function canMoveInTie<T>(rows: T[], index: number, direction: 'up' | 'down', instantOf: (r: T) => number): boolean {
  const other = direction === 'up' ? index - 1 : index + 1;
  return tie(rows, index, other, instantOf);
}

/** Returns the `{id, order}` pair to write back (via each module's own
 * `updateX(id, patch)` action, mapping `order` to whichever real field
 * name that module uses — this function has no store access itself, it's
 * pure), or `null` if the move isn't valid (not part of a tie, or at the
 * edge of the array). The two rows' order values are swapped outright —
 * if either is `undefined` (an old, pre-`seq`/`serialNumber` record that
 * was never backfilled), it's treated as `0` so the swap still produces a
 * real, ordered pair instead of leaving one side `undefined`. */
export function moveInTie<T>(
  rows: T[],
  index: number,
  direction: 'up' | 'down',
  instantOf: (r: T) => number,
  idOf: (r: T) => string,
  orderOf: (r: T) => number | undefined,
): [{ id: string; order: number }, { id: string; order: number }] | null {
  const other = direction === 'up' ? index - 1 : index + 1;
  if (!tie(rows, index, other, instantOf)) return null;
  const a = rows[index];
  const b = rows[other];
  return [
    { id: idOf(a), order: orderOf(b) ?? 0 },
    { id: idOf(b), order: orderOf(a) ?? 0 },
  ];
}
