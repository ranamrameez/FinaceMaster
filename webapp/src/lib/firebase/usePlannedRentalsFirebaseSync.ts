import { createEmptyPlannedRentalsWorkbook } from '../../store/defaultPlannedRentalsWorkbook';
import { usePlannedRentalsWorkbookStore } from '../../store/plannedRentalsWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Same pattern as `usePlannedBankFirebaseSync.ts` — own cloud path
 * (`users/{uid}/plannedRentals`). */
export function usePlannedRentalsFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('plannedRentals', usePlannedRentalsWorkbookStore, user, createEmptyPlannedRentalsWorkbook);
  return { user, authResolved, ...sync };
}
