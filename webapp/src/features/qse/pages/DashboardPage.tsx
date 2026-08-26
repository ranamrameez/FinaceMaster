import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { CollapsibleCard, StatCard } from '../../../components/Card';
import { Sparkline } from '../../../components/Sparkline';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, getDailyPriceHistory } from '../../../lib/calc';
import { dimColor, dlBarV, dlDoughnut, dlLine, profitColor } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useWorkbookStore } from '../../../store/workbookStore';
import { useAmountFormat } from '../../../hooks/useAmountFormat';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { AlertsBox, useQSEAlerts } from '../components/AlertsBox';
import { ChartCard } from '../components/ChartCard';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';
import { useAppearanceStore } from '../../../store/appearanceStore';

const INVEST_PALETTE = ['#3d4b58', '#c9a227', '#34c77b', '#3b6bd6', '#8a97a3', '#e5484d', '#7b5cd6', '#2ea3a3'];

function HoldingsCard() {
  const { workbook, positions, calcFee } = useQSEDerived();
  const { tickerNames } = useQSEStockData();
  const setMarketPrice = useWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const navigate = useNavigate();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;

  const heldRaw = useMemo(
    () =>
      positions
        .filter((p) => p.shares > 0)
        .map((p) => {
          const mp = workbook.marketPrices[p.ticker] || 0;
          const avgCost = p.invested / p.shares;
          const value = p.shares * mp;
          const sellFee = mp > 0 ? calcFee(value, false) : 0;
          const profit = mp > 0 ? value - sellFee - p.invested : NaN;
          const profitPct = mp > 0 && p.invested > 0 ? (profit / p.invested) * 100 : NaN;
          const be = breakEvenPrice(p.invested, p.shares, feePct, tick, calcFee);
          const target = (pct: number) => breakEvenPrice(p.invested * (1 + pct / 100), p.shares, feePct, tick, calcFee);
          const sparkData = getDailyPriceHistory(p.ticker, workbook.priceHistory).map((pt) => pt.price);

          // Item 1 of a 2026-08-26 feedback batch: Portfolio's own Holdings
          // table (PortfolioPage.tsx) has Exit targets + Status columns
          // Dashboard's own copy never got — same status-threshold logic,
          // duplicated per exchange/page like the rest of this table's calc,
          // not factored out (matches the existing convention here).
          let statusRank: number;
          let statusLabel: string;
          let statusClass: string;
          if (!Number.isFinite(profit)) {
            statusRank = 3; statusLabel = 'PRICE NEEDED'; statusClass = '';
          } else if (profit >= 0) {
            statusRank = 0; statusLabel = 'EXIT READY'; statusClass = 'pill-buy';
          } else if ((profit / p.invested) * 100 > -3) {
            statusRank = 1; statusLabel = 'WATCH'; statusClass = '';
          } else {
            statusRank = 2; statusLabel = 'HOLD / REVIEW'; statusClass = 'pill-sell';
          }

          return {
            ticker: p.ticker, shares: p.shares, avgCost, mp, value, invested: p.invested, profit, profitPct, be, sparkData,
            t1: target(1), t2: target(2), t3: target(5), statusRank, statusLabel, statusClass,
          };
        }),
    [positions, workbook.marketPrices, workbook.priceHistory, calcFee, feePct, tick],
  );

  // Columns are grouped by related info rather than one fact per column
  // (user request, with a real competitor screenshot as the reference
  // point): "Cost" carries avg cost + break-even together, "Value" carries
  // current worth + invested + an up/down indicator together, "P/L" carries
  // the amount + percentage together — instead of five separate same-size
  // columns for numbers a reader mentally pairs up anyway.
  type Col = 'ticker' | 'shares' | 'avgCost' | 'mp' | 'value' | 'profit' | 'status';
  const sortValue = (r: (typeof heldRaw)[number], col: Col): number | string => {
    if (col === 'profit') return Number.isFinite(r.profit) ? r.profit : 0;
    if (col === 'value') return r.value;
    if (col === 'status') return r.statusRank;
    return r[col];
  };
  const { sorted: held, Th } = useSortableRows(heldRaw, sortValue, 'profit', 'desc');

  return (
    <CollapsibleCard
      style={{ marginBottom: 16, paddingBottom: 12 }}
      title={<h3 style={{ margin: 0 }}>Holdings</h3>}
      headerExtra={<Link to="/portfolio" className="footer-note">Full portfolio →</Link>}
    >
      {held.length ? (
        <div className="table-scroll table-compact" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr><Th col="ticker">Stock</Th><th>Trend</th><Th col="shares">Shares</Th><Th col="avgCost">Cost</Th><Th col="mp">Current Price</Th><Th col="value">Value</Th><Th col="profit">P/L</Th><th>Exit targets</th><Th col="status">Status</Th></tr>
            </thead>
            <tbody>
              {held.map((r) => (
                <tr key={r.ticker} style={{ cursor: 'pointer' }}>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} style={{ maxWidth: 170 }}>
                    <div style={{ fontWeight: 600 }}>{r.ticker}</div>
                    <div className="footer-note" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tickerNames[r.ticker] ? shortenCompanyName(tickerNames[r.ticker]) : ''}
                    </div>
                  </td>
                  <td style={{ width: 70 }}><Sparkline data={r.sparkData} formatValue={fmtPrice} width={56} height={20} /></td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)}>{fmt(r.shares, 0)}</td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)}>
                    <div>{fmtPrice(r.avgCost)}</div>
                    <div
                      className="footer-note"
                      style={{ color: r.mp > 0 ? (r.mp >= r.be ? 'var(--profit)' : 'var(--loss)') : undefined }}
                    >
                      BE {fmtPrice(r.be)}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      key={r.mp}
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
                  <td onClick={() => navigate(`/stock/${r.ticker}`)}>
                    <div>{r.mp > 0 ? fmtMoney(r.value, currency) : '—'}</div>
                    <div className="footer-note">
                      {r.mp > 0 && (r.value >= r.invested ? <span style={{ color: 'var(--profit)' }}>▲</span> : <span style={{ color: 'var(--loss)' }}>▼</span>)}
                      {' '}Inv {fmtMoney(r.invested, currency)}
                    </div>
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} className={Number.isFinite(r.profit) ? (r.profit >= 0 ? 'pill-buy' : 'pill-sell') : ''}>
                    <div>{Number.isFinite(r.profit) ? fmtMoney(r.profit, currency) : '—'}</div>
                    <div className="footer-note">{Number.isFinite(r.profitPct) ? `${r.profitPct >= 0 ? '+' : ''}${r.profitPct.toFixed(1)}%` : ''}</div>
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} className="footer-note" style={{ whiteSpace: 'nowrap' }}>
                    +1% {fmtPrice(r.t1)}<br />+2% {fmtPrice(r.t2)}<br />+5% {fmtPrice(r.t3)}
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} className={r.statusClass}>{r.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="footer-note">No open positions yet.</p>
      )}
    </CollapsibleCard>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { workbook, rows, summary, realizedSeries } = useQSEDerived();
  const currency = workbook.settings.currency;
  const alerts = useQSEAlerts();
  // Re-render (and so recompute chart colors from CSS vars) whenever the
  // user changes theme/color/density — chart.js options are only
  // recomputed on this component's own re-renders, not just because the
  // <html> attributes changed elsewhere.
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const { raw, money } = useAmountFormat();
  const moneyTitle = (n: number) => (raw ? undefined : fmtMoney(n, currency));
  const totalInvestment = rows.reduce((s, r) => s + r.invested, 0);
  const portfolioROIPct = totalInvestment > 0 ? (summary.unrealizedPL / totalInvestment) * 100 : 0;

  // Pending item 17's hover-cross-highlighting: hovering a ticker's slice/bar
  // in either chart dims every OTHER ticker in BOTH charts, so the two
  // per-ticker charts read as one linked view instead of two independent
  // ones. Shared at the page level (not per-chart state) since it needs to
  // affect both.
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.js's
  // real ChartEvent/ActiveElement[] types only resolve via react-chartjs-2's
  // contextual inference when the handler is written inline in the `options`
  // JSX prop (as done for onClick/onHover elsewhere in this file); a
  // standalone helper outside that context loses the inference entirely.
  const tickerHoverHandlers = (chartRows: typeof rows) => ({
    onClick: (_e: any, elements: any[]) => {
      const i = elements[0]?.index;
      if (i !== undefined && chartRows[i]) navigate(`/stock/${chartRows[i].ticker}`);
    },
    onHover: (e: any, elements: any[]) => {
      if (e.native?.target) (e.native.target as HTMLElement).style.cursor = elements.length ? 'pointer' : 'default';
      const i = elements[0]?.index;
      setHoveredTicker(i !== undefined && chartRows[i] ? chartRows[i].ticker : null);
    },
  });

  // Auto-hide popup once per browser session on first Dashboard visit,
  // summarizing alerts — the persistent Alerts card further down stays
  // available any time after that.
  useEffect(() => {
    if (alerts.length && !sessionStorage.getItem('qse-alerts-shown')) {
      sessionStorage.setItem('qse-alerts-shown', '1');
      toast(`${alerts.length} alert${alerts.length > 1 ? 's' : ''} need your attention — see Alerts below.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="pagetitle">Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Net Worth" value={money(summary.netWorth, currency)} title={moneyTitle(summary.netWorth)} hue={INVEST_PALETTE[3]} />
        <StatCard label="Cash Balance" value={money(summary.cashBalance, currency)} title={moneyTitle(summary.cashBalance)} hue={INVEST_PALETTE[7]} />
        <StatCard label="Portfolio Value" value={money(summary.portfolioValue, currency)} title={moneyTitle(summary.portfolioValue)} hue={INVEST_PALETTE[6]} />
        <StatCard label="Realized P/L" value={money(summary.realizedPL, currency)} title={moneyTitle(summary.realizedPL)} hue={summary.realizedPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Profit or loss already locked in — from stock you've fully sold." />
        <StatCard label="Unrealized P/L" value={money(summary.unrealizedPL, currency)} title={moneyTitle(summary.unrealizedPL)} hue={summary.unrealizedPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Profit or loss on paper only — from stock you still hold, based on its current price." />
        <StatCard label="Net P/L" value={money(summary.netPL, currency)} title={moneyTitle(summary.netPL)} hue={summary.netPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Realized plus unrealized P/L combined — your total profit or loss so far." />
        <StatCard label="Total Deposits" value={money(summary.totalInward, currency)} title={moneyTitle(summary.totalInward)} hue={INVEST_PALETTE[1]} />
        <StatCard label="Total Withdrawals" value={money(summary.totalOutward, currency)} title={moneyTitle(summary.totalOutward)} hue={INVEST_PALETTE[5]} />
        <StatCard label="Total Fees" value={money(summary.totalCharges, currency)} title={moneyTitle(summary.totalCharges)} hue={INVEST_PALETTE[4]} />
        <StatCard label="Rewards" value={money(summary.totalRewards, currency)} title={moneyTitle(summary.totalRewards)} hue={INVEST_PALETTE[2]} />
        <StatCard label="Open Positions" value={fmt(rows.length, 0)} hue={INVEST_PALETTE[0]} title="Number of distinct tickers you currently hold shares in." />
        <StatCard
          label="Portfolio ROI"
          value={`${portfolioROIPct.toFixed(1)}%`}
          hue={portfolioROIPct >= 0 ? 'var(--profit)' : 'var(--loss)'}
          title="Unrealized P/L divided by total invested capital in your open positions — doesn't include realized gains/losses from closed trades."
        />
      </div>

      <HoldingsCard />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <ChartCard title="Allocation by ticker (cost basis)" empty={!rows.length}>
          <Doughnut
            data={{
              labels: rows.map((r) => r.ticker),
              datasets: [{
                data: rows.map((r) => r.invested),
                backgroundColor: rows.map((r, i) => dimColor(INVEST_PALETTE[i % INVEST_PALETTE.length], !!hoveredTicker && hoveredTicker !== r.ticker)),
              }],
            }}
            options={{
              ...tickerHoverHandlers(rows),
              plugins: { datalabels: dlDoughnut((v) => fmt(v, 2)) },
            }}
          />
        </ChartCard>

        <ChartCard title="P/L by ticker" empty={!rows.length}>
          <Bar
            data={{
              labels: rows.map((r) => r.ticker),
              datasets: [{
                data: rows.map((r) => r.profit),
                backgroundColor: rows.map((r) => dimColor(profitColor(r.profit), !!hoveredTicker && hoveredTicker !== r.ticker)),
              }],
            }}
            options={{
              ...tickerHoverHandlers(rows),
              plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmt(v, 2)) },
            }}
          />
        </ChartCard>

        <ChartCard title="Realized P/L over time" empty={!realizedSeries.length}>
          <Line
            data={{
              labels: realizedSeries.map((p) => p.date),
              datasets: [
                {
                  label: `Realized P/L (${currency})`,
                  data: realizedSeries.map((p) => p.value),
                  borderColor: profitColor(realizedSeries[realizedSeries.length - 1]?.value || 0),
                  backgroundColor: 'rgba(201,163,90,0.15)',
                  fill: true,
                  tension: 0.2,
                },
              ],
            }}
            options={{ plugins: { legend: { display: false }, datalabels: dlLine((v) => fmt(v, 2)) } }}
          />
        </ChartCard>
      </div>

      <CollapsibleCard style={{ marginTop: 16 }} title={<h3 style={{ margin: 0 }}>Alerts</h3>} defaultOpen={false}>
        <AlertsBox />
      </CollapsibleCard>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link to="/analytics" className="btn secondary">
          View full analytics →
        </Link>
      </div>
    </div>
  );
}
