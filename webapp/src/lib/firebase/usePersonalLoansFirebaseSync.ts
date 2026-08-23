import { createEmptyPersonalLoansWorkbook } from '../../store/defaultPersonalLoansWorkbook';
import { usePersonalLoansWorkbookStore } from '../../store/personalLoansWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Personal Loans' Firebase sync — same auth listener as every other
 * module, own cloud path (`users/{uid}/personalLoans`). */
export function usePersonalLoansFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('personalLoans', usePersonalLoansWorkbookStore, user, createEmptyPersonalLoansWorkbook);
  return { user, authResolved, ...sync };
}
