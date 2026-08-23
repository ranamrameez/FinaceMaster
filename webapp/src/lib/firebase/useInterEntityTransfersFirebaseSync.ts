import { createEmptyInterEntityWorkbook } from '../../store/defaultInterEntityWorkbook';
import { useInterEntityTransfersStore } from '../../store/interEntityTransfersStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Same auth listener and sync safety as every other module, own cloud
 * path (`users/{uid}/interEntityTransfers`). */
export function useInterEntityTransfersFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('interEntityTransfers', useInterEntityTransfersStore, user, createEmptyInterEntityWorkbook);
  return { user, authResolved, ...sync };
}
