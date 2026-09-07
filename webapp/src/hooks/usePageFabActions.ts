import { useEffect } from 'react';
import { useFabActionsStore } from '../store/fabActionsStore';
import type { FabAction } from '../components/ui/Fab';

/** Registers this page's own FAB action(s) into the shared
 * `fabActionsStore`, so they render grouped into whatever `FabPanel` is
 * globally mounted for the current route (today: `CalculatorLauncher` on
 * Stock Exchanges routes) instead of a second, separately-positioned
 * fixed element fighting the first for the same corner. Clears its own
 * contribution on unmount (route change) so a stale action never lingers
 * once the page that registered it is gone.
 *
 * `actions` should be referentially stable across renders (build it with
 * `useMemo`/`useState`, not inline) — this effect re-runs whenever the
 * array reference changes. */
export function usePageFabActions(actions: FabAction[]): void {
  const setExtraActions = useFabActionsStore((s) => s.setExtraActions);
  useEffect(() => {
    setExtraActions(actions);
    return () => setExtraActions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);
}
