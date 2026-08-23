import { createEmptyWorkbook } from '../../store/defaultWorkbook';
import { useWorkbookStore } from '../../store/workbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** QSE's Firebase sync — composes the shared auth listener with the
 * generic per-exchange workbook sync (see useWorkbookCloudSync for the
 * safety guarantees around cloud writes). */
export function useFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('workbook', useWorkbookStore, user, createEmptyWorkbook);
  return { user, authResolved, ...sync };
}
