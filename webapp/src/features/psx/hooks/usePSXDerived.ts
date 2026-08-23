import { useMemo } from 'react';
import { buildCashLedger, cashSummary, computePositions, computeRealizedPLTimeSeries, getMarketPrice } from '../../../lib/calc';
import { makePSXFeeCalculator } from '../../../lib/calc/psxFees';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';

export interface PSXRow {
  ticker: string;
  shares: number;
  invested: number;
  marketPrice: number;
  value: number; // gross market value, shares * marketPrice
  sellFee: number;
  /** Unrealized P/L net of an estimated sell commission (and, where a
   * same-day pairing exists, the netted-side fee — see makePSXFeeCalculator). */
  profit: number;
  roiPct: number;
}

/** PSX's equivalent of useQSEDerived — same shape, different store + fee
 * model. makePSXFeeCalculator is rebuilt from the *current* transaction list
 * every time (not just settings) because its same-day netting logic
 * (README items 6/7) needs the full transaction history to know which side
 * of a same-day round trip is the "charged" one. */
export function usePSXDerived() {
  const workbook = usePSXWorkbookStore((s) => s.workbook);

  return useMemo(() => {
    const calcFee = makePSXFeeCalculator(workbook.settings, workbook.transactions);
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

    return { workbook, calcFee, positions, summary, realizedSeries, ledger, rows };
  }, [workbook]);
}
