/** `Finance.serialNumber`'s own next/backfill pair — the RDBMS-identity-
 * column-style monotonic counter for the 3 modules that now extend
 * `Finance` (Cash/Bank/Rentals). Deliberately a small parallel copy of
 * `lib/seq.ts`'s `nextSeq`/`backfillSeq`, not a rename of that shared
 * utility in place: `seq` is still the correct field name for every
 * QSE/PSX/Funds/EMI/Personal-Loans record (out of scope for the Finance
 * migration, per the user's own "ignore the exchanges/funds/etc." scoping
 * decision), and `createEntryStore.ts`'s own generic factory hardcodes
 * `seq` for its 3 unrelated callers (Cash used to be one — see
 * `store/cashWorkbookStore.ts`'s own comment on why Cash was pulled out
 * of that factory once its sequence field became `serialNumber`). Renaming
 * `lib/seq.ts` itself would ripple into all of those untouched modules for
 * zero benefit; this file exists so Cash/Bank/Rentals get the exact same
 * "definitive persisted tie-breaker" guarantee under their own class's own
 * field name instead. See `lib/seq.ts`'s own doc comment for the full
 * reasoning behind the mechanism itself — identical here, just renamed. */
export function nextSerialNumber(existing: { serialNumber?: number }[]): number {
  return existing.reduce((max, r) => Math.max(max, r.serialNumber ?? 0), 0) + 1;
}

/** Same contract as `backfillSeq`: `records` is returned in its ORIGINAL
 * order with only the missing field filled in; `chronological` is the
 * caller's best-available chronological ordering, used purely to decide
 * WHICH numbers go to which not-yet-numbered record. */
export function backfillSerialNumber<T extends { serialNumber?: number }>(records: T[], chronological: T[]): T[] {
  if (records.every((r) => r.serialNumber !== undefined)) return records;
  const numberByRecord = new Map<T, number>();
  let counter = chronological.reduce((max, r) => Math.max(max, r.serialNumber ?? 0), 0);
  for (const r of chronological) {
    if (r.serialNumber === undefined) numberByRecord.set(r, ++counter);
  }
  return records.map((r) => (r.serialNumber !== undefined ? r : { ...r, serialNumber: numberByRecord.get(r) }));
}
