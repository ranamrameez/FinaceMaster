import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TradeCalculator as QSETradeCalculator } from '../features/qse/components/TradeCalculator';
import { TradeCalculator as PSXTradeCalculator } from '../features/psx/components/TradeCalculator';
import { categoryForPath } from './CategoryNav';
import { Modal } from './Modal';

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
export function CalculatorLauncher() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isPSX = location.pathname.startsWith('/psx');
  const isStocks = categoryForPath(location.pathname) === 'stocks';

  if (!isStocks) return null;

  return (
    <>
      <button
        className="btn"
        onClick={() => setOpen(true)}
        title="Trade calculator"
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          borderRadius: 999,
          padding: '12px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          zIndex: 500,
        }}
      >
        🧮 Calculator
      </button>
      {open && (
        <Modal title={`${isPSX ? 'PSX' : 'QSE'} Trade Calculator`} onClose={() => setOpen(false)}>
          {isPSX ? <PSXTradeCalculator /> : <QSETradeCalculator />}
        </Modal>
      )}
    </>
  );
}
