import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TradeCalculator as QSETradeCalculator } from '../features/qse/components/TradeCalculator';
import { TradeCalculator as PSXTradeCalculator } from '../features/psx/components/TradeCalculator';
import { categoryForPath } from './CategoryNav';
import { Modal } from './Modal';
import { Tooltip } from './Tooltip';

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

export function CalculatorLauncher() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isPSX = location.pathname.startsWith('/psx');
  const isStocks = categoryForPath(location.pathname) === 'stocks';
  const initialTicker = stockTickerFromPath(location.pathname, isPSX);

  if (!isStocks) return null;

  return (
    <>
      {/* User-reported (batch-2 item 1): the toast notification sits at
         bottom-right too and was rendering hidden behind this button's much
         higher z-index, plus the button's own "🧮 Calculator" text label
         was flagged separately as unnecessary — "Calc Icon is enough. move
         its text to the tooltip." Shrinking this to a round icon-only FAB
         frees up the corner enough that the toast (repositioned to sit
         above it in theme.css) never collides with it, and the tooltip now
         carries the label instead of a native `title`, matching every
         other icon-only control's tooltip treatment in the app.
         The `position:fixed` lives on this OUTER div, not the button —
         `Tooltip`'s own trigger wrapper is a normal (statically positioned)
         span, and a `position:fixed` button inside it would render at the
         viewport corner while its DOM parent span stays wherever it fell
         in document flow (fixed elements are removed from flow entirely),
         so mouse hover and the tooltip's own getBoundingClientRect() math
         would both target the wrong, invisible location. Fixing the OUTER
         div instead means the button and Tooltip's span both sit, via
         ordinary layout, exactly where the div is pinned. */}
      <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500 }}>
        <Tooltip text="Trade calculator" align="right">
          <button
            className="btn"
            onClick={() => setOpen(true)}
            aria-label="Trade calculator"
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              padding: 0,
              fontSize: 22,
              boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            }}
          >
            🧮
          </button>
        </Tooltip>
      </div>
      {open && (
        <Modal title={`${isPSX ? 'PSX' : 'QSE'} Trade Calculator`} onClose={() => setOpen(false)}>
          {isPSX ? <PSXTradeCalculator initialTicker={initialTicker} /> : <QSETradeCalculator initialTicker={initialTicker} />}
        </Modal>
      )}
    </>
  );
}
