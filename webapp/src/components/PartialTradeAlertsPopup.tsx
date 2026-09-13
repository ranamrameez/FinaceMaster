import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { makeQSEFeeCalculator } from '../lib/calc/fees';
import { makePSXFeeCalculator } from '../lib/calc/psxFees';
import { scanPortfolioForOpportunities, type PartialTradeOpportunity } from '../lib/calc/partialTradeStrategy';
import { fmtMoney } from '../lib/format';
import { usePartialTradeAlertDismissalStore } from '../store/partialTradeAlertDismissalStore';
import { useWorkbookStore } from '../store/workbookStore';
import { usePSXWorkbookStore } from '../store/psxWorkbookStore';
import { XIcon } from './icons';

const AUTO_HIDE_MS = 12000;
const today = () => new Date().toISOString().slice(0, 10);

interface AlertRow extends PartialTradeOpportunity {
  exchange: 'qse' | 'psx';
  currency: string;
  key: string;
}

/** Opt-in, portfolio-wide popup listing every ticker (either exchange)
 * with a Partial Trade Strategy opportunity — "the user can decide if he
 * should sell any lots in one glance" (user's own framing). Off by
 * default per exchange (`QSESettings`/`PSXSettings`.
 * `partialTradeAlertsEnabled`) since this is explicitly a "risky
 * strategy" the user opts into, same reasoning as every other opt-in
 * advisory feature in this app. Mounted once at the App root, same
 * auto-hiding/per-occurrence-dismissible shape as
 * `SubscriptionAlertsPopup` (including reusing its dismissal-store
 * pattern) — link-only (confirmed via Q&A): clicking a row navigates to
 * that ticker's own page to act, no duplicate write path here. */
export function PartialTradeAlertsPopup() {
  const qseSettings = useWorkbookStore((s) => s.workbook.settings);
  const qseTx = useWorkbookStore((s) => s.workbook.transactions);
  const qseMarketPrices = useWorkbookStore((s) => s.workbook.marketPrices);
  const psxSettings = usePSXWorkbookStore((s) => s.workbook.settings);
  const psxTx = usePSXWorkbookStore((s) => s.workbook.transactions);
  const psxMarketPrices = usePSXWorkbookStore((s) => s.workbook.marketPrices);

  const isDismissed = usePartialTradeAlertDismissalStore((s) => s.isDismissed);
  const dismiss = usePartialTradeAlertDismissalStore((s) => s.dismiss);

  // Snapshot once on mount (not live-recomputed) — same "what's due when
  // you opened the app" spirit as SubscriptionAlertsPopup.
  const initial = useMemo(() => {
    const rows: AlertRow[] = [];
    const date = today();
    if (qseSettings.partialTradeAlertsEnabled) {
      const calcFee = makeQSEFeeCalculator(qseSettings);
      scanPortfolioForOpportunities(qseTx, calcFee, qseMarketPrices, qseSettings.feePct, qseSettings.tick).forEach((o) => {
        const key = `qse:${o.ticker}:${date}`;
        if (!isDismissed(key)) rows.push({ ...o, exchange: 'qse', currency: qseSettings.currency, key });
      });
    }
    if (psxSettings.partialTradeAlertsEnabled) {
      const calcFee = makePSXFeeCalculator(psxSettings, psxTx);
      scanPortfolioForOpportunities(psxTx, calcFee, psxMarketPrices, psxSettings.feePct, psxSettings.tick).forEach((o) => {
        const key = `psx:${o.ticker}:${date}`;
        if (!isDismissed(key)) rows.push({ ...o, exchange: 'psx', currency: psxSettings.currency, key });
      });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => initial.map((d) => d.key));
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!initial.length) return;
    const t = setTimeout(() => setHidden(true), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [initial.length]);

  const visible = initial.filter((d) => visibleKeys.includes(d.key));
  if (hidden || !visible.length) return null;

  const dismissOne = (key: string) => {
    dismiss(key);
    setVisibleKeys((keys) => keys.filter((k) => k !== key));
  };

  return (
    <div
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 400, width: 340, maxWidth: 'calc(100vw - 32px)',
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,.28)', padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Partial Trade: {visible.length} ticker{visible.length > 1 ? 's' : ''} sellable
        </div>
        <button className="btn ghost" style={{ padding: 2, minHeight: 22, minWidth: 22 }} aria-label="Close" onClick={() => setHidden(true)}>
          <XIcon size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((d) => (
          <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div>
              <Link to={d.exchange === 'psx' ? `/psx/stock/${d.ticker}` : `/stock/${d.ticker}`} style={{ fontWeight: 600, fontSize: 13 }} onClick={() => setHidden(true)}>
                {d.exchange.toUpperCase()} {d.ticker}
              </Link>
              <div className="text-muted">
                {d.sellableShares}/{d.totalShares} sh sellable · {fmtMoney(d.bestUnrealizedPL, d.currency)}
              </div>
            </div>
            <button className="btn secondary small" onClick={() => dismissOne(d.key)}>Dismiss</button>
          </div>
        ))}
      </div>
    </div>
  );
}
