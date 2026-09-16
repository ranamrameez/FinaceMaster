import { createEmptyCategoryGroupsWorkbook } from '../../store/defaultCategoryGroupsWorkbook';
import { useCategoryGroupStore } from '../../store/categoryGroupStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Category groups' Firebase sync — same auth listener as every other
 * module, own cloud path (`users/{uid}/categoryGroups`), same "no
 * dedicated status UI, just run the sync" treatment `useCategoryFirebaseSync`
 * already gets. */
export function useCategoryGroupFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('categoryGroups', useCategoryGroupStore, user, createEmptyCategoryGroupsWorkbook);
  return { user, authResolved, ...sync };
}
