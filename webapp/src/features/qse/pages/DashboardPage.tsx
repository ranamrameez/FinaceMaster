import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { CollapsibleCard, StatCard } from '../../../components/Card';
import { Sparkline } from '../../../components/Sparkline';
import { TickerLogo } from '../../../components/TickerLogo';
import { RoundTripCostModal } from '../../../components/RoundTripCostModal';
import { StatSourceBadge } from '../../../components/StatSourceBadge';
import { Tabs } from '../../../components/Tabs';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, getDailyPriceHistory } from '../../../lib/calc';
import { pendingShareDeltaByTicker } from '../../../lib/calc/positions';
import { perShareCommission } from '../../../lib/calc/partialTradeStrategy';
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
import { useQSEStrategicDerived } from '../hooks/useQSEStrategicDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { gridAutoStyle } from '../../../lib/gridStyle';

const INVEST_PALETTE = ['#3d4b58', '#c9a227', '#34c77b', '#3b6bd6', '#8a97a3', '#e5484d', '#7b5cd6', '#2ea3a3'];

type PositionsViewProps = Pick<
  ReturnType<typeof useQSEDerived>,
  'workbook' | 'calcFee' | 'positions' | 'rows' | 'summary' | 'realizedSeries'
>;

/** Shared by both Dashboard tabs — "Broker Style" (official numbers, fed
 * from `useQSEDerived()`) and "Strategic Trades" (a `'lowestCostFirst'`
 * what-if view, fed from `useQSEStrategicDerived()`). Verified to be a pure
 * data swap: `PartialTradeAdvisor`'s lot-level "Sell this lot" action
 * doesn't apply here since Dashboard has no Trade Plan context, so there's
 * no UI/action difference between the two tabs beyond which numbers are
 * shown. Every other Dashboard stat (Net Worth, Cash Balance, deposits,
 * fees, rewards, open-position count) is identical regardless of which lot
 * a sale is attributed to, so those stay in the page's own unified grid,
 * outside this component. */
function DashboardPositionsView({ workbook, calcFee, positions, rows, summary, realizedSeries }: PositionsViewProps) {
  const navigate = useNavigate();
  const { tickerNames } = useQSEStockData();
  const setMarketPrice = useWorkbookStore((s) => s.setMarketPrice);
  const ensureSignedIn = useEnsureSignedIn();
  const { money } = useAmountFormat();
  const currency = workbook.settings.currency;
  const { feePct, tick } = workbook.settings;

  const totalInvestment = rows.reduce((s, r) => s + r.invested, 0);
  const portfolioROIPct = totalInvestment > 0 ? (summary.unrealizedPL / totalInvestment) * 100 : 0;

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
          const rt = mp > 0 ? perShareCommission(mp, calcFee) : null;

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
            ticker: p.ticker, shares: p.shares, avgCost, mp, value, invested: p.invested, profit, profitPct, be, sparkData, rt,
            t1: target(1), t2: target(2), t3: target(5), statusRank, statusLabel, statusClass,
          };
        }),
    [positions, workbook.marketPrices, workbook.priceHistory, calcFee, feePct, tick],
  );

  type Col = 'ticker' | 'shares' | 'avgCost' | 'mp' | 'value' | 'profit' | 'status';
  const sortValue = (r: (typeof heldRaw)[number], col: Col): number | string => {
    if (col === 'profit') return Number.isFinite(r.profit) ? r.profit : 0;
    if (col === 'value') return r.value;
    if (col === 'status') return r.statusRank;
    return r[col];
  };
  const { sorted: held, Th } = useSortableRows(heldRaw, sortValue, 'value', 'desc');

  const pendingDelta = useMemo(() => pendingShareDeltaByTicker(workbook.transactions), [workbook.transactions]);
  const [rtTicker, setRtTicker] = useState<string | null>(null);
  const rtRow = rtTicker ? held.find((r) => r.ticker === rtTicker) : undefined;

  // Own local cross-highlight state, scoped to just this tab's own two
  // ticker charts — no established need to link a hover in one tab's chart
  // to the other, currently-collapsed tab's chart.
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see the
  // identical comment on DashboardPage's own tickerHoverHandlers below.
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

  return (
    <div>
      <div className="grid-auto" style={{ ...gridAutoStyle(160, 12), marginBottom: 20 }}>
        <StatCard label="Realized P/L" value={money(summary.realizedPL, currency)} title={fmtMoney(summary.realizedPL, currency)} hue={summary.realizedPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Profit or loss already locked in — from stock you've fully sold." />
        <StatCard label="Unrealized P/L" value={money(summary.unrealizedPL, currency)} title={fmtMoney(summary.unrealizedPL, currency)} hue={summary.unrealizedPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Profit or loss on paper only — from stock you still hold, based on its current price." />
        <StatCard label="Net P/L" value={money(summary.netPL, currency)} title={fmtMoney(summary.netPL, currency)} hue={summary.netPL >= 0 ? 'var(--profit)' : 'var(--loss)'} labelTitle="Realized plus unrealized P/L combined — your total profit or loss so far." />
        <StatCard
          label="Portfolio ROI"
          value={`${portfolioROIPct.toFixed(1)}%`}
          hue={portfolioROIPct >= 0 ? 'var(--profit)' : 'var(--loss)'}
          title="Unrealized P/L divided by total invested capital in your open positions — doesn't include realized gains/losses from closed trades."
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 className="m-0">Holdings</h4>
        <Link to="/portfolio" className="text-muted">Full portfolio →</Link>
      </div>
      {held.length ? (
        <div className="table-scroll table-compact mt-sm">
          <table className="holdings-table">
            <thead>
              <tr><Th col="ticker">Stock</Th><th>Trend</th><Th col="shares">Shares</Th><Th col="avgCost">Cost</Th><Th col="mp">Current Price</Th><Th col="value">Value</Th><Th col="profit">Unrealized P/L</Th><th>Exit targets</th><Th col="status">Status</Th></tr>
            </thead>
            <tbody>
              {held.map((r) => (
                <tr key={r.ticker} className="clickable">
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} style={{ maxWidth: 170 }}>
                    <div className="hd-name">
                      <TickerLogo ticker={r.ticker} size="sm" exchange="qse" />
                      <div>
                        <div>{r.ticker}</div>
                        <div className="hd-company">
                          {tickerNames[r.ticker] ? shortenCompanyName(tickerNames[r.ticker]) : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="w-70"><Sparkline data={r.sparkData} formatValue={fmtPrice} width={56} height={20} /></td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)}>
                    <span className="shares-box">{fmt(r.shares, 0)}</span>
                    {!!pendingDelta[r.ticker] && (
                      <div className="text-muted" title="Placed but not yet filled orders for this ticker — shares will change by this much once they clear.">
                        {pendingDelta[r.ticker] > 0 ? '+' : ''}{fmt(pendingDelta[r.ticker], 0)} pending
                      </div>
                    )}
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)}>
                    <div>{fmtPrice(r.avgCost)}</div>
                    <div
                      className="text-muted"
                      style={{ color: r.mp > 0 ? (r.mp >= r.be ? 'var(--profit)' : 'var(--loss)') : undefined }}
                    >
                      BE {fmtPrice(r.be)}
                    </div>
                    {r.rt && (
                      <div
                        className="text-muted clickable"
                        onClick={(e) => { e.stopPropagation(); setRtTicker(r.ticker); }}
                        title="Total to trade a round trip right now: current price + round-trip commission — click for the full breakdown."
                      >
                        RT {fmtMoney(r.mp + r.rt.buy + r.rt.sell, currency)}
                      </div>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      key={r.mp}
                      type="number"
                      step="0.001"
                      className="price-input w-96"
                      defaultValue={r.mp || ''}
                      placeholder="—"

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
                    {r.rt && (
                      <div
                        className="text-muted clickable"
                        onClick={() => setRtTicker(r.ticker)}
                        title="Round-trip commission cost (buy + sell) at the current price — click for the full breakdown."
                      >
                        RTC +{fmtPrice(r.rt.buy + r.rt.sell)}
                      </div>
                    )}
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)}>
                    <div>{r.mp > 0 ? fmtMoney(r.value, currency) : '—'}</div>
                    <div className="text-muted">
                      {r.mp > 0 && (r.value >= r.invested ? <span className="text-profit">▲</span> : <span className="text-loss">▼</span>)}
                      {' '}Inv {fmtMoney(r.invested, currency)}
                    </div>
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} className={Number.isFinite(r.profit) ? (r.profit >= 0 ? 'pill-positive' : 'pill-negative') : ''}>
                    <div>{Number.isFinite(r.profit) ? fmtMoney(r.profit, currency) : '—'}</div>
                    <div className="text-muted">{Number.isFinite(r.profitPct) ? `${r.profitPct >= 0 ? '+' : ''}${r.profitPct.toFixed(1)}%` : ''}</div>
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                    +1% {fmtPrice(r.t1)}<br />+2% {fmtPrice(r.t2)}<br />+5% {fmtPrice(r.t3)}
                  </td>
                  <td onClick={() => navigate(`/stock/${r.ticker}`)} className={r.statusClass}>{r.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted">No open positions yet.</p>
      )}
      {rtRow && rtRow.rt && (
        <RoundTripCostModal
          ticker={rtRow.ticker}
          currency={currency}
          currentPrice={rtRow.mp}
          buyFee={rtRow.rt.buy}
          sellFee={rtRow.rt.sell}
          onClose={() => setRtTicker(null)}
        />
      )}

      <div className="grid-auto" style={{ ...gridAutoStyle(320, 16), marginTop: 16 }}>
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
    </div>
  );
}

export function DashboardPage() {
  const official = useQSEDerived();
  const strategic = useQSEStrategicDerived();
  const { workbook, rows, summary } = official;
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
  // User-requested (2026-08-26): "Current Deposit (Deposits - Withdrawals)
  // & Current Deposits vs Current NET Worth (Cash Bal + Port. value)."
  // Both fields already exist on `summary` (cashSummary() already computes
  // netWorth as cashBalance + portfolioValue, matching the user's own
  // definition exactly) — no new calc logic, just two new stat cards.
  // Both are computed purely from cash flow/deposits, so they're identical
  // regardless of which cost-basis method the Strategic tab would use —
  // shown once here, not duplicated per tab.
  const currentDeposit = summary.totalInward - summary.totalOutward;
  const growthVsDeposit = summary.netWorth - currentDeposit;

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

      {/* Only the 9 stat cards genuinely identical regardless of cost-basis
          method live here, unified — Realized/Unrealized/Net P/L and
          Portfolio ROI are the 4 that actually differ by which lot a sale
          drew from, so those moved into each tab's own DashboardPositionsView
          below. See README's Done-item log for the full "what's actually
          method-dependent" verification. */}
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
      </div>

      <Tabs
        defaultKey="broker"
        tabs={[
          {
            key: 'broker',
            label: 'Broker Style',
            headerExtra: <StatSourceBadge source="official" />,
            content: (
              <DashboardPositionsView
                workbook={official.workbook}
                calcFee={official.calcFee}
                positions={official.positions}
                rows={official.rows}
                summary={official.summary}
                realizedSeries={official.realizedSeries}
              />
            ),
          },
          {
            key: 'strategic',
            label: 'Strategic Trades',
            headerExtra: <StatSourceBadge source="advisory" />,
            content: (
              <DashboardPositionsView
                workbook={strategic.workbook}
                calcFee={strategic.calcFee}
                positions={strategic.positions}
                rows={strategic.rows}
                summary={strategic.summary}
                realizedSeries={strategic.realizedSeries}
              />
            ),
          },
        ]}
      />

      <CollapsibleCard className="mt-md" title={<h3 className="m-0">Alerts</h3>} defaultOpen={false}>
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
