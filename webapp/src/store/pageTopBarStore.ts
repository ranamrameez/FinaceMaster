import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface TopBarChip {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

/** A tiny, never-persisted registry the currently-mounted page's own
 * `Tabs` instance pushes its section chips into (and, separately, an
 * optional right-side slot — e.g. Net Worth's currency switcher) — same
 * "page registers, one globally-mounted component renders" shape as
 * `fabActionsStore.ts`. `TopBar.tsx` (rendered once by `AppShell.tsx`,
 * fixed at the very top of `.main`) reads this instead of `Tabs.tsx`
 * rendering its own inline chip row, so the chips are visible immediately
 * on page load rather than only once scrolled to. Use
 * `hooks/usePageTopBar.ts`'s hooks from a page/component rather than
 * writing to this store directly. */
export const usePageTopBarStore = create<{
  chips: TopBarChip[];
  setChips: (chips: TopBarChip[]) => void;
  rightSlot: ReactNode | null;
  setRightSlot: (node: ReactNode | null) => void;
}>((set) => ({
  chips: [],
  setChips: (chips) => set({ chips }),
  rightSlot: null,
  setRightSlot: (rightSlot) => set({ rightSlot }),
}));
