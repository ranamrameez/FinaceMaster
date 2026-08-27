/** Computes the next sequence number for a new record being added to
 * `existing` — the definitive, persisted tie-breaker for chronological
 * ordering when two records land on the exact same instant (the common
 * case for an untimed record, which defaults to a fixed noon-UTC
 * placeholder — see `lib/datetime.ts`).
 *
 * User-reported (2026-08-27): relying on `Array.prototype.sort`'s
 * stability (falling through to whatever order records happen to sit in
 * the underlying array) is a fragile, implicit signal — it silently
 * breaks the moment a record is deleted and re-added, reordered by an
 * import, or merged from a different source, since none of those
 * preserve "the order a human actually entered the data in." `seq` is a
 * stable property of the record itself, immune to all of that: it's
 * assigned once, at creation, and never recomputed from the record's
 * current position.
 *
 * Scoped per-array (not one global counter per workbook) — every
 * chronological sort in this app only ever compares `seq` between
 * records drawn from the SAME array (e.g. `sortTransactionsChronological`
 * only sorts `transactions`); the one function that merges multiple
 * record types into one timeline (`buildCashLedger`) already resolves a
 * cross-type tie via its own domain rule (transfers before trades)
 * BEFORE it would ever need to compare `seq` values from two different
 * arrays, so per-array scoping is sufficient and avoids needing a single
 * persisted counter field threaded through every workbook shape. */
export function nextSeq(existing: { seq?: number }[]): number {
  return existing.reduce((max, r) => Math.max(max, r.seq ?? 0), 0) + 1;
}

/** Backfills `seq` onto every record in `records` that's missing it —
 * real data written before this field existed has none in storage, and
 * JSON parsing doesn't enforce the TypeScript type. `records` should be
 * pre-sorted by the caller into the best chronological order already
 * available (date/time, falling back to original array position) so a
 * real user's existing history gets a `seq` that matches what they'd
 * expect, not raw insertion order (which, for imported or merged data,
 * may not reflect true chronological order at all). Only fills in the
 * missing field — a record that already carries a `seq` is returned
 * unchanged, and the ORIGINAL array order (not the sorted order used to
 * assign numbers) is preserved in the result, since this must not
 * silently reorder a workbook's stored arrays as a side effect of
 * loading them. */
export function backfillSeq<T extends { seq?: number }>(records: T[], chronological: T[]): T[] {
  if (records.every((r) => r.seq !== undefined)) return records;
  const seqByRecord = new Map<T, number>();
  let counter = chronological.reduce((max, r) => Math.max(max, r.seq ?? 0), 0);
  for (const r of chronological) {
    if (r.seq === undefined) seqByRecord.set(r, ++counter);
  }
  return records.map((r) => (r.seq !== undefined ? r : { ...r, seq: seqByRecord.get(r) }));
}
