import { fmtPrice } from '../../../lib/format';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useQSEDerived } from '../hooks/useQSEDerived';

export interface Alert {
  ticker: string;
  message: string;
  cls: 'pos' | 'neg';
}

/** Extracted so DashboardPage can know the alert count (for the first-visit
 * toast) without re-implementing this logic. */
export function useQSEAlerts(): Alert[] {
  const { rows } = useQSEDerived();
  const watchlist = useWorkbookStore((s) => s.workbook.watchlist);

  const alerts: Alert[] = [];

  rows.forEach((r) => {
    const pct = r.roiPct;
    if (pct >= 10) alerts.push({ ticker: r.ticker, message: `Profit above 10% (+${pct.toFixed(1)}%)`, cls: 'pos' });
    else if (pct >= 5) alerts.push({ ticker: r.ticker, message: `Profit above 5% (+${pct.toFixed(1)}%)`, cls: 'pos' });
    else if (pct <= -10) alerts.push({ ticker: r.ticker, message: `Loss beyond 10% (${pct.toFixed(1)}%)`, cls: 'neg' });
    else if (pct <= -5) alerts.push({ ticker: r.ticker, message: `Loss beyond 5% (${pct.toFixed(1)}%)`, cls: 'neg' });
  });

  watchlist.forEach((w) => {
    if (w.current && w.current >= w.target) {
      alerts.push({
        ticker: w.ticker,
        message: `Watchlist target reached (${fmtPrice(w.current)} ≥ ${fmtPrice(w.target)})`,
        cls: 'pos',
      });
    }
  });

  return alerts;
}

export function AlertsBox() {
  const alerts = useQSEAlerts();

  if (!alerts.length) {
    return <p className="footer-note">No alerts right now — nothing above ±5% or at a watchlist target.</p>;
  }

  return (
    <div>
      {alerts.map((a, i) => (
        <div key={i} className="result-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span className="k">{a.ticker}</span>
          <span className={a.cls === 'pos' ? 'pill-buy' : 'pill-sell'}>{a.message}</span>
        </div>
      ))}
    </div>
  );
}
