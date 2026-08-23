import { createEmptyBankWorkbook } from '../../store/defaultBankWorkbook';
import { useBankWorkbookStore } from '../../store/bankWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Banking's Firebase sync — same auth listener as every other module, own
 * cloud path (`users/{uid}/bank`). */
export function useBankFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('bank', useBankWorkbookStore, user, createEmptyBankWorkbook);
  return { user, authResolved, ...sync };
}
