import { create, type UseBoundStore, type StoreApi } from 'zustand';

export interface BaseEntryWorkbook<TSettings, TEntry> {
  settings: TSettings;
  entries: TEntry[];
}

export interface EntryStoreState<TWorkbook extends BaseEntryWorkbook<unknown, unknown>> {
  workbook: TWorkbook;
  setWorkbook: (wb: TWorkbook, opts?: { skipPersist?: boolean }) => void;
  addEntry: (entry: TWorkbook['entries'][number]) => void;
  updateEntry: (index: number, patch: Partial<TWorkbook['entries'][number]>) => void;
  deleteEntry: (index: number) => void;
  updateSettings: (patch: Partial<TWorkbook['settings']>) => void;
}

/** Generic store factory for simple modules that are just "a settings
 * object plus one array of editable, dated entries" — Cash, Personal
 * Loans, and similar. `createWorkbookStore` covers the stock-exchange
 * shape (transactions/transfers/watchlist/...); forcing a module like Cash
 * through that shape would mean carrying a pile of irrelevant empty arrays
 * just to satisfy the type, which isn't real reuse. This factory shares
 * the same local-first, cloud-sync-compatible design (see
 * `useWorkbookCloudSync`'s `MinimalWorkbookStore` — this store's shape
 * satisfies it structurally) without forcing the stock-specific fields. */
export function createEntryStore<TWorkbook extends BaseEntryWorkbook<unknown, unknown>>(
  storageKey: string,
  createEmpty: () => TWorkbook,
): UseBoundStore<StoreApi<EntryStoreState<TWorkbook>>> {
  function loadFromLocalStorage(): TWorkbook {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...createEmpty(), ...JSON.parse(raw) };
    } catch (e) {
      console.warn(`Failed to load workbook from localStorage (${storageKey})`, e);
    }
    return createEmpty();
  }

  function persist(workbook: TWorkbook) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(workbook));
    } catch (e) {
      console.error(`Failed to save workbook to localStorage (${storageKey}) — your last change may not have persisted.`, e);
    }
  }

  return create<EntryStoreState<TWorkbook>>((set, get) => {
    const mutate = (updater: (wb: TWorkbook) => TWorkbook) => {
      const next = updater(get().workbook);
      set({ workbook: next });
      persist(next);
    };

    return {
      workbook: loadFromLocalStorage(),

      setWorkbook: (wb, opts) => {
        set({ workbook: wb });
        if (!opts?.skipPersist) persist(wb);
      },

      addEntry: (entry) => mutate((wb) => ({ ...wb, entries: [...wb.entries, entry] })),

      updateEntry: (index, patch) =>
        mutate((wb) => ({
          ...wb,
          entries: wb.entries.map((e, i) => (i === index ? { ...(e as object), ...patch } : e)),
        })),

      deleteEntry: (index) => mutate((wb) => ({ ...wb, entries: wb.entries.filter((_, i) => i !== index) })),

      updateSettings: (patch) =>
        mutate((wb) => ({ ...wb, settings: { ...(wb.settings as object), ...patch } as TWorkbook['settings'] })),
    };
  });
}
