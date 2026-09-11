import { useEffect } from 'react';
import { useFabActionsStore } from '../store/fabActionsStore';
import type { FabAction } from '../components/ui/Fab';

/** Registers this page's own FAB action(s), under a stable `key`, into the
 * shared `fabActionsStore`, so they render grouped into whatever `FabPanel`
 * is globally mounted for the current route (today: `CalculatorLauncher`
 * on Stock Exchanges routes, and `BankPage` on `/bank`) instead of a
 * second, separately-positioned fixed element fighting the first for the
 * same corner. Clears its own contribution (an empty array under the same
 * key) on unmount so a stale action never lingers once the component that
 * registered it is gone.
 *
 * `key` must be stable and, among components that can be mounted AT THE
 * SAME TIME, unique — two simultaneously-mounted callers sharing a key
 * would clobber each other exactly like the single-slot store this
 * replaced did (see that store's own doc comment). Components that are
 * mutually exclusive by route (e.g. QSE's and PSX's own Transactions
 * pages) can safely reuse the same key.
 *
 * `actions` should be referentially stable across renders (build it with
 * `useMemo`/`useState`, not inline) — this effect re-runs whenever the
 * array reference changes. */
export function usePageFabActions(key: string, actions: FabAction[]): void {
  const setActionsForKey = useFabActionsStore((s) => s.setActionsForKey);
  useEffect(() => {
    setActionsForKey(key, actions);
    return () => setActionsForKey(key, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, actions]);
}
