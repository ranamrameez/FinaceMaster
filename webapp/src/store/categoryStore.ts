import { create } from 'zustand';
import { createEmptyCategoriesWorkbook } from './defaultCategoriesWorkbook';
import type { CategoriesWorkbook, Category } from '../types/finance';

const STORAGE_KEY = 'financerecorder_categories_v1';

/** Backfills `serialNumber` (the Category registry's own identity-column
 * equivalent — see `Finance.serialNumber`'s doc comment) onto any category
 * missing it, in array order — same idea as `backfillSeq` elsewhere, just
 * under this registry's own field name since a Category isn't dated. */
function normalize(wb: CategoriesWorkbook): CategoriesWorkbook {
  let max = wb.categories.reduce((m, c) => Math.max(m, c.serialNumber ?? 0), 0);
  const categories = wb.categories.map((c) => (c.serialNumber !== undefined ? c : { ...c, serialNumber: ++max }));
  return { ...wb, categories };
}

interface CategoryStoreState {
  workbook: CategoriesWorkbook;
  setWorkbook: (wb: CategoriesWorkbook, opts?: { skipPersist?: boolean }) => void;
  addCategory: (name: string) => Category;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
}

function loadFromLocalStorage(): CategoriesWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyCategoriesWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load categories from localStorage', e);
  }
  return createEmptyCategoriesWorkbook();
}

function persist(workbook: CategoriesWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save categories to localStorage — your last change may not have persisted.', e);
  }
}

/** The shared Category registry every Finance-based record (Cash/Bank/
 * Rentals + their Planned* counterparts) points at via `categoryID` —
 * hand-written rather than `createEntryStore` since `Category` uses
 * `serialNumber`, not that factory's hardcoded `seq` field, and has no
 * per-module `settings` object to carry. Same `{workbook, setWorkbook}`
 * shape as every other store, so it satisfies `useWorkbookCloudSync`'s
 * `MinimalWorkbookStore` unchanged. */
export const useCategoryStore = create<CategoryStoreState>((set, get) => {
  const mutate = (updater: (wb: CategoriesWorkbook) => CategoriesWorkbook) => {
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

    addCategory: (name) => {
      const trimmed = name.trim();
      const wb = get().workbook;
      const maxSerial = wb.categories.reduce((m, c) => Math.max(m, c.serialNumber), 0);
      const category: Category = { id: crypto.randomUUID(), serialNumber: maxSerial + 1, name: trimmed };
      mutate((w) => ({ ...w, categories: [...w.categories, category] }));
      return category;
    },

    renameCategory: (id, name) =>
      mutate((wb) => ({ ...wb, categories: wb.categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) })),

    deleteCategory: (id) => mutate((wb) => ({ ...wb, categories: wb.categories.filter((c) => c.id !== id) })),
  };
});
