import { create, type UseBoundStore, type StoreApi } from 'zustand';

export interface BaseEntryWorkbook<TSettings, TEntry extends { id: string }> {
  settings: TSettings;
  entries: TEntry[];
}

export interface EntryStoreState<TSettings, TEntry extends { id: string }> {
  workbook: BaseEntryWorkbook<TSettings, TEntry>;
  setWorkbook: (wb: BaseEntryWorkbook<TSettings, TEntry>, opts?: { skipPersist?: boolean }) => void;
  addEntry: (entry: TEntry) => void;
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
    return { ...wb, entries: ensureIds(wb.entries) };
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

      addEntry: (entry) => mutate((wb) => ({ ...wb, entries: [...wb.entries, entry] })),

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
