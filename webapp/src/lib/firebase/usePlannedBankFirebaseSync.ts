import { createEmptyPlannedBankWorkbook } from '../../store/defaultPlannedBankWorkbook';
import { usePlannedBankWorkbookStore } from '../../store/plannedBankWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Same pattern as `usePlannedCashFirebaseSync.ts` — own cloud path
 * (`users/{uid}/plannedBank`). */
export function usePlannedBankFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('plannedBank', usePlannedBankWorkbookStore, user, createEmptyPlannedBankWorkbook);
  return { user, authResolved, ...sync };
}
