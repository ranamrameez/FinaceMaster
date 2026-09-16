import { create } from 'zustand';
import { toast } from '../components/Toast';
import { createEmptyCategoryGroupsWorkbook } from './defaultCategoryGroupsWorkbook';
import type { CategoryGroup, CategoryGroupsWorkbook } from '../types/finance';

const STORAGE_KEY = 'financerecorder_category_groups_v1';

/** Backfills `serialNumber` onto any group missing it, same idiom as
 * `categoryStore.ts`'s own `normalize()`. */
function normalize(wb: CategoryGroupsWorkbook): CategoryGroupsWorkbook {
  let max = wb.groups.reduce((m, g) => Math.max(m, g.serialNumber ?? 0), 0);
  const groups = wb.groups.map((g) => (g.serialNumber !== undefined ? g : { ...g, serialNumber: ++max }));
  return { ...wb, groups };
}

interface CategoryGroupStoreState {
  workbook: CategoryGroupsWorkbook;
  setWorkbook: (wb: CategoryGroupsWorkbook, opts?: { skipPersist?: boolean }) => void;
  addGroup: (name: string) => CategoryGroup;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  setGroupCategories: (id: string, categoryIds: string[]) => void;
}

function loadFromLocalStorage(): CategoryGroupsWorkbook {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize({ ...createEmptyCategoryGroupsWorkbook(), ...JSON.parse(raw) });
  } catch (e) {
    console.warn('Failed to load category groups from localStorage', e);
  }
  return createEmptyCategoryGroupsWorkbook();
}

function persist(workbook: CategoryGroupsWorkbook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
  } catch (e) {
    console.error('Failed to save category groups to localStorage — your last change may not have persisted.', e);
  }
}

/** User-configurable named buckets over the Category registry (README
 * Pending item 5 / `CategoryGroup`'s own doc comment in `types/finance.ts`
 * for the full "bird's-eye view" feature this backs) — hand-written, same
 * idiom as `categoryStore.ts`, its own sibling registry: `{workbook,
 * setWorkbook}` shape satisfies `useWorkbookCloudSync`'s
 * `MinimalWorkbookStore` unchanged. Deliberately a SEPARATE store/Firebase
 * path from `categoryStore.ts` rather than folding `categoryIds` onto
 * `Category` itself — a group is its own named entity (rename/delete
 * independent of any category), not an attribute of one category. */
export const useCategoryGroupStore = create<CategoryGroupStoreState>((set, get) => {
  const mutate = (updater: (wb: CategoryGroupsWorkbook) => CategoryGroupsWorkbook) => {
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

    addGroup: (name) => {
      const trimmed = name.trim();
      const wb = get().workbook;
      const maxSerial = wb.groups.reduce((m, g) => Math.max(m, g.serialNumber), 0);
      const group: CategoryGroup = { id: crypto.randomUUID(), serialNumber: maxSerial + 1, name: trimmed, categoryIds: [] };
      mutate((w) => ({ ...w, groups: [...w.groups, group] }));
      return group;
    },

    renameGroup: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return toast('Group name cannot be empty.');
      mutate((wb) => ({ ...wb, groups: wb.groups.map((g) => (g.id === id ? { ...g, name: trimmed } : g)) }));
    },

    deleteGroup: (id) => {
      mutate((wb) => ({ ...wb, groups: wb.groups.filter((g) => g.id !== id) }));
    },

    setGroupCategories: (id, categoryIds) => {
      mutate((wb) => ({ ...wb, groups: wb.groups.map((g) => (g.id === id ? { ...g, categoryIds } : g)) }));
    },
  };
});
