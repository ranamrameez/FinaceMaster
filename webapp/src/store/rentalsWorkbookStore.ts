import { create } from 'zustand';
import { toInstantMs } from '../lib/datetime';
import { backfillSeq, nextSeq } from '../lib/seq';
import { createEmptyRentalsWorkbook } from './defaultRentalsWorkbook';
import type { Property, RentalEntry, RentalsWorkbook } from '../types/rentalsWorkbook';

const STORAGE_KEY = 'financerecorder_rentals_workbook_v1';

/** Backfills `seq` (see `RentalEntry.seq`'s doc comment) onto any entry
 * missing it, in real-instant chronological order — same pattern as
 * `createWorkbookStore.ts`'s `normalize()`. Applied on every path data can
 * enter the store (local load and `setWorkbook`, which also covers the
 * Firebase pull in `useRentalsFirebaseSync`). */
function normalize(wb: RentalsWorkbook): RentalsWorkbook {
  const chronological = [...wb.entries].sort(
    (a, b) => toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone),
  );
  return { ...wb, entries: backfillSeq(wb.entries, chronological) };
}

/** Same shape as Banking (properties nested under settings, entries
 * top-level) — hand-written following the identical idiom (mutate/
 * persist/localStorage, `{workbook, setWorkbook}` satisfying
 * `useWorkbookCloudSync`'s `MinimalWorkbookStore`). See MODULES_PLAN.md
 * §4 and the zustand-selector rule in §6 (select raw state, derive in
 * useMemo, never inside the selector) — followed here throughout. */
interface RentalsStoreState {
  workbook: RentalsWorkbook;
  setWorkbook: (wb: RentalsWorkbook, opts?: { skipPersist?: boolean }) => void;
  addProperty: (property: Property) => void;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addEntry: (entry: RentalEntry) => void;
  addEntries: (entries: RentalEntry[]) => void;
  updateEntry: (id: string, patch: Partial<RentalEntry>) => void;
  deleteEntry: (id: string) => void;
}

function loadFromLocalStorage(): RentalsWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyRentalsWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load workbook from localStorage', e);
  }
  return createEmptyRentalsWorkbook();
}

function persist(workbook: RentalsWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save workbook to localStorage — your last change may not have persisted.', e);
  }
}

export const useRentalsWorkbookStore = create<RentalsStoreState>((set, get) => {
  const mutate = (updater: (wb: RentalsWorkbook) => RentalsWorkbook) => {
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

    addProperty: (property) =>
      mutate((wb) => ({ ...wb, settings: { ...wb.settings, properties: [...wb.settings.properties, property] } })),

    updateProperty: (id, patch) =>
      mutate((wb) => ({
        ...wb,
        settings: { ...wb.settings, properties: wb.settings.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)) },
      })),

    deleteProperty: (id) =>
      mutate((wb) => ({
        ...wb,
        settings: { ...wb.settings, properties: wb.settings.properties.filter((p) => p.id !== id) },
        entries: wb.entries.filter((e) => e.propertyId !== id),
      })),

    addEntry: (entry) =>
      mutate((wb) => ({ ...wb, entries: [...wb.entries, entry.seq !== undefined ? entry : { ...entry, seq: nextSeq(wb.entries) }] })),

    addEntries: (entries) =>
      mutate((wb) => {
        let seq = nextSeq(wb.entries) - 1;
        const withSeq = entries.map((e) => (e.seq !== undefined ? e : { ...e, seq: ++seq }));
        return { ...wb, entries: [...wb.entries, ...withSeq] };
      }),

    updateEntry: (id, patch) =>
      mutate((wb) => ({ ...wb, entries: wb.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

    deleteEntry: (id) => mutate((wb) => ({ ...wb, entries: wb.entries.filter((e) => e.id !== id) })),
  };
});
