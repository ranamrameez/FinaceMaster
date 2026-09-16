import type { CategoryGroupsWorkbook } from '../types/finance';

export function createEmptyCategoryGroupsWorkbook(): CategoryGroupsWorkbook {
  return { groups: [] };
}
