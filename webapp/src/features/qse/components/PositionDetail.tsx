import { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import '../../../lib/chartSetup';
import { SaveIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, computePriceStats, getMarketPrice } from '../../../lib/calc';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useQSEDerived } from '../hooks/useQSEDerived';

/** Small, fixed-height chart wrapper — Chart.js defaults to filling
 * whatever block-level space it's given, which meant every chart rendered
 * oversized. maintainAspectRatio:false + an explicit height keeps every
 * chart here compact and consistent, whether shown in a popup or a page. */
function CompactChart({ height, children }: { height: number; children: React.ReactNode }) {
  return <div style={{ height, position: 'relative' }}>{children}</div>;
}

/** The actual "everything about this ticker" content — daily price chart,
 * current position (if open), all-time stats (works for closed positions
 * too, which is what the quick popup used to be missing entirely), and
 * price range. Shared between the quick popup (PositionModal) and the full
 * dedicated stock page (StockPage) so they never drift apart. */
export function PositionDetail({ ticker }: { ticker: string }) {
  const { workbook, positions, calcFee } = useQSEDerived();
  const setMarketPrice = useWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;
  // See DashboardPage: charts only recompute their CSS-var-derived colors
  // on this component's own re-renders.
  useAppearanceStore((s) => s.appearance);

  const position = positions.find((p) => p.ticker === ticker);
  const shares = position?.shares || 0;
  const isOpen = shares > 0;
  const invested = position?.invested || 0;
  const avg = shares > 0 ? invested / shares : 0;
  const mp = getMarketPrice(ticker, workbook.marketPrices, workbook.transactions);
  const be = shares > 0 ? breakEvenPrice(invested, shares, workbook.settings.feePct, workbook.settings.tick, calcFee) : 0;

  const [priceInput, setPriceInput] = useState(mp > 0 ? String(mp) : '');
  // Re-prefill from the stored price whenever the ticker changes (this
  // component is reused across stock pages without remounting).
  useEffect(() => setPriceInput(mp > 0 ? String(mp) : ''), [ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastBuyPrice = [...workbook.transactions].filter((t) => t.ticker === ticker && t.action === 'BUY').sort((a, b) => a.date.localeCompare(b.date)).pop()?.price || 0;
  const holdingDays = position
    ? Math.max(0, Math.round((new Date(position.lastDate).getTime() - new Date(position.firstDate).getTime()) / 86400000))
    : 0;

  const stats = computePriceStats(ticker, workbook.priceHistory);

  const commitPrice = async () => {
    const val = parseFloat(priceInput);
    if (!val || val <= 0) return;
    if (!(await ensureSignedIn('Sign in to save price updates.'))) return;
    setMarketPrice(ticker, val);
    toast(`${ticker} price saved: ${fmtPrice(val)}`);
    setPriceInput('');
  };

  return (
    <div>
      {/* Daily price — the single most-asked-about number, so it leads
          instead of being buried under other sections. */}
      <h4 style={{ marginTop: 0 }}>Daily price</h4>
      {stats ? (
        <CompactChart height={130}>
          <Line
            data={{
              labels: stats.chronological.map((p) => p.date),
              datasets: [
                { label: 'Price', data: stats.chronological.map((p) => p.price), borderColor: '#c9a35a', backgroundColor: 'rgba(201,163,90,0.12)', fill: true, tension: 0.25, pointRadius: 0, borderWidth: 1.75 },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
              scales: { x: { display: false }, y: { display: false } },
            }}
          />
        </CompactChart>
      ) : (
        <p className="footer-note">No price history recorded for {ticker} yet.</p>
      )}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <input
          type="number"
          step="0.001"
          placeholder="Update price"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitPrice()}
          style={{ width: 130 }}
        />
        <button className="btn secondary small" onClick={commitPrice}><SaveIcon size={12} />Save price</button>
      </div>

      {isOpen && (
        <>
          <h4 style={{ marginTop: 16 }}>Current position</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 8 }}>
            <div className="stat-card card"><div className="label">Shares</div><div className="value">{fmt(shares, 0)}</div></div>
            <div className="stat-card card"><div className="label">Avg cost</div><div className="value">{fmtPrice(avg)}</div></div>
            <div className="stat-card card"><div className="label">Invested</div><div className="value">{fmtMoney(invested, currency)}</div></div>
            <div className="stat-card card">
              <div className="label">Break-even</div>
              <div className={`value ${mp > 0 ? (mp >= be ? 'pill-buy' : 'pill-sell') : ''}`}>{fmtPrice(be)}</div>
            </div>
          </div>
          <CompactChart height={90}>
            <Bar
              data={{
                labels: ['Buy', 'Current', 'Break-even'],
                datasets: [{ data: [lastBuyPrice, mp, be], backgroundColor: ['#8f5ac9', mp >= be ? '#3ecf8e' : '#e5484d', '#c9a35a'] }],
              }}
              options={{ maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }}
            />
          </CompactChart>
        </>
      )}

      {/* All-time stats: the thing closed positions were missing entirely —
          shares/avg-cost/break-even are meaningless once a position is
          fully closed, but the lifetime record (what was bought, sold,
          realized, and over what period) is exactly what you'd want to
          look back on. */}
      {position && (position.buyCount > 0 || position.sellCount > 0) && (
        <>
          <h4 style={{ marginTop: 16 }}>All-time stats</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 8 }}>
            <div className="stat-card card"><div className="label">Total bought</div><div className="value">{fmt(position.totalBoughtShares, 0)}</div><div className="sub">{position.buyCount} buys</div></div>
            <div className="stat-card card"><div className="label">Total sold</div><div className="value">{fmt(position.totalSoldShares, 0)}</div><div className="sub">{position.sellCount} sells</div></div>
            <div className="stat-card card"><div className="label">Realized P/L</div><div className="value">{fmtMoney(position.realized, currency)}</div></div>
            <div className="stat-card card"><div className="label">Fees paid</div><div className="value">{fmtMoney(position.buyFees + position.sellFees, currency)}</div></div>
            <div className="stat-card card"><div className="label">First trade</div><div className="value" style={{ fontSize: 13 }}>{position.firstDate}</div></div>
            <div className="stat-card card"><div className="label">Last trade</div><div className="value" style={{ fontSize: 13 }}>{position.lastDate}</div></div>
            {!isOpen && <div className="stat-card card"><div className="label">Held</div><div className="value">{holdingDays}d</div></div>}
          </div>
        </>
      )}

      {stats && (
        <>
          <h4 style={{ marginTop: 16 }}>Price range</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <div className="stat-card card"><div className="label">Lowest</div><div className="value">{fmtPrice(stats.min)}</div><div className="sub">{stats.minDate}</div></div>
            <div className="stat-card card"><div className="label">Median</div><div className="value">{fmtPrice(stats.median)}</div></div>
            <div className="stat-card card"><div className="label">Highest</div><div className="value">{fmtPrice(stats.max)}</div><div className="sub">{stats.maxDate}</div></div>
          </div>
          <details>
            <summary className="footer-note" style={{ cursor: 'pointer' }}>Recent updates ({stats.recent.length})</summary>
            <div className="table-scroll" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>When</th><th>Price</th></tr></thead>
                <tbody>
                  {stats.recent.map((p, i) => (
                    <tr key={i}><td>{p.time ? new Date(p.time).toLocaleString() : p.date}</td><td>{fmtPrice(p.price)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
