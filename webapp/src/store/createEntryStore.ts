import { create, type UseBoundStore, type StoreApi } from 'zustand';

export interface BaseEntryWorkbook<TSettings, TEntry extends { id: string }> {
  settings: TSettings;
  entries: TEntry[];
}

export interface EntryStoreState<TSettings, TEntry extends { id: string }> {
  workbook: BaseEntryWorkbook<TSettings, TEntry>;
  setWorkbook: (wb: BaseEntryWorkbook<TSettings, TEntry>, opts?: { skipPersist?: boolean }) => void;
  addEntry: (entry: TEntry) => void;
  /** Adds many entries in one persist/set cycle — for bulk operations like
   * CSV import, where calling `addEntry` in a loop would re-persist to
   * localStorage once per row. Mirrors `bankWorkbookStore.ts`'s
   * `addTransactions`. */
  addEntries: (entries: TEntry[]) => void;
  updateEntry: (id: string, patch: Partial<TEntry>) => void;
  deleteEntry: (id: string) => void;
  updateSettings: (patch: Partial<TSettings>) => void;
}

/** Assigns a stable id to any entry that's missing one — real user data
 * written before an entry type carried `id` (e.g. Cash, before README item
 * 19's cross-entity linking needed one) won't have it in storage, and JSON
 * parsing doesn't enforce the TypeScript type. Applied on every path data
 * can enter the store (local load and setWorkbook, which also covers the
 * Firebase pull in useWorkbookCloudSync) so callers can always rely on
 * `entry.id` existing. */
function ensureIds<T extends { id?: string }>(items: T[]): (T & { id: string })[] {
  return items.map((item) => (item.id ? (item as T & { id: string }) : { ...item, id: crypto.randomUUID() }));
}

/** Backfills `seq` (see `lib/seq.ts`) onto any entry missing it, in
 * ARRAY order — this generic factory has no structural guarantee its
 * `TEntry` carries a `date` field to sort by first (some instantiations,
 * like the inter-entity-transfer links store, genuinely don't), so unlike
 * `createWorkbookStore.ts`'s date-aware backfill this uses plain array
 * position as the best-available chronological guess for pre-existing
 * data — no worse than what every sort relying on array-stability was
 * already implicitly assuming before this field existed, and strictly
 * more robust going forward once every new entry gets a real `seq`. */
function ensureSeq<T extends { seq?: number }>(items: T[]): T[] {
  let seq = items.reduce((max, r) => Math.max(max, r.seq ?? 0), 0);
  return items.map((item) => (item.seq !== undefined ? item : { ...item, seq: ++seq }));
}

/** Same "one more than the highest existing seq" rule as `lib/seq.ts`'s
 * `nextSeq`, duplicated locally so the generic `TEntry` here (unconstrained
 * on `seq`) doesn't need a structural-typing cast at every call site. */
function nextSeqOf(entries: { seq?: number }[]): number {
  return entries.reduce((max, r) => Math.max(max, r.seq ?? 0), 0) + 1;
}

/** Generic store factory for simple modules that are just "a settings
 * object plus one array of editable, dated entries" — Cash, EMI/Loans, and
 * similar. `createWorkbookStore` covers the stock-exchange shape
 * (transactions/transfers/watchlist/...); forcing a module like Cash
 * through that shape would mean carrying a pile of irrelevant empty arrays
 * just to satisfy the type, which isn't real reuse. This factory shares
 * the same local-first, cloud-sync-compatible design (see
 * `useWorkbookCloudSync`'s `MinimalWorkbookStore` — this store's shape
 * satisfies it structurally) without forcing the stock-specific fields. */
export function createEntryStore<TSettings, TEntry extends { id: string }>(
  storageKey: string,
  createEmpty: () => BaseEntryWorkbook<TSettings, TEntry>,
): UseBoundStore<StoreApi<EntryStoreState<TSettings, TEntry>>> {
  function normalize(wb: BaseEntryWorkbook<TSettings, TEntry>): BaseEntryWorkbook<TSettings, TEntry> {
    const withIds = ensureIds(wb.entries);
    return { ...wb, entries: ensureSeq(withIds as unknown as { seq?: number }[]) as unknown as TEntry[] };
  }

  function loadFromLocalStorage(): BaseEntryWorkbook<TSettings, TEntry> {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return normalize({ ...createEmpty(), ...JSON.parse(raw) });
    } catch (e) {
      console.warn(`Failed to load workbook from localStorage (${storageKey})`, e);
    }
    return createEmpty();
  }

  function persist(workbook: BaseEntryWorkbook<TSettings, TEntry>) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(workbook));
    } catch (e) {
      console.error(`Failed to save workbook to localStorage (${storageKey}) — your last change may not have persisted.`, e);
    }
  }

  return create<EntryStoreState<TSettings, TEntry>>((set, get) => {
    const mutate = (updater: (wb: BaseEntryWorkbook<TSettings, TEntry>) => BaseEntryWorkbook<TSettings, TEntry>) => {
      const next = updater(get().workbook);
      set({ workbook: next });
      persist(next);
    };

    return {
      workbook: loadFromLocalStorage(),

      setWorkbook: (wb, opts) => {
        const next = normalize(wb);
        set({ workbook: next });
        if (!opts?.skipPersist) persist(next);
      },

      addEntry: (entry) =>
        mutate((wb) => {
          const seqed = entry as TEntry & { seq?: number };
          const withSeq = seqed.seq !== undefined ? entry : ({ ...entry, seq: nextSeqOf(wb.entries as unknown as { seq?: number }[]) } as TEntry);
          return { ...wb, entries: [...wb.entries, withSeq] };
        }),

      addEntries: (entries) =>
        mutate((wb) => {
          let seq = nextSeqOf(wb.entries as unknown as { seq?: number }[]) - 1;
          const withSeq = entries.map((e) => {
            const seqed = e as TEntry & { seq?: number };
            return seqed.seq !== undefined ? e : ({ ...e, seq: ++seq } as TEntry);
          });
          return { ...wb, entries: [...wb.entries, ...withSeq] };
        }),

      updateEntry: (id, patch) =>
        mutate((wb) => ({
          ...wb,
          entries: wb.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteEntry: (id) => mutate((wb) => ({ ...wb, entries: wb.entries.filter((e) => e.id !== id) })),

      updateSettings: (patch) =>
        mutate((wb) => ({ ...wb, settings: { ...(wb.settings as object), ...patch } as TSettings })),
    };
  });
}
