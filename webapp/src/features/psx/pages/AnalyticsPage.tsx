import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ChartFilterBar } from '../../../components/ChartFilterBar';
import { Tabs } from '../../../components/Tabs';
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
import { fmt, fmtMoney } from '../../../lib/format';
import { ChartCard } from '../../qse/components/ChartCard';
import { useChartData } from '../hooks/useChartData';
import { usePSXDerived } from '../hooks/usePSXDerived';
import { useAppearanceStore } from '../../../store/appearanceStore';

const chartGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 } as const;

/** Pending item 17's remainder: click-to-drill-down on Analytics' own
 * ticker-indexed charts (Dashboard's got this in Done item 134) — see the
 * identical helper in QSE's AnalyticsPage.tsx for the full comment. */
function tickerClickOptions(tickers: string[], navigate: ReturnType<typeof useNavigate>) {
  return {
    onClick: (_e: any, elements: any[]) => {
      const i = elements[0]?.index;
      if (i !== undefined && tickers[i]) navigate(`/psx/stock/${tickers[i]}`);
    },
    onHover: (e: any, elements: any[]) => {
      if (e.native?.target) (e.native.target as HTMLElement).style.cursor = elements.length ? 'pointer' : 'default';
    },
  };
}

/** PSX's equivalent of the QSE AnalyticsPage. Omits the "Fundamentals"
 * card at the bottom — QSE has a shared EPS/DPS data source
 * (stockData/QSE, see lib/stockData/reader.ts); nothing equivalent exists
 * for PSX yet, so there's nothing to show there. */
export function AnalyticsPage() {
  const navigate = useNavigate();
  const { workbook, rows: allRows, summary, ledger } = usePSXDerived();
  useAppearanceStore((s) => s.appearance);
  applyChartTheme();
  const chartData = useChartData();
  const currency = workbook.settings.currency;

  const [filter, setFilter] = useState<ChartFilter>(EMPTY_CHART_FILTER);
  const allTickers = useMemo(
    () => Array.from(new Set(workbook.transactions.map((t) => t.ticker))).sort(),
    [workbook.transactions],
  );

  // README item 17: see the QSE AnalyticsPage / lib/calc/chartFilters.ts
  // for why this filters already-computed chart data rather than
  // re-deriving positions/summary per filter.
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

  return (
    <div>
      <h1 className="pagetitle">PSX Analytics</h1>
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
                    options={{ indexAxis: 'y', plugins: { legend: { display: false }, datalabels: dlBarH((v) => v.toFixed(1) + '%') }, ...tickerClickOptions(rows.map((r) => r.ticker), navigate) }}
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
                    options={tickerClickOptions(rows.map((r) => r.ticker), navigate)}
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
                      ...tickerClickOptions(lifetimeRows.map((r) => r.ticker), navigate),
                    }}
                  />
                </ChartCard>
                <ChartCard title="Realized vs unrealized P/L" unfiltered empty={summary.realizedPL === 0 && summary.unrealizedPL === 0}>
                  <Bar
                    data={{ labels: ['Realized', 'Unrealized'], datasets: [{ data: [summary.realizedPL, summary.unrealizedPL], backgroundColor: [profitColor(summary.realizedPL), profitColor(summary.unrealizedPL)] }] }}
                    options={{ plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmt(v, 2)) } }}
                  />
                </ChartCard>
                <ChartCard title="Holding period — closed positions" empty={!holdRows.length}>
                  <Bar
                    data={{ labels: holdRows.map((r) => r.ticker), datasets: [{ data: holdRows.map((r) => r.days), backgroundColor: holdRows.map((r) => tickerColor(r.ticker)) }] }}
                    options={{ indexAxis: 'y', plugins: { legend: { display: false }, datalabels: dlBarH((v) => v.toFixed(0) + 'd') }, ...tickerClickOptions(holdRows.map((r) => r.ticker), navigate) }}
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
                    options={{ cutout: '55%', plugins: { datalabels: dlDoughnut((v) => ((v / allocTotal) * 100).toFixed(0) + '%') }, ...tickerClickOptions(allocRows.map((r) => r.ticker), navigate) }}
                  />
                </ChartCard>
                <ChartCard title="Cash vs stocks split" unfiltered empty={summary.netWorth <= 0}>
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
                <ChartCard title="Cash balance over time" unfiltered empty={!ledger.length}>
                  <Line
                    data={{
                      labels: ledger.map((e) => e.date),
                      datasets: [{ label: `Cash (${currency})`, data: ledger.map((e) => e.balance), borderColor: '#3b6bd6', backgroundColor: 'rgba(59,107,214,0.15)', fill: true, tension: 0.2 }],
                    }}
                    options={{ interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } } }}
                  />
                </ChartCard>
                <ChartCard title="Deposits vs invested vs net worth" unfiltered empty={summary.totalInward <= 0}>
                  <Bar
                    data={{ labels: ['Deposits', 'Invested', 'Net worth'], datasets: [{ data: totalsVals, backgroundColor: ['#8a97a3', '#c9a227', '#3ecf8e'] }] }}
                    options={{
                      scales: { y: { suggestedMin: totalsMin - totalsPad, suggestedMax: totalsMax + totalsPad } },
                      plugins: { legend: { display: false }, datalabels: dlBarV((v) => fmtMoney(v, currency)) },
                    }}
                  />
                </ChartCard>
                <ChartCard title="Fees breakdown" unfiltered empty={summary.totalCharges <= 0}>
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
                  <Doughnut
                    data={{ labels: divByTicker.map(([t]) => t), datasets: [{ data: divByTicker.map(([, v]) => v), backgroundColor: divByTicker.map(([t]) => tickerColor(t)) }] }}
                    options={{ cutout: '55%', ...tickerClickOptions(divByTicker.map(([t]) => t), navigate) }}
                  />
                </ChartCard>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
