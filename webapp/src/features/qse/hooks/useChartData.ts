import { useMemo } from 'react';
import { getMarketPrice } from '../../../lib/calc';
import { useQSEDerived } from './useQSEDerived';

function monthBucket(dateStr: string) {
  return dateStr.slice(0, 7);
}

/** All derived chart datasets for the QSE module, computed once and shared
 * between DashboardPage (headline subset) and AnalyticsPage (full set) —
 * avoids two pages independently recomputing (and risking drifting) the
 * same aggregations. */
export function useChartData() {
  const { workbook, positions, rows, calcFee } = useQSEDerived();

  const lifetimeRows = useMemo(
    () =>
      positions
        .filter((p) => p.buyCount > 0 || p.sellCount > 0)
        .map((p) => {
          let unrealized = 0;
          if (p.shares > 0) {
            const mp = getMarketPrice(p.ticker, workbook.marketPrices, workbook.transactions);
            const value = p.shares * mp;
            const sellFee = mp > 0 ? calcFee(value, false) : 0;
            unrealized = value - sellFee - p.invested;
          }
          const total = p.realized + unrealized;
          const status = p.shares === 0 ? 'closed' : p.sellCount > 0 ? 'partial' : 'open';
          return { ticker: p.ticker, total, status };
        })
        .sort((a, b) => b.total - a.total),
    [positions, workbook.marketPrices, workbook.transactions, calcFee],
  );

  const activityByMonth = useMemo(() => {
    const map: Record<string, { buys: number; sells: number }> = {};
    workbook.transactions.forEach((tx) => {
      const m = monthBucket(tx.date);
      if (!map[m]) map[m] = { buys: 0, sells: 0 };
      if (tx.action === 'BUY') map[m].buys++;
      else map[m].sells++;
    });
    const months = Object.keys(map).sort();
    return { months, buys: months.map((m) => map[m].buys), sells: months.map((m) => map[m].sells) };
  }, [workbook.transactions]);

  const divByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    workbook.dividends.forEach((d) => {
      const m = monthBucket(d.date);
      map[m] = (map[m] || 0) + d.amount;
    });
    const months = Object.keys(map).sort();
    return { months, values: months.map((m) => map[m]) };
  }, [workbook.dividends]);

  const divByTicker = useMemo(() => {
    const map: Record<string, number> = {};
    workbook.dividends.forEach((d) => {
      map[d.ticker] = (map[d.ticker] || 0) + d.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [workbook.dividends]);

  const feesByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    workbook.transactions.forEach((tx) => {
      const m = monthBucket(tx.date);
      map[m] = (map[m] || 0) + calcFee(tx.shares * tx.price, tx.action === 'BUY');
    });
    workbook.transfers.forEach((t) => {
      const m = monthBucket(t.date);
      map[m] = (map[m] || 0) + t.fee;
    });
    const months = Object.keys(map).sort();
    return { months, values: months.map((m) => map[m]) };
  }, [workbook.transactions, workbook.transfers, calcFee]);

  const holdRows = useMemo(
    () =>
      positions
        .filter((p) => p.shares === 0 && p.buyCount > 0 && p.sellCount > 0)
        .map((p) => ({
          ticker: p.ticker,
          days: Math.round((new Date(p.lastDate).getTime() - new Date(p.firstDate).getTime()) / 86400000),
        }))
        .sort((a, b) => b.days - a.days),
    [positions],
  );

  const allocRows = useMemo(() => rows.filter((r) => r.value > 0), [rows]);

  return { lifetimeRows, activityByMonth, divByMonth, divByTicker, feesByMonth, holdRows, allocRows };
}
