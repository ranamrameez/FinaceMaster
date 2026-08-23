import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QSE_TICKER_DATALIST_ID } from '../../../components/TickerDatalist';
import { Sparkline } from '../../../components/Sparkline';
import { toast } from '../../../components/Toast';
import { getDailyPriceHistory } from '../../../lib/calc';
import { fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useWorkbookStore } from '../../../store/workbookStore';
import type { WatchlistItem } from '../../../types/workbook';
import { useQSEStockData } from '../hooks/useQSEStockData';

export function WatchlistPage() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const addWatchlistItem = useWorkbookStore((s) => s.addWatchlistItem);
  const removeWatchlistItem = useWorkbookStore((s) => s.removeWatchlistItem);
  const { tickerNames } = useQSEStockData();
  const ensureSignedIn = useEnsureSignedIn();
  const [w, setW] = useState<WatchlistItem>({ ticker: '', target: 0, current: 0 });

  return (
    <div>
      <h1 className="pagetitle">Watchlist</h1>

      <h3>Add to watchlist</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="Ticker"
          value={w.ticker}
          onChange={(e) => setW({ ...w, ticker: e.target.value.toUpperCase() })}
          list={QSE_TICKER_DATALIST_ID}
          style={{ width: 90 }}
        />
        <input
          type="number"
          step="0.001"
          placeholder="Target price"
          value={w.target || ''}
          onChange={(e) => setW({ ...w, target: Number(e.target.value) })}
          style={{ width: 110 }}
        />
        <input
          type="number"
          step="0.001"
          placeholder="Current price"
          value={w.current || ''}
          onChange={(e) => setW({ ...w, current: Number(e.target.value) })}
          style={{ width: 110 }}
        />
        <button
          className="btn"
          onClick={async () => {
            if (!w.ticker) return toast('Enter a ticker.');
            if (!(await ensureSignedIn('Sign in to save your watchlist.'))) return;
            addWatchlistItem(w);
            toast(`${w.ticker} added to watchlist.`);
            setW({ ticker: '', target: 0, current: 0 });
          }}
        >
          Add
        </button>
      </div>

      <div className="table-scroll" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th>Trend</th>
              <th>Target</th>
              <th>Current</th>
              <th>Gap</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workbook.watchlist.map((item) => {
              const gap = item.current && item.target ? ((item.current - item.target) / item.target) * 100 : null;
              const sparkData = getDailyPriceHistory(item.ticker, workbook.priceHistory).map((p) => p.price);
              return (
                <tr key={item.ticker}>
                  <td><Link to={`/stock/${item.ticker}`}>{item.ticker}</Link></td>
                  <td>{tickerNames[item.ticker] ? shortenCompanyName(tickerNames[item.ticker]) : ''}</td>
                  <td><Sparkline data={sparkData} formatValue={fmtPrice} /></td>
                  <td>{fmtPrice(item.target)}</td>
                  <td>{item.current ? fmtPrice(item.current) : '—'}</td>
                  <td className={gap !== null && gap <= 0 ? 'pill-buy' : ''}>{gap !== null ? `${gap.toFixed(1)}%` : '—'}</td>
                  <td>
                    <button className="btn secondary small" onClick={() => removeWatchlistItem(item.ticker)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {!workbook.watchlist.length && (
              <tr>
                <td colSpan={7} className="footer-note">
                  Watchlist is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
