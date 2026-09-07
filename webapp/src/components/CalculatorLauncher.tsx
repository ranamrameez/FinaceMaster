import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TradeCalculator as QSETradeCalculator } from '../features/qse/components/TradeCalculator';
import { TradeCalculator as PSXTradeCalculator } from '../features/psx/components/TradeCalculator';
import { categoryForPath } from './CategoryNav';
import { Modal } from './Modal';
import { FabPanel } from './ui/Fab';
import { useFabActionsStore } from '../store/fabActionsStore';

/** Trade Calculator as an on-demand popup, available from anywhere via this
 * floating button. Route-aware: shows the QSE calculator on QSE routes and
 * the PSX calculator on /psx/* routes, since each exchange has its own fee
 * model and can't share one calculator instance.
 *
 * MODULES_PLAN.md §10: this used to render unconditionally on every page,
 * defaulting to the QSE calculator anywhere that wasn't /psx/* — including
 * Cash/Bank/EMI/etc, where a stock trade calculator makes no sense. Gated
 * to Stock Exchanges routes only until each module has something real of
 * its own to calculate (see MODULES_PLAN.md §11's per-module planning
 * items); at that point this becomes route-aware across every module, not
 * just QSE/PSX. */
/** Pulls the ticker out of a per-stock detail route (/stock/:ticker or
 * /psx/stock/:ticker) so the calculator can open pre-selected to it — user
 * request: opening the calculator while already looking at a specific
 * stock/portfolio item shouldn't require re-picking that same ticker from
 * the dropdown. `useParams()` doesn't work here since this component is
 * rendered globally, outside the <Route> that owns that param. */
function stockTickerFromPath(pathname: string, isPSX: boolean): string | undefined {
  const pattern = isPSX ? /^\/psx\/stock\/([^/]+)/ : /^\/stock\/([^/]+)/;
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]).toUpperCase() : undefined;
}

/** User-reported (2026-09-07): "Trade Calc FAB overlapping/Blocking other
 * Fabs instead of grouping" — this used to render its own independent
 * `position:fixed` button at the exact same `right:24/bottom:24` corner
 * `FabPanel` (components/ui/Fab.tsx) already uses for every module's own
 * FAB, including QSE's/PSX's own page-level "Transfers" `FabPanel` on the
 * Transactions page (README Done item 219) — two separate fixed elements
 * fighting for one corner instead of the single grouped button `FabPanel`
 * was specifically built for. Fixed by making the calculator itself just
 * the FIRST action in a shared `FabPanel`, combined with whatever the
 * current page has registered via `usePageFabActions()`
 * (`fabActionsStore.ts`) — a page with nothing else to add (the common
 * case) sees the identical single round button as before (`FabPanel`
 * itself renders a lone action exactly like `FabButton`, same CSS class,
 * zero visual change); a page like Transactions that also registers its
 * own "Transfers" action now correctly expands into ONE grouped menu
 * instead of two buttons stacked on top of each other. */
export function CalculatorLauncher() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isPSX = location.pathname.startsWith('/psx');
  const isStocks = categoryForPath(location.pathname) === 'stocks';
  const initialTicker = stockTickerFromPath(location.pathname, isPSX);
  const extraActions = useFabActionsStore((s) => s.extraActions);

  if (!isStocks) return null;

  return (
    <>
      <FabPanel
        actions={[
          { label: 'Trade calculator', icon: <span>🧮</span>, onClick: () => setOpen(true) },
          ...extraActions,
        ]}
      />
      {open && (
        <Modal title={`${isPSX ? 'PSX' : 'QSE'} Trade Calculator`} onClose={() => setOpen(false)}>
          {isPSX ? <PSXTradeCalculator initialTicker={initialTicker} /> : <QSETradeCalculator initialTicker={initialTicker} />}
        </Modal>
      )}
    </>
  );
}
