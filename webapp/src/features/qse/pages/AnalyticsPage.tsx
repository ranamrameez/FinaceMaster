import { useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card } from '../../../components/Card';
import { ChartFilterBar } from '../../../components/ChartFilterBar';
import { Tabs } from '../../../components/Tabs';
import { useSortableRows } from '../../../hooks/useSortableRows';
import { tickerColor } from '../../../lib/cssVar';
import {
  EMPTY_CHART_FILTER,
  filterMonthlyDualSeries,
  filterMonthlySeries,
  filterRowsByTicker,
  filterTuplesByTicker,
  isChartFilterActive,
  type ChartFilter,
} from '../../../lib/calc/chartFilters';
import { dlBarH, dlBarV, dlDoughnut } from '../../../lib/chartLabels';
import { profitColor } from '../../../lib/chartLabels';
import { applyChartTheme } from '../../../lib/chartSetup';
import { fmt, fmtMoney, fmtPrice } from '../../../lib/format';
import { ChartCard } from '../components/ChartCard';
import { useChartData } from '../hooks/useChartData';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';
import { useAppearanceStore } from '../../../store/appearanceStore';

const chartGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 } as const;

export function AnalyticsPage() {
  const { workbook, rows: allRows, summary, ledger } = useQSEDerived();
  // See DashboardPage: charts only recompute their CSS-var-derived colors
  // on this component's own re-renders.
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const { tickerNames, fundamentals } = useQSEStockData();
  const chartData = useChartData();
  const currency = workbook.settings.currency;

  const [filter, setFilter] = useState<ChartFilter>(EMPTY_CHART_FILTER);
  const allTickers = useMemo(
    () => Array.from(new Set(workbook.transactions.map((t) => t.ticker))).sort(),
    [workbook.transactions],
  );

  // README item 17: ticker/month filters are applied here, as a pure
  // post-processing step on already-computed chart data — see
  // lib/calc/chartFilters.ts for why positions/summary (whole-portfolio
  // state) aren't re-derived per filter.
  const rows = useMemo(() => filterRowsByTicker(allRows, filter), [allRows, filter]);
  const lifetimeRows = useMemo(() => filterRowsByTicker(chartData.lifetimeRows, filter), [chartData.lifetimeRows, filter]);
  const holdRows = useMemo(() => filterRowsByTicker(chartData.holdRows, filter), [chartData.holdRows, filter]);
  const allocRows = useMemo(() => filterRowsByTicker(chartData.allocRows, filter), [chartData.allocRows, filter]);
  const divByTicker = useMemo(() => filterTuplesByTicker(chartData.divByTicker, filter), [chartData.divByTicker, filter]);
  const activityByMonth = useMemo(() => filterMonthlyDualSeries(chartData.activityByMonth, filter), [chartData.activityByMonth, filter]);
  const divByMonth = useMemo(() => filterMonthlySeries(chartData.divByMonth, filter), [chartData.divByMonth, filter]);
  const feesByMonth = useMemo(() => filterMonthlySeries(chartData.feesByMonth, filter), [chartData.feesByMonth, filter]);

  const totalInvestment = allRows.reduce((s, r) => s + r.invested, 0);
  const totalsVals = [summary.totalInward, totalInvestment, summary.netWorth];
  const totalsMin = Math.min(...totalsVals);
  const totalsMax = Math.max(...totalsVals);
  const totalsPad = Math.max(1, (totalsMax - totalsMin) * 0.3);
  const allocTotal = allocRows.reduce((s, r) => s + r.value, 0);
  const cashVsStock = {
    cash: Math.max(0, summary.cashBalance),
    stocks: Math.max(0, summary.netWorth - Math.max(0, summary.cashBalance)),
  };
  const fundamentalsRows = rows.map((r) => r.ticker).filter((t) => fundamentals[t]);

  return (
    <div>
      <h1 className="pagetitle">Analytics</h1>
      <p className="footer-note" style={{ marginTop: -8, marginBottom: 20 }}>
        The full chart library — head back to Dashboard for a quick overview.
      </p>

      <ChartFilterBar tickers={allTickers} filter={filter} onChange={setFilter} />
      {isChartFilterActive(filter) && !rows.length && !lifetimeRows.length && (
        <p className="footer-note" style={{ marginTop: -8, marginBottom: 16 }}>
          No data matches the current filter.
        </p>
      )}

      <Tabs
        tabs={[
          {
            key: 'performance',
            label: 'Performance',
            content: (
              <div style={chartGrid}>
                <ChartCard title="ROI % by ticker" empty={!rows.length}>
                  <Bar
                    data={{ labels: rows.map((r) => r.ticker), datasets: [{ data: rows.map((r) => r.roiPct), backgroundColor: rows.map((r) => profitColor(r.roiPct)) }] }}
                    options={{ indexAxis: 'y', plugins: { legend: { display: false }, datalabels: dlBarH((v) => v.toFixed(1) + '%') } }}
                  />
                </ChartCard>
                <ChartCard title="Winners vs losers" empty={!rows.length}>
                  <Doughnut
                    data={{ labels: ['Winners', 'Losers'], datasets: [{ data: [rows.filter((r) => r.profit >= 0).length, rows.filter((r) => r.profit < 0).length], backgroundColor: ['#3ecf8e', '#e5484d'] }] }}
                    options={{ cutout: '55%' }}
                  />
                </ChartCard>
                <ChartCard title="Invested vs current value" empty={!rows.length}>
                  <Bar
                    data={{
                      labels: rows.map((r) => r.ticker),
                      datasets: [
                        { label: 'Invested', data: rows.map((r) => r.invested), backgroundColor: '#8a97a3' },
                        { label: 'Current value', data: rows.map((r) => r.value), backgroundColor: '#c9a35a' },
                      ],
                    }}
                  />
                </ChartCard>
                <ChartCard title="Total P/L by symbol (open + closed)" empty={!lifetimeRows.length}>
                  <Bar
                    data={{ labels: lifetimeRows.map((r) => r.ticker), datasets: [{ data: lifetimeRows.map((r) => r.total), backgroundColor: lifetimeRows.map((r) => profitColor(r.total)) }] }}
                    options={{
                      plugins: {
                        legend: { display: false },
                        datalabels: dlBarV((v) => fmt(v, 2)),
                        tooltip: { callbacks: { afterLabel: (ctx) => `Status: ${lifetimeRows[ctx.dataIndex].status}` } },
                      },
                    }}
                  />
                </ChartCard>
                <ChartCard title="Realized vs unrealized P/L" empty={summary.realizedPL === 0 && summary.unrealizedPL === 0}>
                  <Bar
                    data={{ labels: ['Realized', 'Unrealized'], datasets: [{ data: [summary.realizedPL, summary.unrealizedPL], backgroundColor: [profitColor(summary.realizedPL), profitColor(summary.unrealizedPL)] }] }}
                    options={{ plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmt(v, 2)) } }}
                  />
                </ChartCard>
                <ChartCard title="Holding period — closed positions" empty={!holdRows.length}>
                  <Bar
                    data={{ labels: holdRows.map((r) => r.ticker), datasets: [{ data: holdRows.map((r) => r.days), backgroundColor: holdRows.map((r) => tickerColor(r.ticker)) }] }}
                    options={{ indexAxis: 'y', plugins: { legend: { display: false }, datalabels: dlBarH((v) => v.toFixed(0) + 'd') } }}
                  />
                </ChartCard>
              </div>
            ),
          },
          {
            key: 'allocation',
            label: 'Allocation',
            content: (
              <div style={chartGrid}>
                <ChartCard title="Portfolio allocation (market value)" empty={!allocRows.length}>
                  <Doughnut
                    data={{ labels: allocRows.map((r) => r.ticker), datasets: [{ data: allocRows.map((r) => r.value), backgroundColor: allocRows.map((r) => tickerColor(r.ticker)) }] }}
                    options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => ((v / allocTotal) * 100).toFixed(0) + '%') } }}
                  />
                </ChartCard>
                <ChartCard title="Cash vs stocks split" empty={summary.netWorth <= 0}>
                  <Doughnut
                    data={{ labels: ['Cash', 'Stocks'], datasets: [{ data: [cashVsStock.cash, cashVsStock.stocks], backgroundColor: ['#8a97a3', '#c9a227'] }] }}
                    options={{ cutout: '55%' }}
                  />
                </ChartCard>
              </div>
            ),
          },
          {
            key: 'cash-fees',
            label: 'Cash & fees',
            content: (
              <div style={chartGrid}>
                <ChartCard title="Cash balance over time" empty={!ledger.length}>
                  <Line
                    data={{
                      labels: ledger.map((e) => e.date),
                      datasets: [{ label: `Cash (${currency})`, data: ledger.map((e) => e.balance), borderColor: '#3b6bd6', backgroundColor: 'rgba(59,107,214,0.15)', fill: true, tension: 0.2 }],
                    }}
                    options={{ interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } } }}
                  />
                </ChartCard>
                <ChartCard title="Deposits vs invested vs net worth" empty={summary.totalInward <= 0}>
                  <Bar
                    data={{ labels: ['Deposits', 'Invested', 'Net worth'], datasets: [{ data: totalsVals, backgroundColor: ['#8a97a3', '#c9a227', '#3ecf8e'] }] }}
                    options={{
                      scales: { y: { suggestedMin: totalsMin - totalsPad, suggestedMax: totalsMax + totalsPad } },
                      plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmtMoney(v, currency)) },
                    }}
                  />
                </ChartCard>
                <ChartCard title="Fees breakdown" empty={summary.totalCharges <= 0}>
                  <Doughnut
                    data={{ labels: ['Trading fees', 'Transfer fees'], datasets: [{ data: [summary.tradingFees, summary.transferFees], backgroundColor: ['#3b6bd6', '#c9a227'] }] }}
                    options={{ plugins: { datalabels: dlDoughnut((v) => fmt(v, 2)) } }}
                  />
                </ChartCard>
                <ChartCard title="Fees paid by month" empty={!feesByMonth.months.length}>
                  <Bar data={{ labels: feesByMonth.months, datasets: [{ label: `Fees (${currency})`, data: feesByMonth.values, backgroundColor: '#e5484d' }] }} options={{ plugins: { legend: { display: false } } }} />
                </ChartCard>
              </div>
            ),
          },
          {
            key: 'activity-dividends',
            label: 'Activity & dividends',
            content: (
              <div style={chartGrid}>
                <ChartCard title="Monthly trading activity" empty={!activityByMonth.months.length}>
                  <Bar
                    data={{
                      labels: activityByMonth.months,
                      datasets: [
                        { label: 'Buys', data: activityByMonth.buys, backgroundColor: '#3ecf8e' },
                        { label: 'Sells', data: activityByMonth.sells, backgroundColor: '#e5484d' },
                      ],
                    }}
                    options={{ scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { datalabels: { display: (ctx) => (ctx.dataset.data[ctx.dataIndex] as number) > 0, color: '#fff' } } }}
                  />
                </ChartCard>
                <ChartCard title="Dividend income by month" empty={!divByMonth.months.length}>
                  <Bar data={{ labels: divByMonth.months, datasets: [{ label: `Dividends (${currency})`, data: divByMonth.values, backgroundColor: '#c9a227' }] }} options={{ plugins: { legend: { display: false } } }} />
                </ChartCard>
                <ChartCard title="Dividend income by ticker" empty={!divByTicker.length}>
                  <Doughnut data={{ labels: divByTicker.map(([t]) => t), datasets: [{ data: divByTicker.map(([, v]) => v), backgroundColor: divByTicker.map(([t]) => tickerColor(t)) }] }} options={{ cutout: '55%' }} />
                </ChartCard>
              </div>
            ),
          },
        ]}
      />

      <FundamentalsCard fundamentalsRows={fundamentalsRows} fundamentals={fundamentals} tickerNames={tickerNames} />
    </div>
  );
}

function FundamentalsCard({
  fundamentalsRows,
  fundamentals,
  tickerNames,
}: {
  fundamentalsRows: string[];
  fundamentals: ReturnType<typeof useQSEStockData>['fundamentals'];
  tickerNames: Record<string, string>;
}) {
  type FundCol = 'ticker' | 'name' | 'period' | 'eps' | 'priorEps' | 'dps' | 'status';
  const sortValue = (t: string, col: FundCol): number | string => {
    const f = fundamentals[t];
    switch (col) {
      case 'name': return tickerNames[t] || f.name;
      case 'period': return f.period;
      case 'eps': return f.eps ?? -Infinity;
      case 'priorEps': return f.priorEps ?? -Infinity;
      case 'dps': return f.dps ?? -Infinity;
      case 'status': return f.status;
      default: return t;
    }
  };
  const { sorted, Th } = useSortableRows(fundamentalsRows, sortValue, 'ticker', 'asc');

  return (
    <Card style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Fundamentals (held tickers)</h3>
      {sorted.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <Th col="ticker">Ticker</Th>
                <Th col="name">Name</Th>
                <Th col="period">Period</Th>
                <Th col="eps">EPS</Th>
                <Th col="priorEps">Prior EPS</Th>
                <Th col="dps">DPS</Th>
                <Th col="status">Status</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const f = fundamentals[t];
                return (
                  <tr key={t}>
                    <td>{t}</td>
                    <td>{tickerNames[t] || f.name}</td>
                    <td>{f.period}</td>
                    <td>{f.eps === null ? '—' : fmtPrice(f.eps)}</td>
                    <td>{f.priorEps === null ? '—' : fmtPrice(f.priorEps)}</td>
                    <td>{f.dps === null ? '—' : fmtPrice(f.dps)}</td>
                    <td>{f.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="footer-note">No fundamentals data for currently held tickers.</p>
      )}
    </Card>
  );
}
