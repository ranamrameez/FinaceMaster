import type { InterEntityWorkbook } from '../types/interEntityTransfer';

export function createEmptyInterEntityWorkbook(): InterEntityWorkbook {
  return { settings: {}, entries: [] };
}
