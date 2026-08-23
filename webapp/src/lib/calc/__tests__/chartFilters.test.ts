import { describe, expect, it } from 'vitest';
import {
  EMPTY_CHART_FILTER,
  filterMonthlyDualSeries,
  filterMonthlySeries,
  filterRowsByTicker,
  filterTuplesByTicker,
  isChartFilterActive,
} from '../chartFilters';

describe('isChartFilterActive', () => {
  it('is false for the empty filter', () => {
    expect(isChartFilterActive(EMPTY_CHART_FILTER)).toBe(false);
  });
  it('is true when tickers or a month bound is set', () => {
    expect(isChartFilterActive({ tickers: ['ABC'] })).toBe(true);
    expect(isChartFilterActive({ tickers: [], fromMonth: '2026-01' })).toBe(true);
    expect(isChartFilterActive({ tickers: [], toMonth: '2026-01' })).toBe(true);
  });
});

describe('filterRowsByTicker', () => {
  const rows = [{ ticker: 'ABC', v: 1 }, { ticker: 'XYZ', v: 2 }];
  it('returns all rows when no tickers selected', () => {
    expect(filterRowsByTicker(rows, EMPTY_CHART_FILTER)).toEqual(rows);
  });
  it('keeps only selected tickers', () => {
    expect(filterRowsByTicker(rows, { tickers: ['XYZ'] })).toEqual([{ ticker: 'XYZ', v: 2 }]);
  });
});

describe('filterTuplesByTicker', () => {
  const rows: [string, number][] = [['ABC', 10], ['XYZ', 20]];
  it('returns all when no tickers selected', () => {
    expect(filterTuplesByTicker(rows, EMPTY_CHART_FILTER)).toEqual(rows);
  });
  it('keeps only selected tickers', () => {
    expect(filterTuplesByTicker(rows, { tickers: ['ABC'] })).toEqual([['ABC', 10]]);
  });
});

describe('filterMonthlySeries', () => {
  const series = { months: ['2026-01', '2026-02', '2026-03'], values: [10, 20, 30] };
  it('returns the series unchanged with no bounds', () => {
    expect(filterMonthlySeries(series, EMPTY_CHART_FILTER)).toEqual(series);
  });
  it('applies an inclusive fromMonth bound', () => {
    expect(filterMonthlySeries(series, { tickers: [], fromMonth: '2026-02' })).toEqual({
      months: ['2026-02', '2026-03'],
      values: [20, 30],
    });
  });
  it('applies an inclusive toMonth bound', () => {
    expect(filterMonthlySeries(series, { tickers: [], toMonth: '2026-02' })).toEqual({
      months: ['2026-01', '2026-02'],
      values: [10, 20],
    });
  });
  it('applies both bounds together', () => {
    expect(filterMonthlySeries(series, { tickers: [], fromMonth: '2026-02', toMonth: '2026-02' })).toEqual({
      months: ['2026-02'],
      values: [20],
    });
  });
});

describe('filterMonthlyDualSeries', () => {
  const series = { months: ['2026-01', '2026-02'], buys: [1, 2], sells: [3, 4] };
  it('keeps buys/sells aligned when filtering', () => {
    expect(filterMonthlyDualSeries(series, { tickers: [], fromMonth: '2026-02' })).toEqual({
      months: ['2026-02'],
      buys: [2],
      sells: [4],
    });
  });
});
