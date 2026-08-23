import { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { SaveIcon } from '../../../components/icons';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, computePriceStats, getMarketPrice } from '../../../lib/calc';
import { calcCGT } from '../../../lib/calc/psxFees';
import { applyChartTheme } from '../../../lib/chartSetup';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
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
  const lastSellPrice = [...workbook.transactions].filter((t) => t.ticker === ticker && t.action === 'SELL').sort((a, b) => a.date.localeCompare(b.date)).pop()?.price || 0;
  const holdingDays = position
    ? Math.max(0, Math.round((new Date(position.lastDate).getTime() - new Date(position.firstDate).getTime()) / 86400000))
    : 0;

  const stats = computePriceStats(ticker, workbook.priceHistory);

  const grossValue = isOpen && mp > 0 ? shares * mp : 0;
  const estSellFee = grossValue > 0 ? calcFee(grossValue, false, { shares }) : 0;
  const estGain = grossValue > 0 ? grossValue - estSellFee - invested : 0;
  const estCGT = estGain > 0 ? calcCGT(estGain, workbook.settings) : 0;

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
          step="0.01"
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
            {grossValue > 0 && (
              <div className="stat-card card">
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
        </>
      )}

      {lots[ticker]?.length ? (
        <>
          <h4 style={{ marginTop: 16 }}>Open lots (FIFO)</h4>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Buy date</th><th>Buy price</th><th>Remaining</th><th>Cost/share</th></tr></thead>
              <tbody>
                {lots[ticker].map((lot, i) => (
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
        </>
      ) : null}

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
