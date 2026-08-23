import { createEmptyRentalsWorkbook } from '../../store/defaultRentalsWorkbook';
import { useRentalsWorkbookStore } from '../../store/rentalsWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Rentals' Firebase sync — same auth listener as every other module, own
 * cloud path (`users/{uid}/rentals`). */
export function useRentalsFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('rentals', useRentalsWorkbookStore, user, createEmptyRentalsWorkbook);
  return { user, authResolved, ...sync };
}
