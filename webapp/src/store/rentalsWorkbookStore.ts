import { create } from 'zustand';
import { createEmptyRentalsWorkbook } from './defaultRentalsWorkbook';
import type { Property, RentalEntry, RentalsWorkbook } from '../types/rentalsWorkbook';

const STORAGE_KEY = 'financerecorder_rentals_workbook_v1';

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
  updateEntry: (id: string, patch: Partial<RentalEntry>) => void;
  deleteEntry: (id: string) => void;
}

function loadFromLocalStorage(): RentalsWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...createEmptyRentalsWorkbook(), ...JSON.parse(raw) };
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
      set({ workbook: wb });
      if (!opts?.skipPersist) persist(wb);
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

    addEntry: (entry) => mutate((wb) => ({ ...wb, entries: [...wb.entries, entry] })),

    updateEntry: (id, patch) =>
      mutate((wb) => ({ ...wb, entries: wb.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

    deleteEntry: (id) => mutate((wb) => ({ ...wb, entries: wb.entries.filter((e) => e.id !== id) })),
  };
});
