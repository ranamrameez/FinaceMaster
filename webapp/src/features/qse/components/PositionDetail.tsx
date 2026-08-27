import { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { CollapsibleCard } from '../../../components/Card';
import { confirmDialog } from '../../../components/ConfirmDialog';
import { EditIcon, SaveIcon, TrashIcon, XIcon } from '../../../components/icons';
import { IconButton } from '../../../components/ui/IconButton';
import { Sparkline } from '../../../components/Sparkline';
import { toast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { breakEvenPrice, computePriceStats, getMarketPrice } from '../../../lib/calc';
import { getDailyPriceHistory } from '../../../lib/calc/priceHistory';
import { applyChartTheme } from '../../../lib/chartSetup';
import { toCSV } from '../../../lib/csv';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import type { PricePoint } from '../../../types/workbook';
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
  const updatePricePoint = useWorkbookStore((s) => s.updatePricePoint);
  const deletePricePoint = useWorkbookStore((s) => s.deletePricePoint);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;
  // See DashboardPage: charts only recompute their CSS-var-derived colors
  // on this component's own re-renders.
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const position = positions.find((p) => p.ticker === ticker);
  const shares = position?.shares || 0;
  const isOpen = shares > 0;
  const invested = position?.invested || 0;
  const avg = shares > 0 ? invested / shares : 0;
  const mp = getMarketPrice(ticker, workbook.marketPrices, workbook.transactions);
  const be = shares > 0 ? breakEvenPrice(invested, shares, workbook.settings.feePct, workbook.settings.tick, calcFee) : 0;
  // Item 1 of a 2026-08-26 feedback batch: Portfolio's/Dashboard's Holdings
  // tables both show Exit targets + Status for an open position — this page
  // (the "detail" view for a single stock) didn't have either, even though
  // it's the most natural place to check a specific stock's own exit plan.
  // Same status-threshold logic as those two tables, duplicated per the
  // existing convention rather than factored into a shared helper.
  const exitTarget = (pct: number) =>
    shares > 0 ? breakEvenPrice(invested * (1 + pct / 100), shares, workbook.settings.feePct, workbook.settings.tick, calcFee) : 0;
  const value = shares * mp;
  const sellFee = isOpen && mp > 0 ? calcFee(value, false) : 0;
  const profit = isOpen && mp > 0 ? value - sellFee - invested : NaN;
  let statusLabel = '';
  let statusHue: string | undefined;
  if (isOpen) {
    if (!Number.isFinite(profit)) { statusLabel = 'PRICE NEEDED'; statusHue = undefined; }
    else if (profit >= 0) { statusLabel = 'EXIT READY'; statusHue = 'var(--profit)'; }
    else if ((profit / invested) * 100 > -3) { statusLabel = 'WATCH'; statusHue = undefined; }
    else { statusLabel = 'HOLD / REVIEW'; statusHue = 'var(--loss)'; }
  }

  const [priceInput, setPriceInput] = useState(mp > 0 ? String(mp) : '');
  // Re-prefill from the stored price whenever the ticker changes (this
  // component is reused across stock pages without remounting).
  useEffect(() => setPriceInput(mp > 0 ? String(mp) : ''), [ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastBuyPrice = [...workbook.transactions].filter((t) => t.ticker === ticker && t.action === 'BUY').sort((a, b) => a.date.localeCompare(b.date)).pop()?.price || 0;
  const soldTx = workbook.transactions.filter((t) => t.ticker === ticker && t.action === 'SELL');
  const lastSellPrice = [...soldTx].sort((a, b) => a.date.localeCompare(b.date)).pop()?.price || 0;
  const avgSellPrice = soldTx.length ? soldTx.reduce((s, t) => s + t.shares * t.price, 0) / soldTx.reduce((s, t) => s + t.shares, 0) : 0;
  const holdingDays = position
    ? Math.max(0, Math.round((new Date(position.lastDate).getTime() - new Date(position.firstDate).getTime()) / 86400000))
    : 0;

  const stats = computePriceStats(ticker, workbook.priceHistory);
  // README item 2 of a 2026-08-27 feedback batch: the Dashboard/Portfolio
  // Holdings tables' Trend sparkline was the one column Done item 152
  // didn't actually bring over here — same data source those tables use.
  const sparkData = getDailyPriceHistory(ticker, workbook.priceHistory).map((p) => p.price);

  // User-reported (2026-08-27): "current price updates are shown upto
  // recent 8, no view to see them all" — see the identical comment in
  // PSX's PositionDetail.tsx for why swapping the source array is safe
  // for the existing edit/delete `rawHistory.indexOf(p)` resolution.
  const [showAllPrices, setShowAllPrices] = useState(false);
  const recentRows = showAllPrices ? [...(stats?.chronological ?? [])].reverse() : (stats?.recent ?? []);
  type RecentCol = 'when' | 'price';
  const recentSortValue = (p: (typeof recentRows)[number], col: RecentCol): number | string =>
    col === 'price' ? p.price : (p.time ?? p.date);
  const { sorted: sortedRecent, Th: RecentTh } = useSortableRows(recentRows, recentSortValue, 'when', 'desc');

  // README item 1 of the same batch: "the option to change the past
  // current prices" — `setMarketPrice` only ever appends a new point for
  // TODAY; there was no way to correct a mistaken past entry. Addressed by
  // raw array index within `priceHistory[ticker]` (object identity survives
  // `computePriceStats`'s sort/slice, so `indexOf` on a displayed row finds
  // its real index — see `updatePricePoint`'s own doc comment in the store).
  const [editPriceIndex, setEditPriceIndex] = useState<number | null>(null);
  const [editPriceRow, setEditPriceRow] = useState<PricePoint | null>(null);
  const rawHistory = workbook.priceHistory[ticker] ?? [];

  const startEditPrice = (rawIndex: number, point: PricePoint) => {
    setEditPriceIndex(rawIndex);
    setEditPriceRow({ ...point });
  };
  const cancelEditPrice = () => {
    setEditPriceIndex(null);
    setEditPriceRow(null);
  };
  const saveEditPrice = async () => {
    if (editPriceIndex === null || !editPriceRow) return;
    if (!editPriceRow.price || editPriceRow.price <= 0) return toast('Enter a valid price.');
    if (!(await ensureSignedIn('Sign in to edit price history.'))) return;
    updatePricePoint(ticker, editPriceIndex, editPriceRow);
    toast('Price entry updated.');
    cancelEditPrice();
  };
  const removePricePoint = async (rawIndex: number) => {
    if (!(await confirmDialog('Delete this price entry? This cannot be undone.'))) return;
    if (!(await ensureSignedIn('Sign in to edit price history.'))) return;
    deletePricePoint(ticker, rawIndex);
    toast('Price entry deleted.');
  };

  /** README item 40: this ticker's price-history statement, separate from
   * the trade statement exported on the Transactions tab — exports the
   * full raw log (`stats.chronological`), not just the "recent" slice
   * shown on screen. */
  const exportPriceHistory = () => {
    if (!stats) return;
    const rows = [...stats.chronological].sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date));
    const header = ['When', 'Price'];
    const body = rows.map((p) => [p.time ? new Date(p.time).toLocaleString() : p.date, p.price]);
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticker}_price_history.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Price history downloaded.');
  };

  const commitPrice = async () => {
    const val = parseFloat(priceInput);
    if (!val || val <= 0) return;
    if (!(await ensureSignedIn('Sign in to save price updates.'))) return;
    setMarketPrice(ticker, val);
    toast(`${ticker} price saved: ${fmtPrice(val)}`);
    // User-reported bug: this used to reset to '', which blanked the input
    // right after a successful save even though the price WAS saved
    // correctly (every other stat on the page reflected it) — reads as
    // "current price disappears after saving." Re-fill with what was just
    // saved instead, so the field shows the value it actually holds now.
    setPriceInput(String(val));
  };

  return (
    // Pending items 54/56/57: charts + Price range move to a right-hand
    // stack while the other stat cards stay on the left, on wide viewports
    // — see theme.css's .position-split comment for the mobile-order
    // tradeoff (left-column content shows first when collapsed to one
    // column, not the original top-to-bottom order).
    <div className="position-split">
    <div className="position-split-left">

      {isOpen && (
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>Current position</h4>} style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 8 }}>
            <div className="stat-card card" style={hueStyle(HUES[2])}>
              <div className="label">Trend</div>
              <div className="value"><Sparkline data={sparkData} formatValue={fmtPrice} /></div>
            </div>
            <div className="stat-card card" style={hueStyle(HUES[0])}><div className="label">Shares</div><div className="value">{fmt(shares, 0)}</div></div>
            <div className="stat-card card" style={hueStyle(HUES[1])}>
              <Tooltip text="Cost: what you paid per share on average. BE (break-even): the price you'd need to sell at to get your money back, including fees.">
                <div className="label" style={{ cursor: 'pointer' }}>Cost</div>
              </Tooltip>
              <div className="value">{fmtPrice(avg)}</div>
              <div className="sub" style={{ color: mp > 0 ? (mp >= be ? 'var(--profit)' : 'var(--loss)') : undefined }}>BE {fmtPrice(be)}</div>
            </div>
            <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Invested</div><div className="value">{fmtMoney(invested, currency)}</div></div>
            <div className="stat-card card" style={hueStyle(HUES[4])}>
              <div className="label">Value</div>
              <div className="value">{mp > 0 ? fmtMoney(value, currency) : '—'}</div>
            </div>
            <div className="stat-card card" style={hueStyle(Number.isFinite(profit) ? (profit >= 0 ? 'var(--profit)' : 'var(--loss)') : HUES[7])}>
              <div className="label">P/L</div>
              <div className="value">{Number.isFinite(profit) ? fmtMoney(profit, currency) : '—'}</div>
              <div className="sub">{Number.isFinite(profit) && invested > 0 ? `${((profit / invested) * 100).toFixed(1)}%` : ''}</div>
            </div>
            <div className="stat-card card" style={hueStyle(HUES[5])}>
              <div className="label">Exit targets</div>
              <div className="value" style={{ fontSize: 13 }}>
                +1% {fmtPrice(exitTarget(1))}<br />+2% {fmtPrice(exitTarget(2))}<br />+5% {fmtPrice(exitTarget(5))}
              </div>
            </div>
            <div className="stat-card card" style={hueStyle(statusHue || HUES[6])}>
              <div className="label">Status</div>
              <div className="value" style={{ fontSize: 14 }}>{statusLabel}</div>
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* All-time stats: the thing closed positions were missing entirely —
          shares/avg-cost/break-even are meaningless once a position is
          fully closed, but the lifetime record (what was bought, sold,
          realized, and over what period) is exactly what you'd want to
          look back on. */}
      {position && (position.buyCount > 0 || position.sellCount > 0) && (
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>All-time stats</h4>} style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 8 }}>
            <div className="stat-card card" style={hueStyle(HUES[0])}>
              <div className="label">Bought / Sold</div>
              <div className="value">{fmt(position.totalBoughtShares, 0)} / {fmt(position.totalSoldShares, 0)}</div>
              <div className="sub">{position.buyCount} buys · {position.sellCount} sells</div>
            </div>
            {position.sellCount > 0 && (
              <div className="stat-card card" style={hueStyle(HUES[7])}>
                <div className="label">Sell price</div>
                <Tooltip text="Weighted average, and most recent, sell price for this ticker.">
                  <div className="value">{fmtPrice(avgSellPrice)}</div>
                </Tooltip>
                <div className="sub">avg · last {fmtPrice(lastSellPrice)}</div>
              </div>
            )}
            <div className="stat-card card" style={hueStyle(position.realized >= 0 ? 'var(--profit)' : 'var(--loss)')}>
              <div className="label">Realized P/L</div>
              <div className="value">{fmtMoney(position.realized, currency)}</div>
            </div>
            <div className="stat-card card" style={hueStyle(HUES[4])}><div className="label">Fees paid</div><div className="value">{fmtMoney(position.buyFees + position.sellFees, currency)}</div></div>
            <div className="stat-card card" style={hueStyle(HUES[3])}>
              <div className="label">Trade dates</div>
              <div className="value" style={{ fontSize: 14 }}>{position.firstDate}</div>
              <div className="sub">to {position.lastDate}</div>
            </div>
            {!isOpen && <div className="stat-card card" style={hueStyle(HUES[6])}><div className="label">Held</div><div className="value">{holdingDays}d</div></div>}
          </div>
        </CollapsibleCard>
      )}

    </div>
    <div className="position-split-right">

      {/* Daily price — the single most-asked-about number, so it leads
          instead of being buried under other sections. */}
      <CollapsibleCard title={<h4 style={{ margin: 0 }}>Daily price</h4>} style={{ marginBottom: 12 }}>
      {stats ? (
        <CompactChart height={130}>
          <Line
            data={{
              labels: stats.chronological.map((p) => p.date),
              datasets: [
                {
                  label: 'Price',
                  data: stats.chronological.map((p) => p.price),
                  borderColor: '#c9a35a',
                  backgroundColor: 'rgba(201,163,90,0.12)',
                  fill: true,
                  tension: 0.25,
                  // A single day of price history has no line to draw and
                  // pointRadius:0 hides the dot too — the chart looked
                  // completely blank (a real user-reported "not working"
                  // bug) with exactly one data point, which is the common
                  // case for a ticker whose price was only just set today.
                  pointRadius: stats.chronological.length > 1 ? 0 : 3,
                  borderWidth: 1.75,
                },
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
          className="price-input"
          placeholder="Update price"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitPrice()}
          style={{ width: 150 }}
        />
        <button className="btn secondary small" onClick={commitPrice}><SaveIcon size={12} />Save price</button>
      </div>
      </CollapsibleCard>

      {isOpen && (
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>Buy vs. current vs. break-even</h4>} style={{ marginBottom: 12 }}>
          <CompactChart height={lastSellPrice > 0 ? 150 : 115}>
            <Bar
              data={{
                labels: lastSellPrice > 0 ? ['Buy', 'Sold', 'Current', 'Break-even'] : ['Buy', 'Current', 'Break-even'],
                datasets: [
                  {
                    data: lastSellPrice > 0 ? [lastBuyPrice, lastSellPrice, mp, be] : [lastBuyPrice, mp, be],
                    backgroundColor: lastSellPrice > 0
                      ? ['#8f5ac9', '#3b6bd6', mp >= be ? '#3ecf8e' : '#e5484d', '#c9a35a']
                      : ['#8f5ac9', mp >= be ? '#3ecf8e' : '#e5484d', '#c9a35a'],
                    maxBarThickness: 20,
                  },
                ],
              }}
              options={{
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                // Done item 138: Chart.js's autoSkip was silently dropping
                // "Sold"/"Break-even" labels from this 4-row category axis.
                scales: { y: { ticks: { autoSkip: false } } },
              }}
            />
          </CompactChart>
        </CollapsibleCard>
      )}

      {stats && (
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>Price range</h4>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <div className="stat-card card" style={hueStyle(HUES[5])}><div className="label">Lowest</div><div className="value">{fmtPrice(stats.min)}</div><div className="sub">{stats.minDate}</div></div>
            <div className="stat-card card" style={hueStyle(HUES[1])}>
              <div className="label">Median (fair value)</div>
              <Tooltip text="A simple fair-value estimate: the middle price across every update you've recorded for this ticker.">
                <div className="value">{fmtPrice(stats.median)}</div>
              </Tooltip>
            </div>
            <div className="stat-card card" style={hueStyle(HUES[2])}><div className="label">Highest</div><div className="value">{fmtPrice(stats.max)}</div><div className="sub">{stats.maxDate}</div></div>
          </div>
          <details>
            <summary className="footer-note" style={{ cursor: 'pointer' }}>
              {showAllPrices ? `All updates (${stats.totalUpdates})` : `Recent updates (${stats.recent.length} of ${stats.totalUpdates})`}
            </summary>
            {stats.totalUpdates > stats.recent.length && (
              <button
                className="btn secondary small"
                style={{ marginTop: 8 }}
                onClick={() => setShowAllPrices((v) => !v)}
              >
                {showAllPrices ? 'Show recent 8 only' : `Show all ${stats.totalUpdates} updates`}
              </button>
            )}
            <div className="table-scroll" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><RecentTh col="when">When</RecentTh><RecentTh col="price">Price</RecentTh><th></th></tr></thead>
                <tbody>
                  {sortedRecent.map((p) => {
                    const rawIndex = rawHistory.indexOf(p);
                    return editPriceIndex === rawIndex && editPriceRow ? (
                      <tr key={rawIndex}>
                        <td><input type="date" value={editPriceRow.date} onChange={(e) => setEditPriceRow({ ...editPriceRow, date: e.target.value })} style={{ width: 130 }} /></td>
                        <td><input type="number" step="0.001" value={editPriceRow.price} onChange={(e) => setEditPriceRow({ ...editPriceRow, price: Number(e.target.value) })} style={{ width: 90 }} /></td>
                        <td>
                          <IconButton label="Save" icon={<SaveIcon size={12} />} onClick={saveEditPrice} />
                          <IconButton label="Cancel" icon={<XIcon size={12} />} onClick={cancelEditPrice} />
                        </td>
                      </tr>
                    ) : (
                      <tr key={rawIndex}>
                        <td>{p.time ? new Date(p.time).toLocaleString() : p.date}</td>
                        <td>{fmtPrice(p.price)}</td>
                        <td>
                          <IconButton label="Edit" icon={<EditIcon size={12} />} onClick={() => startEditPrice(rawIndex, p)} />
                          <IconButton label="Delete" icon={<TrashIcon size={12} />} onClick={() => removePricePoint(rawIndex)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="btn secondary small" style={{ marginTop: 8 }} onClick={exportPriceHistory}>Export price history CSV</button>
          </details>
        </CollapsibleCard>
      )}

    </div>
    </div>
  );
}
