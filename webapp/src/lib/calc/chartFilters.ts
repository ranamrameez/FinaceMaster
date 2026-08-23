/** README item 17: make the Analytics charts filterable by ticker and
 * date range, without re-deriving portfolio state (positions, cost basis,
 * realized/unrealized P/L) for a filtered window — that would change what
 * "current holdings" means and produce misleading numbers (e.g. a stock
 * bought two years ago and still held would show as "no position" under a
 * last-3-months filter). Instead these are pure post-processing filters
 * applied to the *already-computed* per-ticker and per-month chart data:
 * ticker filtering narrows which bars/slices show, month-range filtering
 * narrows which months a time series covers. Whole-portfolio single-number
 * charts (realized vs unrealized P/L, cash vs stocks split, ...) have no
 * ticker/month dimension to filter and are left as global totals. */

export interface ChartFilter {
  /** Empty = no ticker filter (show all). */
  tickers: string[];
  /** "YYYY-MM", inclusive. Undefined = no lower/upper bound. */
  fromMonth?: string;
  toMonth?: string;
}

export const EMPTY_CHART_FILTER: ChartFilter = { tickers: [] };

export function isChartFilterActive(filter: ChartFilter): boolean {
  return filter.tickers.length > 0 || !!filter.fromMonth || !!filter.toMonth;
}

function monthInRange(month: string, filter: ChartFilter): boolean {
  if (filter.fromMonth && month < filter.fromMonth) return false;
  if (filter.toMonth && month > filter.toMonth) return false;
  return true;
}

/** Filters any array of ticker-keyed rows down to the selected tickers. */
export function filterRowsByTicker<T extends { ticker: string }>(rows: T[], filter: ChartFilter): T[] {
  if (!filter.tickers.length) return rows;
  const set = new Set(filter.tickers);
  return rows.filter((r) => set.has(r.ticker));
}

/** Filters a [ticker, value] tuple list (e.g. dividends-by-ticker) down to
 * the selected tickers. */
export function filterTuplesByTicker(rows: [string, number][], filter: ChartFilter): [string, number][] {
  if (!filter.tickers.length) return rows;
  const set = new Set(filter.tickers);
  return rows.filter(([ticker]) => set.has(ticker));
}

/** Filters a {months, values} monthly series down to the selected month
 * range, keeping `months`/`values` aligned by index. */
export function filterMonthlySeries(series: { months: string[]; values: number[] }, filter: ChartFilter): { months: string[]; values: number[] } {
  if (!filter.fromMonth && !filter.toMonth) return series;
  const months: string[] = [];
  const values: number[] = [];
  series.months.forEach((m, i) => {
    if (monthInRange(m, filter)) {
      months.push(m);
      values.push(series.values[i]);
    }
  });
  return { months, values };
}

/** Same as `filterMonthlySeries` but for a two-series shape (buys/sells). */
export function filterMonthlyDualSeries(
  series: { months: string[]; buys: number[]; sells: number[] },
  filter: ChartFilter,
): { months: string[]; buys: number[]; sells: number[] } {
  if (!filter.fromMonth && !filter.toMonth) return series;
  const months: string[] = [];
  const buys: number[] = [];
  const sells: number[] = [];
  series.months.forEach((m, i) => {
    if (monthInRange(m, filter)) {
      months.push(m);
      buys.push(series.buys[i]);
      sells.push(series.sells[i]);
    }
  });
  return { months, buys, sells };
}
