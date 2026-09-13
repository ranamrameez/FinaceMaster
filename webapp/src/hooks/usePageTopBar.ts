import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePageTopBarStore, type TopBarChip } from '../store/pageTopBarStore';

/** Registers this page's own top-bar section chips (see `Tabs.tsx`, the
 * only real caller) into the shared store, so they render in the
 * app-wide fixed `TopBar` instead of scrolling away with the page.
 * Clears on unmount so a stale set of chips never lingers into the next
 * page. `chips` should be referentially stable-ish across renders (this
 * effect re-runs whenever the array reference changes) — `Tabs.tsx`
 * rebuilds it from its own local `openKeys` state on every render, which
 * is fine since that state only changes on a real chip click. */
export function usePageTopBarChips(chips: TopBarChip[]): void {
  const setChips = usePageTopBarStore((s) => s.setChips);
  useEffect(() => {
    setChips(chips);
    return () => setChips([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chips]);
}

/** Registers an optional extra control on the top bar's right edge (e.g.
 * Net Worth's currency switcher) — independent of `usePageTopBarChips`,
 * since a page with a right-slot control doesn't necessarily use `Tabs`
 * at all. Pass `null` (or omit) to clear. */
export function usePageTopBarRightSlot(node: ReactNode | null): void {
  const setRightSlot = usePageTopBarStore((s) => s.setRightSlot);
  useEffect(() => {
    setRightSlot(node);
    return () => setRightSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);
}
