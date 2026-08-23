import { createEmptyPlannedCashWorkbook } from '../../store/defaultPlannedCashWorkbook';
import { usePlannedCashWorkbookStore } from '../../store/plannedCashWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Same pattern as `useCashFirebaseSync.ts` — own cloud path
 * (`users/{uid}/plannedCash`), same `useWorkbookCloudSync` safety
 * guarantees. */
export function usePlannedCashFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('plannedCash', usePlannedCashWorkbookStore, user, createEmptyPlannedCashWorkbook);
  return { user, authResolved, ...sync };
}
