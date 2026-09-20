import { createEmptyPlannedCreditCardWorkbook } from '../../store/defaultPlannedCreditCardWorkbook';
import { usePlannedCreditCardWorkbookStore } from '../../store/plannedCreditCardWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Same pattern as `usePlannedBankFirebaseSync.ts` — own cloud path
 * (`users/{uid}/plannedCreditCard`). */
export function usePlannedCreditCardFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('plannedCreditCard', usePlannedCreditCardWorkbookStore, user, createEmptyPlannedCreditCardWorkbook);
  return { user, authResolved, ...sync };
}
