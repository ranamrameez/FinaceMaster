import { createEmptyCategoriesWorkbook } from '../../store/defaultCategoriesWorkbook';
import { useCategoryStore } from '../../store/categoryStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Category registry's Firebase sync — same auth listener as every other
 * module, own cloud path (`users/{uid}/categories`). */
export function useCategoryFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('categories', useCategoryStore, user, createEmptyCategoriesWorkbook);
  return { user, authResolved, ...sync };
}
