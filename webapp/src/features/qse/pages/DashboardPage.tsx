import '../../../lib/chartSetup';
import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, StatCard } from '../../../components/Card';
import { Sparkline } from '../../../components/Sparkline';
import { toast } from '../../../components/Toast';
import { getDailyPriceHistory } from '../../../lib/calc';
import { dlBarV, dlDoughnut, dlLine, profitColor } from '../../../lib/chartLabels';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { shortenCompanyName } from '../../../lib/shortenName';
import { AlertsBox, useQSEAlerts } from '../components/AlertsBox';
import { ChartCard } from '../components/ChartCard';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';
import { useAppearanceStore } from '../../../store/appearanceStore';

const INVEST_PALETTE = ['#3d4b58', '#c9a227', '#34c77b', '#3b6bd6', '#8a97a3', '#e5484d', '#7b5cd6', '#2ea3a3'];

function HoldingsCard() {
  const { workbook, rows } = useQSEDerived();
  const { tickerNames } = useQSEStockData();
  const navigate = useNavigate();
  const currency = workbook.settings.currency;

  const held = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.value - a.value)
        .map((r) => ({
          ...r,
          sparkData: getDailyPriceHistory(r.ticker, workbook.priceHistory).map((p) => p.price),
        })),
    [rows, workbook.priceHistory],
  );

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Holdings</h3>
        <Link to="/portfolio" className="footer-note">Full portfolio →</Link>
      </div>
      {held.length ? (
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Ticker</th><th>Trend</th><th>Shares</th><th>Market Price</th><th>Net P/L</th></tr>
            </thead>
            <tbody>
              {held.map((r) => (
                <tr key={r.ticker} style={{ cursor: 'pointer' }} onClick={() => navigate(`/stock/${r.ticker}`)}>
                  <td style={{ maxWidth: 190 }}>
                    {r.ticker} <span className="footer-note" style={{ display: 'inline-block', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{tickerNames[r.ticker] ? shortenCompanyName(tickerNames[r.ticker]) : ''}</span>
                  </td>
                  <td style={{ width: 82 }}><Sparkline data={r.sparkData} formatValue={fmtPrice} /></td>
                  <td>{fmt(r.shares, 0)}</td>
                  <td>{r.marketPrice > 0 ? fmtPrice(r.marketPrice) : '—'}</td>
                  <td className={r.profit >= 0 ? 'pill-buy' : 'pill-sell'}>{fmtMoney(r.profit, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="footer-note">No open positions yet.</p>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { workbook, rows, summary, realizedSeries } = useQSEDerived();
  const currency = workbook.settings.currency;
  const alerts = useQSEAlerts();
  // Re-render (and so recompute chart colors from CSS vars) whenever the
  // user changes theme/color/density — chart.js options are only
  // recomputed on this component's own re-renders, not just because the
  // <html> attributes changed elsewhere.
  useAppearanceStore((s) => s.appearance);
  const totalInvestment = rows.reduce((s, r) => s + r.invested, 0);
  const portfolioROIPct = totalInvestment > 0 ? (summary.unrealizedPL / totalInvestment) * 100 : 0;

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
        <StatCard label="Net Worth" value={fmtMoney(summary.netWorth, currency)} />
        <StatCard label="Cash Balance" value={fmtMoney(summary.cashBalance, currency)} />
        <StatCard label="Portfolio Value" value={fmtMoney(summary.portfolioValue, currency)} />
        <StatCard label="Realized P/L" value={fmtMoney(summary.realizedPL, currency)} />
        <StatCard label="Unrealized P/L" value={fmtMoney(summary.unrealizedPL, currency)} />
        <StatCard label="Net P/L" value={fmtMoney(summary.netPL, currency)} />
        <StatCard label="Total Deposits" value={fmtMoney(summary.totalInward, currency)} />
        <StatCard label="Total Fees" value={fmtMoney(summary.totalCharges, currency)} />
        <StatCard label="Rewards" value={fmtMoney(summary.totalRewards, currency)} />
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

      <Card style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Alerts</h3>
        <AlertsBox />
      </Card>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link to="/analytics" className="btn secondary">
          View full analytics →
        </Link>
      </div>
    </div>
  );
}
