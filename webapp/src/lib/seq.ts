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
 * `existing` should already be the set this new record's number is scoped
 * against — a plain `nextSeq(wb.transfers)`/`nextSeq(wb.adjustments)` for
 * a record type with no natural owning entity, or `nextSeqForEntity`
 * below for one that has one (a ticker, an account, a loan). Call this
 * directly (not through `nextSeqForEntity`) only when there's genuinely no
 * narrower scope to filter to. */
export function nextSeq(existing: { seq?: number }[]): number {
  return existing.reduce((max, r) => Math.max(max, r.seq ?? 0), 0) + 1;
}

/** User-reported (2026-09-03): "ID sequence should belong to each entity
 * rather than global which is confusing (like some records are missing)."
 * Before this, `nextSeq` was always called with the FULL per-workbook
 * array (e.g. every ticker's transactions combined) — so looking at just
 * one entity's own records (one stock's trades, one fund's transactions)
 * showed gaps wherever a DIFFERENT entity's record had consumed an
 * intervening number, reading exactly like data loss even though nothing
 * was actually missing. This filters `existing` down to the same entity
 * (via `keyOf`) before computing the next number, so each entity's own
 * records are numbered 1, 2, 3... independently of every other entity's.
 *
 * Safe for the calc engine: every position/realized-P&L function keys its
 * own running state per entity already (`computePositions`'s `byTicker`,
 * etc.), so cross-entity `seq` values never need to compare against each
 * other for correctness — only within the same entity, where they're still
 * exactly as unique and monotonic as before. The one place two different
 * entities' `seq` values CAN end up compared is `buildCashLedger`'s merged
 * running-balance display, on the narrow case of two same-instant trades
 * on DIFFERENT tickers with no recorded time — there, a same-value `seq`
 * collision (e.g. both tickers' first-ever trade both being `seq: 1`) can
 * only affect which of the two rows the ledger *displays* first at that
 * exact tie; the running balance total afterward is identical either way,
 * same as any other same-instant ordering already was.
 *
 * Existing already-`seq`'d records are never renumbered by this change —
 * `seq` is written once at creation and never recomputed, so this only
 * changes what number a NEWLY added record gets, with zero migration risk
 * to already-synced production data. */
export function nextSeqForEntity<T extends { seq?: number }>(existing: T[], keyOf: (r: T) => string, key: string): number {
  return nextSeq(existing.filter((r) => keyOf(r) === key));
}

/** Bulk counterpart to `nextSeqForEntity`, for an "add several records at
 * once" action (a CSV/statement import, etc.) whose batch can span more
 * than one entity — a batch importing trades for two different tickers
 * numbers each ticker's own new rows independently (1, 2, 3... per
 * ticker), not across the whole batch. Records that already carry a `seq`
 * (e.g. re-saving something already numbered) are left untouched. */
export function assignSeqForEntities<T extends { seq?: number }>(existing: T[], newRecords: T[], keyOf: (r: T) => string): T[] {
  const counters = new Map<string, number>();
  return newRecords.map((r) => {
    if (r.seq !== undefined) return r;
    const key = keyOf(r);
    if (!counters.has(key)) counters.set(key, nextSeqForEntity(existing, keyOf, key) - 1);
    const next = counters.get(key)! + 1;
    counters.set(key, next);
    return { ...r, seq: next };
  });
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
