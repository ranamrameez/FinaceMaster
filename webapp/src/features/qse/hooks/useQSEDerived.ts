import { useMemo } from 'react';
import { buildCashLedger, cashSummary, computePositions, computeRealizedPLTimeSeries, getMarketPrice, makeQSEFeeCalculator } from '../../../lib/calc';
import { useWorkbookStore } from '../../../store/workbookStore';

export interface QSERow {
  ticker: string;
  shares: number;
  invested: number;
  marketPrice: number;
  value: number; // gross market value, shares * marketPrice
  sellFee: number;
  /** Unrealized P/L net of an estimated sell commission. */
  profit: number;
  roiPct: number;
}

export function useQSEDerived() {
  const workbook = useWorkbookStore((s) => s.workbook);

  return useMemo(() => {
    const calcFee = makeQSEFeeCalculator(workbook.settings);
    const positions = computePositions(workbook.transactions, calcFee);
    const summary = cashSummary(
      workbook.transactions,
      workbook.transfers,
      workbook.adjustments,
      workbook.marketPrices,
      calcFee,
    );
    const realizedSeries = computeRealizedPLTimeSeries(workbook.transactions, calcFee);
    const ledger = buildCashLedger(workbook.transactions, workbook.transfers, workbook.adjustments, calcFee);

    // Shared per-open-position rollup (mirrors the legacy dashboard's
    // `rows` variable) — feeds most of the ticker-level charts.
    const rows: QSERow[] = positions
      .filter((p) => p.shares > 0)
      .map((p) => {
        const marketPrice = getMarketPrice(p.ticker, workbook.marketPrices, workbook.transactions);
        const value = p.shares * marketPrice;
        const sellFee = marketPrice > 0 ? calcFee(value, false) : 0;
        const profit = value - sellFee - p.invested;
        const roiPct = p.invested > 0 ? (profit / p.invested) * 100 : 0;
        return { ticker: p.ticker, shares: p.shares, invested: p.invested, marketPrice, value, sellFee, profit, roiPct };
      });

    return { workbook, calcFee, positions, summary, realizedSeries, ledger, rows };
  }, [workbook]);
}
