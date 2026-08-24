import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { CollapsibleCard, StatCard } from '../../../components/Card';
import { Sparkline } from '../../../components/Sparkline';
import { toast } from '../../../components/Toast';
import { breakEvenPrice, getDailyPriceHistory } from '../../../lib/calc';
import { dlBarV, dlDoughnut, dlLine, profitColor } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { fmt, fmtMoney, fmtMoneyCompact, fmtPrice } from '../../../lib/format';
import { useEnsureSignedIn } from '../../../lib/firebase/useEnsureSignedIn';
import { shortenCompanyName } from '../../../lib/shortenName';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { useAppearanceStore } from '../../../store/appearanceStore';
import { AlertsBox, usePSXAlerts } from '../components/AlertsBox';
import { ChartCard } from '../../qse/components/ChartCard';
import { usePSXDerived } from '../hooks/usePSXDerived';
import { usePSXStockData } from '../hooks/usePSXStockData';

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
          const be = breakEvenPrice(p.invested, p.shares, feePct, tick, calcFee);
          const sparkData = getDailyPriceHistory(p.ticker, workbook.priceHistory).map((pt) => pt.price);
          return { ticker: p.ticker, shares: p.shares, avgCost, mp, profit, be, sparkData };
        }),
    [positions, workbook.marketPrices, workbook.priceHistory, calcFee, feePct, tick],
  );

  type Col = 'ticker' | 'shares' | 'avgCost' | 'mp' | 'be' | 'profit';
  const sortValue = (r: (typeof heldRaw)[number], col: Col): number | string => {
    if (col === 'profit') return Number.isFinite(r.profit) ? r.profit : 0;
    return r[col];
  };
  const { sorted: held, Th } = useSortableRows(heldRaw, sortValue, 'profit', 'desc');

  return (
    <CollapsibleCard
      style={{ marginBottom: 16, paddingBottom: 12 }}
      title={<h3 style={{ margin: 0 }}>Holdings</h3>}
      headerExtra={<Link to="/psx/portfolio" className="footer-note">Full portfolio →</Link>}
    >
      {held.length ? (
        <div className="table-scroll table-compact" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr><Th col="ticker">Ticker</Th><th>Trend</th><Th col="shares">Shares</Th><Th col="avgCost">Avg Cost</Th><Th col="mp">Current Price</Th><Th col="be">Break-even</Th><Th col="profit">Net P/L</Th></tr>
            </thead>
            <tbody>
              {held.map((r) => (
                <tr key={r.ticker} style={{ cursor: 'pointer' }}>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)} style={{ maxWidth: 170 }}>
                    {r.ticker} <span className="footer-note" style={{ display: 'inline-block', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{tickerNames[r.ticker] ? shortenCompanyName(tickerNames[r.ticker]) : ''}</span>
                  </td>
                  <td style={{ width: 70 }}><Sparkline data={r.sparkData} formatValue={fmtPrice} width={56} height={20} /></td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)}>{fmt(r.shares, 0)}</td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)}>{fmtPrice(r.avgCost)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
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
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)} className={r.mp > 0 ? (r.mp >= r.be ? 'pill-buy' : 'pill-sell') : ''}>{fmtPrice(r.be)}</td>
                  <td onClick={() => navigate(`/psx/stock/${r.ticker}`)} className={Number.isFinite(r.profit) ? (r.profit >= 0 ? 'pill-buy' : 'pill-sell') : ''}>{Number.isFinite(r.profit) ? fmtMoney(r.profit, currency) : '—'}</td>
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
  const { workbook, rows, summary, realizedSeries } = usePSXDerived();
  const currency = workbook.settings.currency;
  const alerts = usePSXAlerts();
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const totalInvestment = rows.reduce((s, r) => s + r.invested, 0);
  const portfolioROIPct = totalInvestment > 0 ? (summary.unrealizedPL / totalInvestment) * 100 : 0;

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Net Worth" value={fmtMoneyCompact(summary.netWorth, currency)} title={fmtMoney(summary.netWorth, currency)} />
        <StatCard label="Cash Balance" value={fmtMoneyCompact(summary.cashBalance, currency)} title={fmtMoney(summary.cashBalance, currency)} />
        <StatCard label="Portfolio Value" value={fmtMoneyCompact(summary.portfolioValue, currency)} title={fmtMoney(summary.portfolioValue, currency)} />
        <StatCard label="Realized P/L" value={fmtMoneyCompact(summary.realizedPL, currency)} title={fmtMoney(summary.realizedPL, currency)} />
        <StatCard label="Unrealized P/L" value={fmtMoneyCompact(summary.unrealizedPL, currency)} title={fmtMoney(summary.unrealizedPL, currency)} />
        <StatCard label="Net P/L" value={fmtMoneyCompact(summary.netPL, currency)} title={fmtMoney(summary.netPL, currency)} />
        <StatCard label="Total Deposits" value={fmtMoneyCompact(summary.totalInward, currency)} title={fmtMoney(summary.totalInward, currency)} />
        <StatCard label="Total Fees" value={fmtMoneyCompact(summary.totalCharges, currency)} title={fmtMoney(summary.totalCharges, currency)} />
        <StatCard label="Rewards" value={fmtMoneyCompact(summary.totalRewards, currency)} title={fmtMoney(summary.totalRewards, currency)} />
        <StatCard label="Open Positions" value={fmt(rows.length, 0)} />
        <StatCard label="Portfolio ROI" value={`${portfolioROIPct.toFixed(1)}%`} />
      </div>

      <HoldingsCard />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <ChartCard title="Allocation by ticker (cost basis)" empty={!rows.length}>
          <Doughnut
            data={{ labels: rows.map((r) => r.ticker), datasets: [{ data: rows.map((r) => r.invested), backgroundColor: INVEST_PALETTE }] }}
            options={{ plugins: { datalabels: dlDoughnut((v) => fmt(v, 2)) } }}
          />
        </ChartCard>

        <ChartCard title="P/L by ticker" empty={!rows.length}>
          <Bar
            data={{
              labels: rows.map((r) => r.ticker),
              datasets: [{ data: rows.map((r) => r.profit), backgroundColor: rows.map((r) => profitColor(r.profit)) }],
            }}
            options={{ plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmt(v, 2)) } }}
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

      <CollapsibleCard style={{ marginTop: 16 }} title={<h3 style={{ margin: 0 }}>Alerts</h3>}>
        <AlertsBox />
      </CollapsibleCard>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link to="/psx/analytics" className="btn secondary">
          View full analytics →
        </Link>
      </div>
    </div>
  );
}
