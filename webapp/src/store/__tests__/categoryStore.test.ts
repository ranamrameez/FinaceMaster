import { beforeEach, describe, expect, it } from 'vitest';
import { useCategoryStore } from '../categoryStore';
import { createEmptyCategoriesWorkbook } from '../defaultCategoriesWorkbook';
import { DEFAULT_CATEGORY_IDS } from '../../lib/categories';

describe('categoryStore — app vs custom categories', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset to a known baseline before each test — the store only reads
    // localStorage once at module-init time, so clearing localStorage
    // alone wouldn't reset already-loaded in-memory state; setWorkbook
    // (which persists too) is the same reset mechanism a real "clear all
    // local data" flow already uses.
    useCategoryStore.getState().setWorkbook(createEmptyCategoriesWorkbook());
  });

  it('every bundled default category starts tagged scope: app', () => {
    const categories = useCategoryStore.getState().workbook.categories;
    const defaults = categories.filter((c) => DEFAULT_CATEGORY_IDS.has(c.id));
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults.every((c) => c.scope === 'app')).toBe(true);
  });

  it('addCategory tags a new category scope: custom', () => {
    const created = useCategoryStore.getState().addCategory('My Own Category');
    expect(created.scope).toBe('custom');
    const stored = useCategoryStore.getState().workbook.categories.find((c) => c.id === created.id);
    expect(stored?.scope).toBe('custom');
  });

  it('renameCategory refuses to rename an app-level category', () => {
    const before = useCategoryStore.getState().workbook.categories.find((c) => c.id === 'cat_grocery');
    useCategoryStore.getState().renameCategory('cat_grocery', 'Renamed!');
    const after = useCategoryStore.getState().workbook.categories.find((c) => c.id === 'cat_grocery');
    expect(after?.name).toBe(before?.name);
  });

  it('deleteCategory refuses to delete an app-level category', () => {
    useCategoryStore.getState().deleteCategory('cat_grocery');
    expect(useCategoryStore.getState().workbook.categories.some((c) => c.id === 'cat_grocery')).toBe(true);
  });

  it('renameCategory and deleteCategory work normally on a custom category', () => {
    const created = useCategoryStore.getState().addCategory('Temp Category');
    useCategoryStore.getState().renameCategory(created.id, 'Renamed Temp');
    expect(useCategoryStore.getState().workbook.categories.find((c) => c.id === created.id)?.name).toBe('Renamed Temp');
    useCategoryStore.getState().deleteCategory(created.id);
    expect(useCategoryStore.getState().workbook.categories.some((c) => c.id === created.id)).toBe(false);
  });

  it('normalize backfills scope on a raw category missing the field (pre-existing real data)', () => {
    useCategoryStore.getState().setWorkbook({
      categories: [
        { id: 'cat_grocery', serialNumber: 1, name: 'Grocery' } as any, // matches a default id, no scope
        { id: 'user-added-1', serialNumber: 99, name: 'Something I Added' } as any, // not a default id, no scope
      ],
    });
    const categories = useCategoryStore.getState().workbook.categories;
    expect(categories.find((c) => c.id === 'cat_grocery')?.scope).toBe('app');
    expect(categories.find((c) => c.id === 'user-added-1')?.scope).toBe('custom');
  });
});
