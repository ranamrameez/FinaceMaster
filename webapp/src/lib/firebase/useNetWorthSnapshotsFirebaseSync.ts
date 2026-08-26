import { createEmptyNetWorthSnapshotsWorkbook } from '../../store/defaultNetWorthSnapshotsWorkbook';
import { useNetWorthSnapshotsWorkbookStore } from '../../store/netWorthSnapshotsWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Net Worth snapshots' Firebase sync — same auth listener as every other
 * module, own cloud path (`users/{uid}/netWorthSnapshots`), kept separate
 * from every module's own workbook (see `types/netWorthSnapshot.ts`'s doc
 * comment) so this carries zero migration risk to real data. */
export function useNetWorthSnapshotsFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('netWorthSnapshots', useNetWorthSnapshotsWorkbookStore, user, createEmptyNetWorthSnapshotsWorkbook);
  return { user, authResolved, ...sync };
}
