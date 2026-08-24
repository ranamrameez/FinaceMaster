import { createEmptySubscriptionsWorkbook } from '../../store/defaultSubscriptionsWorkbook';
import { useSubscriptionsWorkbookStore } from '../../store/subscriptionsWorkbookStore';
import { useAuthState } from './useAuthState';
import { useWorkbookCloudSync } from './useWorkbookCloudSync';

/** Subscriptions' Firebase sync — same auth listener as every other module,
 * own cloud path (`users/{uid}/subscriptions`). */
export function useSubscriptionsFirebaseSync() {
  const { user, authResolved } = useAuthState();
  const sync = useWorkbookCloudSync('subscriptions', useSubscriptionsWorkbookStore, user, createEmptySubscriptionsWorkbook);
  return { user, authResolved, ...sync };
}
