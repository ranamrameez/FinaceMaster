import { createEmptyFundsWorkbook } from '../../store/defaultFundsWorkbook';
import { useFundsWorkbookStore } from '../../store/fundsWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Funds' Firebase sync — same auth listener as every other module, own
 * cloud path (`users/{uid}/funds`). */
export function useFundsFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('funds', useFundsWorkbookStore, user, createEmptyFundsWorkbook);
  return { user, authResolved, ...sync };
}
