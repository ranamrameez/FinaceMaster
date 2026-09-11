import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { CollapsibleCard, StatCard } from '../../../components/Card';
import { Sparkline } from '../../../components/Sparkline';
import { TickerLogo } from '../../../components/TickerLogo';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, getDailyPriceHistory } from '../../../lib/calc';
import { pendingShareDeltaByTicker } from '../../../lib/calc/positions';
import { dimColor, dlBarV, dlDoughnut, dlLine, profitColor } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useAmountFormat } from '../../../hooks/useAmountFormat';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { AlertsBox, usePSXAlerts } from '../components/AlertsBox';
import { ChartCard } from '../../qse/components/ChartCard';
import { usePSXDerived } from '../hooks/usePSXDerived';
import { usePSXStockData } from '../hooks/usePSXStockData';
import { gridAutoStyle } from '../../../lib/gridStyle';

const INVEST_PALETTE = ['#3d4b58', '#c9a227', '#34c77b', '#3b6bd6', '#8a97a3', '#e5484d', '#7b5cd6', '#2ea3a3'];

function HoldingsCard() {
  const { workbook, positions, calcFee } = usePSXDerived();
  const { tickerNames } = usePSXStockData();
  const setMarketPrice = usePSXWorkbookStore((s) => s.setMarketPrice);
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
          const sellFee = mp > 0 ? calcFee(value, false, { shares: p.shares }) : 0;
          const profit = mp > 0 ? value - sellFee - p.invested : NaN;
          const profitPct = mp > 0 && p.invested > 0 ? (profit / p.invested) * 100 : NaN;
          const be = breakEvenPrice(p.invested, p.shares, feePct, tick, calcFee);
          const target = (pct: number) => breakEvenPrice(p.invested * (1 + pct / 100), p.shares, feePct, tick, calcFee);
          const sparkData = getDailyPriceHistory(p.ticker, workbook.priceHistory).map((pt) => pt.price);

          // Item 1 of a 2026-08-26 feedback batch: see the identical comment
          // in QSE's DashboardPage.tsx.
          let statusRank: number;
          let statusLabel: string;
          let statusClass: string;
          if (!Number.isFinite(profit)) {
            statusRank = 3; statusLabel = 'PRICE NEEDED'; statusClass = '';
          } else if (profit >= 0) {
            statusRank = 0; statusLabel = 'EXIT READY'; statusClass = 'pill-positive';
          } else if ((profit / p.invested) * 100 > -3) {
            statusRank = 1; statusLabel = 'WATCH'; statusClass = '';
          } else {
            statusRank = 2; statusLabel = 'HOLD / REVIEW'; statusClass = 'pill-negative';
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

  // User-requested (2026-09-08): "Also show a pending share-count delta" —
  // see QSE's DashboardPage.tsx's identical comment.
  const pendingDelta = useMemo(() => pendingShareDeltaByTicker(workbook.transactions), [workbook.transactions]);

  return (
    <CollapsibleCard
      style={{ marginBottom: 16, paddingBottom: 12 }}
      title={<h3 className="m-0">Holdings</h3>}
      headerExtra={<Link to="/psx/portfolio" className="text-muted">Full portfolio →</Link>}
    >
      {held.length ? (
        <div className="table-scroll table-compact mt-sm">
          <table className="holdings-table">
            <thead>
              <tr><Th col="ticker">Stock</Th><th>Trend</th><Th col="shares">Shares</Th><Th col="avgCost">Cost</Th><Th col="mp">Current Price</Th><Th col="value">Value</Th><Th col="profit">P/L</Th><th>Exit targets</th><Th col="status">Status</Th></tr>
            </thead>
            <tbody>
              {held.map((r) => (
                <tr key={r.ticker} className="clickable">
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)} style={{ maxWidth: 170 }}>
                    <div className="hd-name">
                      <TickerLogo ticker={r.ticker} size="sm" exchange="psx" />
                      <div>
                        <div>{r.ticker}</div>
                        <div className="hd-company">
                          {tickerNames[r.ticker] ? shortenCompanyName(tickerNames[r.ticker]) : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ width: 70 }}><Sparkline data={r.sparkData} formatValue={fmtPrice} width={56} height={20} /></td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)}>
                    {fmt(r.shares, 0)}
                    {!!pendingDelta[r.ticker] && (
                      <div className="text-muted" title="Placed but not yet filled orders for this ticker — shares will change by this much once they clear.">
                        {pendingDelta[r.ticker] > 0 ? '+' : ''}{fmt(pendingDelta[r.ticker], 0)} pending
                      </div>
                    )}
                  </td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)}>
                    <div>{fmtPrice(r.avgCost)}</div>
                    <div
                      className="text-muted"
                      style={{ color: r.mp > 0 ? (r.mp >= r.be ? 'var(--profit)' : 'var(--loss)') : undefined }}
                    >
                      BE {fmtPrice(r.be)}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      key={r.mp}
                      type="number"
                      step="0.01"
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
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)}>
                    <div>{r.mp > 0 ? fmtMoney(r.value, currency) : '—'}</div>
                    <div className="text-muted">
                      {r.mp > 0 && (r.value >= r.invested ? <span style={{ color: 'var(--profit)' }}>▲</span> : <span style={{ color: 'var(--loss)' }}>▼</span>)}
                      {' '}Inv {fmtMoney(r.invested, currency)}
                    </div>
                  </td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)} className={Number.isFinite(r.profit) ? (r.profit >= 0 ? 'pill-positive' : 'pill-negative') : ''}>
                    <div>{Number.isFinite(r.profit) ? fmtMoney(r.profit, currency) : '—'}</div>
                    <div className="text-muted">{Number.isFinite(r.profitPct) ? `${r.profitPct >= 0 ? '+' : ''}${r.profitPct.toFixed(1)}%` : ''}</div>
                  </td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)} className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                    +1% {fmtPrice(r.t1)}<br />+2% {fmtPrice(r.t2)}<br />+5% {fmtPrice(r.t3)}
                  </td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)} className={r.statusClass}>{r.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted">No open positions yet.</p>
      )}
    </CollapsibleCard>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { workbook, rows, summary, realizedSeries } = usePSXDerived();
  const currency = workbook.settings.currency;
  const alerts = usePSXAlerts();
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const { raw, money } = useAmountFormat();
  // Skips the tooltip in raw mode — the visible value already IS the full
  // precision, so a duplicate tooltip would be redundant (same reasoning
  // as MoneyValue's own raw-mode title skip).
  const moneyTitle = (n: number) => (raw ? undefined : fmtMoney(n, currency));
  const totalInvestment = rows.reduce((s, r) => s + r.invested, 0);
  const portfolioROIPct = totalInvestment > 0 ? (summary.unrealizedPL / totalInvestment) * 100 : 0;
  // User-requested (2026-09-08): "Current Deposit (Deposits - Withdrawals)
  // & Current Deposits vs Current NET Worth (Cash Bal + Port. value)."
  // Both fields already exist on `summary` (cashSummary() already computes
  // netWorth as cashBalance + portfolioValue, matching the user's own
  // definition exactly) — no new calc logic, just two new stat cards.
  const currentDeposit = summary.totalInward - summary.totalOutward;
  const growthVsDeposit = summary.netWorth - currentDeposit;

  // Pending item 17's hover-cross-highlighting: see the identical comment in
  // QSE's DashboardPage.tsx.
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickerHoverHandlers = (chartRows: typeof rows) => ({
    onClick: (_e: any, elements: any[]) => {
      const i = elements[0]?.index;
      if (i !== undefined && chartRows[i]) navigate(`/psx/stock/${chartRows[i].ticker}`);
    },
    onHover: (e: any, elements: any[]) => {
      if (e.native?.target) (e.native.target as HTMLElement).style.cursor = elements.length ? 'pointer' : 'default';
      const i = elements[0]?.index;
      setHoveredTicker(i !== undefined && chartRows[i] ? chartRows[i].ticker : null);
    },
  });

  useEffect(() => {
    if (alerts.length && !sessionStorage.getItem('psx-alerts-shown')) {
      sessionStorage.setItem('psx-alerts-shown', '1');
      toast(`${alerts.length} alert${alerts.length > 1 ? 's' : ''} need your attention — see Alerts below.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="pagetitle">PSX Dashboard</h1>

          <div className="grid-auto" style={{ ...gridAutoStyle(160, 12), marginBottom: 20 }}>
            <StatCard label="Net Worth" value={money(summary.netWorth, currency)} title={moneyTitle(summary.netWorth)} hue={INVEST_PALETTE[3]} />
            <StatCard
              label="Cash Balance"
              value={money(summary.cashBalance, currency)}
              title={moneyTitle(summary.cashBalance)}
              hue={INVEST_PALETTE[7]}
              sub={
                summary.pendingCashImpact !== 0
                  ? `${summary.pendingCashImpact > 0 ? '+' : ''}${money(summary.pendingCashImpact, currency)} pending orders → ${money(summary.cashBalance + summary.pendingCashImpact, currency)} incl. pending`
                  : undefined
              }
            />
            <StatCard label="Portfolio Value" value={money(summary.portfolioValue, currency)} title={moneyTitle(summary.portfolioValue)} hue={INVEST_PALETTE[6]} />
            <StatCard label="Realized P/L" value={money(summary.realizedPL, currency)} title={moneyTitle(summary.realizedPL)} hue={summary.realizedPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Profit or loss already locked in — from stock you've fully sold." />
            <StatCard label="Unrealized P/L" value={money(summary.unrealizedPL, currency)} title={moneyTitle(summary.unrealizedPL)} hue={summary.unrealizedPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Profit or loss on paper only — from stock you still hold, based on its current price." />
            <StatCard label="Net P/L" value={money(summary.netPL, currency)} title={moneyTitle(summary.netPL)} hue={summary.netPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Realized plus unrealized P/L combined — your total profit or loss so far." />
            <StatCard label="Total Deposits" value={money(summary.totalInward, currency)} title={moneyTitle(summary.totalInward)} hue={INVEST_PALETTE[1]} />
            <StatCard label="Total Withdrawals" value={money(summary.totalOutward, currency)} title={moneyTitle(summary.totalOutward)} hue={INVEST_PALETTE[5]} />
            <StatCard
              label="Current Deposit"
              value={money(currentDeposit, currency)}
              title={moneyTitle(currentDeposit)}
              hue={INVEST_PALETTE[1]}
              labelTitle="Total deposits minus total withdrawals — your net capital currently put into this account."
            />
            <StatCard
              label="Deposits vs. Net Worth"
              value={money(growthVsDeposit, currency)}
              title={moneyTitle(growthVsDeposit)}
              hue={growthVsDeposit >= 0 ? 'var(--profit)' : 'var(--loss)'}
              labelTitle="Current Net Worth (Cash Balance + Portfolio Value) minus Current Deposit — how much your account has grown (or shrunk) beyond what you've actually put in."
            />
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

          <div className="grid-auto" style={gridAutoStyle(320, 16)}>
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

          <CollapsibleCard style={{ marginTop: 16 }} title={<h3 className="m-0">Alerts</h3>} defaultOpen={false}>
            <AlertsBox />
          </CollapsibleCard>

          <div style={{ marginTop: 16, marginBottom:16, textAlign: 'center' }}>
            <Link to="/psx/analytics" className="btn secondary">
              View full analytics →
            </Link>
          </div>
    </div>
  );
}
