import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QSE_TICKER_DATALIST_ID } from '../../../components/TickerDatalist';
import { PlusIcon, TrashIcon } from '../../../components/icons';
import { Sparkline } from '../../../components/Sparkline';
import { toast } from '../../../components/Toast';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { getDailyPriceHistory } from '../../../lib/calc';
import { fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useWorkbookStore } from '../../../store/workbookStore';
import type { Workbook, WatchlistItem } from '../../../types/workbook';
import { useQSEStockData } from '../hooks/useQSEStockData';

export function WatchlistPage() {
  const workbook = useWorkbookStore((s) => s.workbook);
  const addWatchlistItem = useWorkbookStore((s) => s.addWatchlistItem);
  const updateWatchlistItem = useWorkbookStore((s) => s.updateWatchlistItem);
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
          className="price-input"
          placeholder="Target price"
          value={w.target || ''}
          onChange={(e) => setW({ ...w, target: Number(e.target.value) })}
          style={{ width: 120 }}
        />
        <input
          type="number"
          step="0.001"
          className="price-input"
          placeholder="Current price"
          value={w.current || ''}
          onChange={(e) => setW({ ...w, current: Number(e.target.value) })}
          style={{ width: 120 }}
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
          <PlusIcon />Add
        </button>
      </div>

      <WatchlistTable workbook={workbook} tickerNames={tickerNames} updateWatchlistItem={updateWatchlistItem} removeWatchlistItem={removeWatchlistItem} />
    </div>
  );
}

function WatchlistTable({
  workbook,
  tickerNames,
  updateWatchlistItem,
  removeWatchlistItem,
}: {
  workbook: Workbook;
  tickerNames: Record<string, string>;
  updateWatchlistItem: (ticker: string, patch: Partial<WatchlistItem>) => void;
  removeWatchlistItem: (ticker: string) => void;
}) {
  const rows = workbook.watchlist.map((item) => {
    const gap = item.current && item.target ? ((item.current - item.target) / item.target) * 100 : null;
    const sparkData = getDailyPriceHistory(item.ticker, workbook.priceHistory).map((p) => p.price);
    return { item, gap, sparkData };
  });

  type WatchCol = 'ticker' | 'name' | 'target' | 'current' | 'gap';
  const sortValue = (r: (typeof rows)[number], col: WatchCol): number | string => {
    switch (col) {
      case 'name': return tickerNames[r.item.ticker] ? shortenCompanyName(tickerNames[r.item.ticker]) : '';
      case 'target': return r.item.target;
      case 'current': return r.item.current ?? -Infinity;
      case 'gap': return r.gap ?? Infinity;
      default: return r.item.ticker;
    }
  };
  const { sorted, Th } = useSortableRows(rows, sortValue, 'ticker', 'asc');

  return (
    <div className="table-scroll" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <Th col="ticker">Ticker</Th>
            <Th col="name">Name</Th>
            <th>Trend</th>
            <Th col="target">Target</Th>
            <Th col="current">Current</Th>
            <Th col="gap">Gap</Th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ item, gap, sparkData }) => (
            <tr key={item.ticker}>
              <td><Link to={`/stock/${item.ticker}`}>{item.ticker}</Link></td>
              <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tickerNames[item.ticker] ? shortenCompanyName(tickerNames[item.ticker]) : ''}</td>
              <td style={{ width: 82 }}><Sparkline data={sparkData} formatValue={fmtPrice} /></td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  className="price-input"
                  value={item.target || ''}
                  onChange={(e) => updateWatchlistItem(item.ticker, { target: Number(e.target.value) })}
                  style={{ width: 100 }}
                  title="Edit target price"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.001"
                  className="price-input"
                  value={item.current || ''}
                  onChange={(e) => updateWatchlistItem(item.ticker, { current: Number(e.target.value) })}
                  style={{ width: 100 }}
                  title="Edit current price"
                />
              </td>
              <td className={gap !== null && gap <= 0 ? 'pill-buy' : ''}>{gap !== null ? `${gap.toFixed(1)}%` : '—'}</td>
              <td>
                <button className="btn secondary small" onClick={() => removeWatchlistItem(item.ticker)}>
                  <TrashIcon size={12} />Remove
                </button>
              </td>
            </tr>
          ))}
          {!sorted.length && (
            <tr>
              <td colSpan={7} className="footer-note">
                Watchlist is empty.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
