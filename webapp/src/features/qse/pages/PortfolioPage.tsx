import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkline } from '../../../components/Sparkline';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { breakEvenPrice, getDailyPriceHistory, getMarketPrice } from '../../../lib/calc';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';

type SortCol = 'ticker' | 'shares' | 'avgCost' | 'market' | 'net' | 'status';

function OpenPositionsTable({ onSelect }: { onSelect: (ticker: string) => void }) {
  const { workbook, positions, calcFee } = useQSEDerived();
  const { tickerNames } = useQSEStockData();
  const setMarketPrice = useWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;

  // Merges what used to be a separate "Exit Board" (break-even / +1% / +2%
  // / +5% exit targets, status) directly into the holdings table — same
  // position data shown twice across two pages was exactly the kind of
  // duplication worth removing.
  const rows = useMemo(
    () =>
      positions
        .filter((p) => p.shares > 0)
        .map((p) => {
          const mp = getMarketPrice(p.ticker, workbook.marketPrices, workbook.transactions);
          const hasMarket = mp > 0;
          const avgCost = p.invested / p.shares;
          const gross = hasMarket ? mp * p.shares : 0;
          const sellFee = hasMarket ? calcFee(gross, false) : 0;
          const net = hasMarket ? gross - sellFee - p.invested : NaN;
          const netPct = hasMarket && p.invested > 0 ? (net / p.invested) * 100 : NaN;
          const be = breakEvenPrice(p.invested, p.shares, feePct, tick, calcFee);
          const target = (pct: number) => breakEvenPrice(p.invested * (1 + pct / 100), p.shares, feePct, tick, calcFee);
          const sparkData = getDailyPriceHistory(p.ticker, workbook.priceHistory).map((pt) => pt.price);

          let statusRank: number;
          let statusLabel: string;
          let statusClass: string;
          if (!Number.isFinite(net)) {
            statusRank = 3; statusLabel = 'PRICE NEEDED'; statusClass = '';
          } else if (net >= 0) {
            statusRank = 0; statusLabel = 'EXIT READY'; statusClass = 'pill-buy';
          } else if ((net / p.invested) * 100 > -3) {
            statusRank = 1; statusLabel = 'WATCH'; statusClass = '';
          } else {
            statusRank = 2; statusLabel = 'HOLD / REVIEW'; statusClass = 'pill-sell';
          }

          return {
            ticker: p.ticker, shares: p.shares, invested: p.invested, avgCost, mp, hasMarket, sparkData,
            be, net, netPct, t1: target(1), t2: target(2), t3: target(5),
            statusRank, statusLabel, statusClass,
          };
        }),
    [positions, workbook.marketPrices, workbook.transactions, workbook.priceHistory, calcFee, feePct, tick],
  );

  const sortValue = (r: (typeof rows)[number], col: SortCol): number | string => {
    switch (col) {
      case 'shares': return r.shares;
      case 'avgCost': return r.avgCost;
      case 'market': return r.hasMarket ? r.mp : -Infinity;
      case 'net': return Number.isFinite(r.net) ? r.net : -Infinity;
      case 'status': return r.statusRank;
      default: return r.ticker;
    }
  };
  const { sorted, Th } = useSortableRows(rows, sortValue, 'status', 'desc');

  if (!sorted.length) return <p className="footer-note">No open positions.</p>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="ticker">Stock</Th>
            <th>Trend</th>
            <Th col="shares">Shares</Th>
            <Th col="avgCost">Cost</Th>
            <Th col="market">Market Price</Th>
            <Th col="net">P/L</Th>
            <th>Exit targets</th>
            <Th col="status">Status</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.ticker} style={{ cursor: 'pointer' }}>
              <td onClick={() => onSelect(r.ticker)} style={{ maxWidth: 190 }}>
                <div style={{ fontWeight: 600 }}>{r.ticker}</div>
                <div className="footer-note" style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tickerNames[r.ticker] ? shortenCompanyName(tickerNames[r.ticker]) : ''}
                </div>
              </td>
              <td onClick={(e) => e.stopPropagation()} style={{ width: 82 }}><Sparkline data={r.sparkData} formatValue={fmtPrice} /></td>
              <td onClick={() => onSelect(r.ticker)}>{fmt(r.shares, 0)}</td>
              <td onClick={() => onSelect(r.ticker)}>
                <div>{fmtPrice(r.avgCost)}</div>
                <div className="footer-note" style={{ color: r.hasMarket ? (r.mp >= r.be ? 'var(--profit)' : 'var(--loss)') : undefined }}>
                  BE {fmtPrice(r.be)}
                </div>
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  step="0.001"
                  className="price-input"
                  defaultValue={r.mp || ''}
                  placeholder="—"
                  style={{ width: 96 }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      const val = parseFloat(target.value) || 0;
                      if (val > 0 && (await ensureSignedIn('Sign in to save price updates.'))) {
                        setMarketPrice(r.ticker, val);
                        toast(`${r.ticker} price saved: ${fmtPrice(val)}`);
                      }
                      target.blur();
                    }
                  }}
                />
              </td>
              <td onClick={() => onSelect(r.ticker)} className={Number.isFinite(r.net) ? (r.net >= 0 ? 'pill-buy' : 'pill-sell') : ''}>
                <div>{Number.isFinite(r.net) ? fmtMoney(r.net, currency) : '—'}</div>
                <div className="footer-note">{Number.isFinite(r.netPct) ? `${r.netPct >= 0 ? '+' : ''}${r.netPct.toFixed(1)}%` : ''}</div>
              </td>
              <td onClick={() => onSelect(r.ticker)} className="footer-note" style={{ whiteSpace: 'nowrap' }}>
                +1% {fmtPrice(r.t1)}<br />+2% {fmtPrice(r.t2)}<br />+5% {fmtPrice(r.t3)}
              </td>
              <td onClick={() => onSelect(r.ticker)} className={r.statusClass}>{r.statusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClosedPositionsTable({ onSelect }: { onSelect: (ticker: string) => void }) {
  const { workbook, positions } = useQSEDerived();
  const { tickerNames } = useQSEStockData();
  const currency = workbook.settings.currency;
  const closed = positions.filter((p) => p.shares === 0 && p.sellCount > 0);

  type ClosedCol = 'ticker' | 'name' | 'bought' | 'sold' | 'realized' | 'fees' | 'first' | 'last';
  const sortValue = (p: (typeof closed)[number], col: ClosedCol): number | string => {
    switch (col) {
      case 'name': return tickerNames[p.ticker] ? shortenCompanyName(tickerNames[p.ticker]) : '';
      case 'bought': return p.totalBoughtShares;
      case 'sold': return p.totalSoldShares;
      case 'realized': return p.realized;
      case 'fees': return p.buyFees + p.sellFees;
      case 'first': return p.firstDate;
      case 'last': return p.lastDate;
      default: return p.ticker;
    }
  };
  const { sorted, Th } = useSortableRows(closed, sortValue, 'last', 'desc');

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <Th col="ticker">Ticker</Th>
            <Th col="name">Name</Th>
            <Th col="bought">Bought</Th>
            <Th col="sold">Sold</Th>
            <Th col="realized">Realized P/L</Th>
            <Th col="fees">Fees paid</Th>
            <Th col="first">First trade</Th>
            <Th col="last">Last trade</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.ticker} style={{ cursor: 'pointer' }} onClick={() => onSelect(p.ticker)}>
              <td>{p.ticker}</td>
              <td>{tickerNames[p.ticker] ? shortenCompanyName(tickerNames[p.ticker]) : ''}</td>
              <td>{fmt(p.totalBoughtShares, 0)}</td>
              <td>{fmt(p.totalSoldShares, 0)}</td>
              <td className={p.realized >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(p.realized, currency)}</td>
              <td>{fmtMoney(p.buyFees + p.sellFees, currency)}</td>
              <td>{p.firstDate}</td>
              <td>{p.lastDate}</td>
            </tr>
          ))}
          {!sorted.length && (
            <tr><td colSpan={8} className="footer-note">No closed positions yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PortfolioPage() {
  const navigate = useNavigate();
  const goToStock = (ticker: string) => navigate(`/stock/${ticker}`);

  return (
    <div>
      <h1 className="pagetitle">Portfolio</h1>
      <p className="pagesub">Open positions and closed trade history.</p>
      <Tabs
        tabs={[
          { key: 'open', label: 'Holdings', content: <OpenPositionsTable onSelect={goToStock} /> },
          { key: 'closed', label: 'History', content: <ClosedPositionsTable onSelect={goToStock} /> },
        ]}
      />
    </div>
  );
}
