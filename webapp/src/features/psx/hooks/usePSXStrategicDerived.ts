import { useMemo } from 'react';
import { cashSummary, getMarketPrice } from '../../../lib/calc';
import { computeFIFOPositions } from '../../../lib/calc/fifoPositions';
import { makePSXFeeCalculator } from '../../../lib/calc/psxFees';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import type { PSXRow } from './usePSXDerived';

/** PSX's mirror of `useQSEStrategicDerived` — see that file's own doc
 * comment for the full reasoning. Always computes `'lowestCostFirst'`,
 * independent of the stored `costBasisMethod` setting, exactly like
 * `PartialTradeAdvisor` already does on the Trade Strategy page. */
export function usePSXStrategicDerived() {
  const workbook = usePSXWorkbookStore((s) => s.workbook);

  return useMemo(() => {
    const calcFee = makePSXFeeCalculator(workbook.settings, workbook.transactions);
    const { positions, realizedSeries, lotsByTicker } = computeFIFOPositions(workbook.transactions, calcFee, 'lowestCostFirst');

    const summary = cashSummary(
      workbook.transactions,
      workbook.transfers,
      workbook.adjustments,
      workbook.marketPrices,
      calcFee,
      positions,
    );

    const rows: PSXRow[] = positions
      .filter((p) => p.shares > 0)
      .map((p) => {
        const marketPrice = getMarketPrice(p.ticker, workbook.marketPrices, workbook.transactions);
        const value = p.shares * marketPrice;
        const sellFee = marketPrice > 0 ? calcFee(value, false, { shares: p.shares }) : 0;
        const profit = value - sellFee - p.invested;
        const roiPct = p.invested > 0 ? (profit / p.invested) * 100 : 0;
        return { ticker: p.ticker, shares: p.shares, invested: p.invested, marketPrice, value, sellFee, profit, roiPct };
      });

    return { workbook, calcFee, positions, summary, realizedSeries, rows, lots: lotsByTicker };
  }, [workbook]);
}
