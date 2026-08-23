import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkline } from '../../../components/Sparkline';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, getDailyPriceHistory, getMarketPrice } from '../../../lib/calc';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';

type SortCol = 'ticker' | 'market' | 'be' | 'net' | 't1' | 't2' | 't3' | 'status';

function OpenPositionsTable({ onSelect }: { onSelect: (ticker: string) => void }) {
  const { workbook, positions, calcFee } = useQSEDerived();
  const { tickerNames } = useQSEStockData();
  const setMarketPrice = useWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'status', dir: 'desc' });

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
            be, net, t1: target(1), t2: target(2), t3: target(5),
            statusRank, statusLabel, statusClass,
          };
        }),
    [positions, workbook.marketPrices, workbook.transactions, workbook.priceHistory, calcFee, feePct, tick],
  );

  const sortValue = (r: (typeof rows)[number], col: SortCol): number | string => {
    switch (col) {
      case 'market': return r.hasMarket ? r.mp : -Infinity;
      case 'be': return r.be;
      case 'net': return Number.isFinite(r.net) ? r.net : -Infinity;
      case 't1': return r.t1;
      case 't2': return r.t2;
      case 't3': return r.t3;
      case 'status': return r.statusRank;
      default: return r.ticker;
    }
  };
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sort.col);
      const bv = sortValue(b, sort.col);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);
  const toggleSort = (col: SortCol) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'ticker' ? 'asc' : 'desc' }));
  const arrow = (col: SortCol) => (sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const th = (col: SortCol, label: string) => (
    <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer' }}>{label}{arrow(col)}</th>
  );

  if (!sorted.length) return <p className="footer-note">No open positions.</p>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {th('ticker', 'Ticker')}
            <th>Trend</th>
            <th>Shares</th>
            <th>Avg Cost</th>
            {th('market', 'Market Price')}
            {th('be', 'Break-even')}
            {th('net', 'Net P/L')}
            {th('t1', '+1% exit')}
            {th('t2', '+2% exit')}
            {th('t3', '+5% exit')}
            {th('status', 'Status')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.ticker} style={{ cursor: 'pointer' }}>
              <td onClick={() => onSelect(r.ticker)}>{r.ticker} <span className="footer-note">{tickerNames[r.ticker] ? shortenCompanyName(tickerNames[r.ticker]) : ''}</span></td>
              <td onClick={(e) => e.stopPropagation()}><Sparkline data={r.sparkData} formatValue={fmtPrice} /></td>
              <td onClick={() => onSelect(r.ticker)}>{fmt(r.shares, 0)}</td>
              <td onClick={() => onSelect(r.ticker)}>{fmtPrice(r.avgCost)}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  step="0.001"
                  defaultValue={r.mp || ''}
                  placeholder="—"
                  style={{ width: 80 }}
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
              <td onClick={() => onSelect(r.ticker)}>{fmtPrice(r.be)}</td>
              <td onClick={() => onSelect(r.ticker)} className={Number.isFinite(r.net) ? (r.net >= 0 ? 'pill-buy' : 'pill-sell') : ''}>
                {Number.isFinite(r.net) ? fmtMoney(r.net, currency) : '—'}
              </td>
              <td onClick={() => onSelect(r.ticker)}>{fmtPrice(r.t1)}</td>
              <td onClick={() => onSelect(r.ticker)}>{fmtPrice(r.t2)}</td>
              <td onClick={() => onSelect(r.ticker)}>{fmtPrice(r.t3)}</td>
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

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Ticker</th><th>Name</th><th>Bought</th><th>Sold</th><th>Realized P/L</th><th>Fees paid</th><th>First trade</th><th>Last trade</th></tr>
        </thead>
        <tbody>
          {closed.map((p) => (
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
          {!closed.length && (
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
      <Tabs
        tabs={[
          { key: 'open', label: 'Holdings', content: <OpenPositionsTable onSelect={goToStock} /> },
          { key: 'closed', label: 'History', content: <ClosedPositionsTable onSelect={goToStock} /> },
        ]}
      />
    </div>
  );
}
