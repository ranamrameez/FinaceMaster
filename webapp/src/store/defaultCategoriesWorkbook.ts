import { DEFAULT_CATEGORIES } from '../lib/categories';
import type { CategoriesWorkbook } from '../types/finance';

export function createEmptyCategoriesWorkbook(): CategoriesWorkbook {
  return { categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })) };
}
