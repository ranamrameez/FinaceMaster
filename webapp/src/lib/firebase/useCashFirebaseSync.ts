import { createEmptyCashWorkbook } from '../../store/defaultCashWorkbook';
import { useCashWorkbookStore } from '../../store/cashWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Cash's Firebase sync — same auth listener as QSE/PSX (one account, all
 * modules), own cloud path (`users/{uid}/cash`). Reuses the same
 * `useWorkbookCloudSync` safety guarantees as every other module. */
export function useCashFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('cash', useCashWorkbookStore, user, createEmptyCashWorkbook);
  return { user, authResolved, ...sync };
}
