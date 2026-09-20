import { useMemo } from 'react';
import { cashSummary, getMarketPrice, makeQSEFeeCalculator } from '../../../lib/calc';
import { computeFIFOPositions } from '../../../lib/calc/fifoPositions';
import { useWorkbookStore } from '../../../store/workbookStore';
import type { QSERow } from './useQSEDerived';

/** Dashboard's "Strategic Trades" tab: always computes `'lowestCostFirst'`,
 * completely independent of the stored `costBasisMethod` setting — the same
 * "protect the cheapest lots first" trading tactic
 * `partialTradeStrategy.ts`'s `PartialTradeAdvisor` already always uses on
 * the Trade Strategy page. This is a what-if/advisory view: it never writes
 * anything and has zero effect on the real, official numbers
 * `useQSEDerived()` returns (whatever the user's own Settings say). Return
 * shape mirrors `useQSEDerived()`'s (minus `ledger`, which Dashboard never
 * reads) so `DashboardPositionsView` can be fed either hook's output. */
export function useQSEStrategicDerived() {
  const workbook = useWorkbookStore((s) => s.workbook);

  return useMemo(() => {
    const calcFee = makeQSEFeeCalculator(workbook.settings);
    const { positions, realizedSeries, lotsByTicker } = computeFIFOPositions(workbook.transactions, calcFee, 'lowestCostFirst');

    const summary = cashSummary(
      workbook.transactions,
      workbook.transfers,
      workbook.adjustments,
      workbook.marketPrices,
      calcFee,
      positions,
    );

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

    return { workbook, calcFee, positions, summary, realizedSeries, rows, lots: lotsByTicker };
  }, [workbook]);
}
