/** README Pending item 64 / MODULES_PLAN.md's "needs a real design pass"
 * net-worth-over-time feature. Net worth is always computed LIVE from every
 * module's current data — nothing about it was ever logged over time, so a
 * history chart needs an explicit snapshot mechanism. Design decisions
 * locked for v1 (documented here since the Pending item that named them as
 * open questions is now closed by this file existing):
 * - Snapshot cadence: on-demand only, via a "Save snapshot" button on the
 *   Net Worth page — never automatic on page load, which would silently
 *   spam a snapshot per visit.
 * - Storage: its own Firebase node (`users/{uid}/netWorthSnapshots`), same
 *   pattern as every other simple entry-store module (Cash/EMI/etc.) — kept
 *   separate from every module's own workbook so this carries zero
 *   migration risk to real data.
 * - What happens when underlying data later changes: NOTHING — a snapshot
 *   is a frozen point-in-time copy, `byCurrency` is captured once at save
 *   time and never recomputed retroactively. Entering a backdated
 *   transaction after the fact does not rewrite a past snapshot; the next
 *   "Save snapshot" click captures the new current state as a NEW entry
 *   (or overwrites today's own entry if one already exists for today — see
 *   `upsertTodaySnapshot` in `NetWorthPage.tsx`). */
export interface NetWorthSnapshot {
  id: string;
  /** The calendar day this snapshot represents, "YYYY-MM-DD". */
  date: string;
  /** Net worth per currency at the moment this snapshot was saved — the
   * same shape `computeNetWorthByCurrency`'s rows reduce to
   * (`{ [currency]: net }`), with no assets/liabilities/breakdown detail
   * kept (that level of detail isn't needed for a trend line, and keeping
   * it would make every snapshot far heavier for no benefit). */
  byCurrency: Record<string, number>;
}

export type NetWorthSnapshotsSettings = Record<string, never>;

export interface NetWorthSnapshotsWorkbook {
  settings: NetWorthSnapshotsSettings;
  entries: NetWorthSnapshot[];
}
