import { createEmptyCreditCardWorkbook } from '../../store/defaultCreditCardWorkbook';
import { useCreditCardWorkbookStore } from '../../store/creditCardWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Credit Cards' Firebase sync — same auth listener as every other module,
 * own cloud path (`users/{uid}/creditCards`). */
export function useCreditCardFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('creditCards', useCreditCardWorkbookStore, user, createEmptyCreditCardWorkbook);
  return { user, authResolved, ...sync };
}
