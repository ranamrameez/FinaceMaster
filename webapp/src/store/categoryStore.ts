import { create } from 'zustand';
import { toast } from '../components/Toast';
import { createEmptyCategoriesWorkbook } from './defaultCategoriesWorkbook';
import { DEFAULT_CATEGORY_IDS } from '../lib/categories';
import type { CategoriesWorkbook, Category } from '../types/finance';

const STORAGE_KEY = 'financerecorder_categories_v1';

/** Backfills `serialNumber` (the Category registry's own identity-column
 * equivalent — see `Finance.serialNumber`'s doc comment) onto any category
 * missing it, in array order — same idea as `backfillSeq` elsewhere, just
 * under this registry's own field name since a Category isn't dated.
 *
 * Also backfills `scope` (2026-09-09, see `Category`'s own doc comment):
 * an id matching a known `DEFAULT_CATEGORIES` entry is `'app'` (covers
 * every real pre-existing account, whose stored `categories` array
 * already includes copies of the defaults from before this field
 * existed — `createEmptyCategoriesWorkbook()` seeds with them); anything
 * else is a real user addition, tagged `'custom'`. */
function normalize(wb: CategoriesWorkbook): CategoriesWorkbook {
  let max = wb.categories.reduce((m, c) => Math.max(m, c.serialNumber ?? 0), 0);
  const categories = wb.categories.map((c) => {
    const withSerial = c.serialNumber !== undefined ? c : { ...c, serialNumber: ++max };
    if (withSerial.scope) return withSerial;
    return { ...withSerial, scope: DEFAULT_CATEGORY_IDS.has(withSerial.id) ? 'app' as const : 'custom' as const };
  });
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
      const category: Category = { id: crypto.randomUUID(), serialNumber: maxSerial + 1, name: trimmed, scope: 'custom' };
      mutate((w) => ({ ...w, categories: [...w.categories, category] }));
      return category;
    },

    // App-level categories (`scope: 'app'`) are shared, protected
    // reference data — see `Category`'s own doc comment. No UI calls
    // these on an app category today (only custom ones are ever
    // rename/delete-able from `CategorySelect`), but this guard is the
    // one place that stays true regardless of what future UI adds.
    renameCategory: (id, name) => {
      if (DEFAULT_CATEGORY_IDS.has(id)) return toast("App categories can't be renamed.");
      mutate((wb) => ({ ...wb, categories: wb.categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) }));
    },

    deleteCategory: (id) => {
      if (DEFAULT_CATEGORY_IDS.has(id)) return toast("App categories can't be deleted.");
      mutate((wb) => ({ ...wb, categories: wb.categories.filter((c) => c.id !== id) }));
    },
  };
});
