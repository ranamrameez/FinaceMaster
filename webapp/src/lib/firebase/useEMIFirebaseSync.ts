import { createEmptyEMIWorkbook } from '../../store/defaultEmiWorkbook';
import { useEMIWorkbookStore } from '../../store/emiWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** EMI/Loans' Firebase sync — same auth listener as every other module,
 * own cloud path (`users/{uid}/emiLoans`). */
export function useEMIFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('emiLoans', useEMIWorkbookStore, user, createEmptyEMIWorkbook);
  return { user, authResolved, ...sync };
}
