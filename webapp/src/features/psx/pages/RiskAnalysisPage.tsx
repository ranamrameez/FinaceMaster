import { RiskCalculator } from '../../../components/RiskCalculator';
import { usePSXDerived } from '../hooks/usePSXDerived';
import { usePSXStockData } from '../hooks/usePSXStockData';

/** PSX's equivalent of the QSE RiskAnalysisPage — same shared calculator,
 * PSX's own store/fee model (tiered per-share fees, same-day netting). */
export function RiskAnalysisPage() {
  const { workbook, rows, calcFee } = usePSXDerived();
  const { tickerNames } = usePSXStockData();
  const { feePct, tick, currency } = workbook.settings;

  return (
    <div>
      <h1 className="pagetitle">PSX Risk Analysis</h1>
      <p className="footer-note" style={{ marginTop: -8, marginBottom: 20 }}>
        Model averaging down into an existing position — new average cost, break-even, and a stress test on the
        result. This is planning support, not a recovery guarantee.
      </p>
      <RiskCalculator rows={rows} tickerNames={tickerNames} currency={currency} feePct={feePct} tick={tick} calcFee={calcFee} />
    </div>
  );
}
