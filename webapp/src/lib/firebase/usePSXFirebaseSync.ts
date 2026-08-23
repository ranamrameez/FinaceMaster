import { createEmptyPSXWorkbook } from '../../store/defaultPsxWorkbook';
import { usePSXWorkbookStore } from '../../store/psxWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** PSX's Firebase sync — same auth listener as QSE (one account, both
 * exchanges), different cloud path (`users/{uid}/psx`, matching the legacy
 * PSX app so existing users' data loads unchanged). */
export function usePSXFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('psx', usePSXWorkbookStore, user, createEmptyPSXWorkbook);
  return { user, authResolved, ...sync };
}
