import { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { CollapsibleCard } from '../../../components/Card';
import { SaveIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, computePriceStats, getMarketPrice } from '../../../lib/calc';
import { calcCGT } from '../../../lib/calc/psxFees';
import { applyChartTheme } from '../../../lib/chartSetup';
import { toCSV } from '../../../lib/csv';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { HUES, hueStyle } from '../../../lib/statCardHues';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { usePSXDerived } from '../hooks/usePSXDerived';

function CompactChart({ height, children }: { height: number; children: React.ReactNode }) {
  return <div style={{ height, position: 'relative' }}>{children}</div>;
}

/** PSX's equivalent of the QSE PositionDetail — same layout, plus an
 * estimated CGT-on-gain stat for open positions (README items 5/6: PSX
 * capital gains tax is a real cost QSE doesn't have, so it's worth
 * surfacing here rather than only in the trade calculator). */
export function PositionDetail({ ticker }: { ticker: string }) {
  const { workbook, positions, calcFee, lots } = usePSXDerived();
  const setMarketPrice = usePSXWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();

  const position = positions.find((p) => p.ticker === ticker);
  const shares = position?.shares || 0;
  const isOpen = shares > 0;
  const invested = position?.invested || 0;
  const avg = shares > 0 ? invested / shares : 0;
  const mp = getMarketPrice(ticker, workbook.marketPrices, workbook.transactions);
  const be = shares > 0 ? breakEvenPrice(invested, shares, workbook.settings.feePct, workbook.settings.tick, calcFee) : 0;

  const [priceInput, setPriceInput] = useState(mp > 0 ? String(mp) : '');
  useEffect(() => setPriceInput(mp > 0 ? String(mp) : ''), [ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastBuyPrice = [...workbook.transactions].filter((t) => t.ticker === ticker && t.action === 'BUY').sort((a, b) => a.date.localeCompare(b.date)).pop()?.price || 0;
  const soldTx = workbook.transactions.filter((t) => t.ticker === ticker && t.action === 'SELL');
  const lastSellPrice = [...soldTx].sort((a, b) => a.date.localeCompare(b.date)).pop()?.price || 0;
  const avgSellPrice = soldTx.length ? soldTx.reduce((s, t) => s + t.shares * t.price, 0) / soldTx.reduce((s, t) => s + t.shares, 0) : 0;
  const holdingDays = position
    ? Math.max(0, Math.round((new Date(position.lastDate).getTime() - new Date(position.firstDate).getTime()) / 86400000))
    : 0;

  const stats = computePriceStats(ticker, workbook.priceHistory);

  const lotRows = lots[ticker] ?? [];
  type LotCol = 'buyDate' | 'buyPrice' | 'remainingShares' | 'costPerShare';
  const lotSortValue = (lot: (typeof lotRows)[number], col: LotCol): number | string => {
    if (col === 'costPerShare') return lot.buyPrice + lot.buyFeeTotal / lot.originalShares;
    return lot[col];
  };
  const { sorted: sortedLots, Th: LotTh } = useSortableRows(lotRows, lotSortValue, 'buyDate', 'asc');

  const recentRows = stats?.recent ?? [];
  type RecentCol = 'when' | 'price';
  const recentSortValue = (p: (typeof recentRows)[number], col: RecentCol): number | string =>
    col === 'price' ? p.price : (p.time ?? p.date);
  const { sorted: sortedRecent, Th: RecentTh } = useSortableRows(recentRows, recentSortValue, 'when', 'desc');

  const grossValue = isOpen && mp > 0 ? shares * mp : 0;
  const estSellFee = grossValue > 0 ? calcFee(grossValue, false, { shares }) : 0;
  const estGain = grossValue > 0 ? grossValue - estSellFee - invested : 0;
  const estCGT = estGain > 0 ? calcCGT(estGain, workbook.settings) : 0;

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
    setPriceInput('');
  };

  return (
    <div>
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
          step="0.01"
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
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>Current position</h4>} style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 8 }}>
            <div className="stat-card card" style={hueStyle(HUES[0])}><div className="label">Shares</div><div className="value">{fmt(shares, 0)}</div></div>
            <div className="stat-card card" style={hueStyle(HUES[1])}>
              <div className="label">Cost</div>
              <div className="value">{fmtPrice(avg)}</div>
              <div className="sub" style={{ color: mp > 0 ? (mp >= be ? 'var(--profit)' : 'var(--loss)') : undefined }}>BE {fmtPrice(be)}</div>
            </div>
            <div className="stat-card card" style={hueStyle(HUES[3])}><div className="label">Invested</div><div className="value">{fmtMoney(invested, currency)}</div></div>
            {grossValue > 0 && (
              <div className="stat-card card" style={hueStyle(HUES[5])}>
                <div className="label">Est. CGT if sold now</div>
                <div className="value">{fmtMoney(estCGT, currency)}</div>
                <div className="sub">{workbook.settings.filerStatus === 'filer' ? `${workbook.settings.cgtFilerPct}% filer rate` : `${workbook.settings.cgtNonFilerPct}% non-filer rate`}</div>
              </div>
            )}
          </div>
          <div style={{ maxWidth: 380 }}>
            <CompactChart height={lastSellPrice > 0 ? 110 : 90}>
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
                options={{ maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }}
              />
            </CompactChart>
          </div>
        </CollapsibleCard>
      )}

      {lotRows.length ? (
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>Open lots (FIFO)</h4>} style={{ marginBottom: 12 }}>
          <div className="table-scroll">
            <table>
              <thead><tr><LotTh col="buyDate">Buy date</LotTh><LotTh col="buyPrice">Buy price</LotTh><LotTh col="remainingShares">Remaining</LotTh><LotTh col="costPerShare">Cost/share</LotTh></tr></thead>
              <tbody>
                {sortedLots.map((lot, i) => (
                  <tr key={i}>
                    <td>{lot.buyDate}</td>
                    <td>{fmtPrice(lot.buyPrice)}</td>
                    <td>{fmt(lot.remainingShares, 0)}</td>
                    <td>{fmtPrice(lot.buyPrice + lot.buyFeeTotal / lot.originalShares)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footer-note" style={{ marginTop: 4 }}>
            A future sell of {ticker} will consume the oldest lot first (FIFO cost basis).
          </p>
        </CollapsibleCard>
      ) : null}

      {position && (position.buyCount > 0 || position.sellCount > 0) && (
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>All-time stats</h4>} style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px,1fr))', gap: 8 }}>
            <div className="stat-card card" style={hueStyle(HUES[0])}>
              <div className="label">Bought / Sold</div>
              <div className="value">{fmt(position.totalBoughtShares, 0)} / {fmt(position.totalSoldShares, 0)}</div>
              <div className="sub">{position.buyCount} buys · {position.sellCount} sells</div>
            </div>
            {position.sellCount > 0 && (
              <div className="stat-card card" style={hueStyle(HUES[7])} title="Weighted average, and most recent, sell price for this ticker.">
                <div className="label">Sell price</div>
                <div className="value">{fmtPrice(avgSellPrice)}</div>
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

      {stats && (
        <CollapsibleCard title={<h4 style={{ margin: 0 }}>Price range</h4>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <div className="stat-card card" style={hueStyle(HUES[5])}><div className="label">Lowest</div><div className="value">{fmtPrice(stats.min)}</div><div className="sub">{stats.minDate}</div></div>
            <div className="stat-card card" style={hueStyle(HUES[1])} title="A simple fair-value estimate: the middle price across every update you've recorded for this ticker.">
              <div className="label">Median (fair value)</div>
              <div className="value">{fmtPrice(stats.median)}</div>
            </div>
            <div className="stat-card card" style={hueStyle(HUES[2])}><div className="label">Highest</div><div className="value">{fmtPrice(stats.max)}</div><div className="sub">{stats.maxDate}</div></div>
          </div>
          <details>
            <summary className="footer-note" style={{ cursor: 'pointer' }}>Recent updates ({stats.recent.length})</summary>
            <div className="table-scroll" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><RecentTh col="when">When</RecentTh><RecentTh col="price">Price</RecentTh></tr></thead>
                <tbody>
                  {sortedRecent.map((p, i) => (
                    <tr key={i}><td>{p.time ? new Date(p.time).toLocaleString() : p.date}</td><td>{fmtPrice(p.price)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn secondary small" style={{ marginTop: 8 }} onClick={exportPriceHistory}>Export price history CSV</button>
          </details>
        </CollapsibleCard>
      )}
    </div>
  );
}
