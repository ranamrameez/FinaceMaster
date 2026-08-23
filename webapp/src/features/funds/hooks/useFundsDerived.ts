import { useMemo } from 'react';
import { buildCashLedger, cashSummary, computePositions, computeRealizedPLTimeSeries, getMarketPrice } from '../../../lib/calc';
import { xirr } from '../../../lib/calc/xirr';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';

/** Funds' equivalent of useQSEDerived/usePSXDerived — same shared calc
 * engine (Fund.id plays the role of `ticker`), no fee model (NAV is
 * already net; `calcFee` is a no-op — see FundsWorkbook's doc comment). */
const calcFee = () => 0;

export function useFundsDerived() {
  const workbook = useFundsWorkbookStore((s) => s.workbook);

  return useMemo(() => {
    const positions = computePositions(workbook.transactions, calcFee);
    const summary = cashSummary(workbook.transactions, workbook.transfers, workbook.adjustments, workbook.marketPrices, calcFee);
    const realizedSeries = computeRealizedPLTimeSeries(workbook.transactions, calcFee);
    const ledger = buildCashLedger(workbook.transactions, workbook.transfers, workbook.adjustments, calcFee);

    /** XIRR for one fund: every transaction as a cash flow (negative for
     * BUY, positive for SELL) plus a final synthetic +currentValue flow
     * dated at the latest NAV update (or today, if none yet). */
    const fundXIRR = (fundId: string): number | null => {
      const txs = workbook.transactions.filter((t) => t.ticker === fundId);
      if (!txs.length) return null;
      const position = positions.find((p) => p.ticker === fundId);
      const units = position?.shares ?? 0;
      const nav = getMarketPrice(fundId, workbook.marketPrices, workbook.transactions);
      const currentValue = units * nav;
      const history = workbook.priceHistory[fundId] || [];
      const asOfDate = history.length ? new Date(history[history.length - 1].date) : new Date();
      const flows = txs
        .map((t) => ({ date: new Date(t.date), amount: t.action === 'BUY' ? -(t.shares * t.price) : t.shares * t.price }))
        .concat([{ date: asOfDate, amount: currentValue }])
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      return xirr(flows);
    };

    return { workbook, calcFee, positions, summary, realizedSeries, ledger, fundXIRR };
  }, [workbook]);
}
