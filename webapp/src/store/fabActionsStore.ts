import { create } from 'zustand';
import type { FabAction } from '../components/ui/Fab';

/** A tiny, never-persisted registry pages can push their own FAB actions
 * into, so a globally-mounted FAB (the Trade Calculator, on Stock
 * Exchanges routes) and any number of page-local ones (e.g. Transactions'
 * own "Transfers" action, or — since 2026-09-11 — Banking's several
 * tab-scoped FABs) combine into ONE grouped `FabPanel` instead of several
 * separate `position:fixed` elements fighting for the same corner.
 *
 * User-reported (2026-09-07): "Trade Calc FAB overlapping/Blocking other
 * Fabs instead of grouping" — `CalculatorLauncher.tsx` and QSE's/PSX's own
 * page-level Transfers `FabPanel` (README Done item 219) were both
 * independently mounted `position:fixed` elements at the identical
 * `right:24/bottom:24` corner, since `CalculatorLauncher` was never wired
 * into the same grouping mechanism `FabPanel` itself was built for.
 *
 * Keyed by contributor (2026-09-11, user-reported): `Tabs.tsx`'s own
 * "chip click force-opens a section without closing the others" design
 * (see that file's own comment) means Banking's page can easily end up
 * with its Accounts, Credit Cards, AND Planning tabs all open at once —
 * each with its own FAB. The original single-slot `extraActions` array
 * only ever had ONE real page-local writer at a time (QSE's Transactions
 * page and PSX's are mutually exclusive by route), so a second
 * simultaneous writer silently clobbered the first's actions entirely.
 * Keying by a caller-supplied id lets any number of simultaneously-mounted
 * contributors coexist — `allExtraActions()` flattens them all into the
 * one list `CalculatorLauncher`/`BankPage` actually render. Use
 * `usePageFabActions()` (the paired hook) from a page rather than writing
 * to this store directly. */
export const useFabActionsStore = create<{
  actionsByKey: Record<string, FabAction[]>;
  setActionsForKey: (key: string, actions: FabAction[]) => void;
}>((set) => ({
  actionsByKey: {},
  setActionsForKey: (key, actions) => set((s) => ({ actionsByKey: { ...s.actionsByKey, [key]: actions } })),
}));

/** Flattens every contributor's own actions into one list, in a stable
 * (insertion) order — the shape every renderer (`CalculatorLauncher`,
 * `BankPage`) actually wants. */
export function allExtraActions(actionsByKey: Record<string, FabAction[]>): FabAction[] {
  return Object.values(actionsByKey).flat();
}
