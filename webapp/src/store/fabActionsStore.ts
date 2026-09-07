import { create } from 'zustand';
import type { FabAction } from '../components/ui/Fab';

/** A tiny, never-persisted registry a page can push its own FAB actions
 * into, so a globally-mounted FAB (the Trade Calculator, on Stock
 * Exchanges routes) and a page-local one (e.g. Transactions' own
 * "Transfers" action) combine into ONE grouped `FabPanel` instead of two
 * separate `position:fixed` elements fighting for the same corner.
 *
 * User-reported (2026-09-07): "Trade Calc FAB overlapping/Blocking other
 * Fabs instead of grouping" — `CalculatorLauncher.tsx` and QSE's/PSX's own
 * page-level Transfers `FabPanel` (README Done item 219) were both
 * independently mounted `position:fixed` elements at the identical
 * `right:24/bottom:24` corner, since `CalculatorLauncher` was never wired
 * into the same grouping mechanism `FabPanel` itself was built for. Use
 * `usePageFabActions()` (the paired hook) from a page rather than writing
 * to this store directly. */
export const useFabActionsStore = create<{
  extraActions: FabAction[];
  setExtraActions: (actions: FabAction[]) => void;
}>((set) => ({
  extraActions: [],
  setExtraActions: (extraActions) => set({ extraActions }),
}));
