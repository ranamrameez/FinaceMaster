import { RiskCalculator } from '../../../components/RiskCalculator';
import { useQSEDerived } from '../hooks/useQSEDerived';
import { useQSEStockData } from '../hooks/useQSEStockData';

/** README item 20 / MODULES_PLAN.md §9: replaces the sidebar's link-out to
 * the legacy Risk_Analysis_Calculator.html with a native page. */
export function RiskAnalysisPage() {
  const { workbook, rows, calcFee } = useQSEDerived();
  const { tickerNames } = useQSEStockData();
  const { feePct, tick, currency } = workbook.settings;

  return (
    <div>
      <h1 className="pagetitle">Risk Analysis</h1>
      <p className="footer-note" style={{ marginTop: -8, marginBottom: 20 }}>
        Model averaging down into an existing position — new average cost, break-even, and a stress test on the
        result. This is planning support, not a recovery guarantee.
      </p>
      <RiskCalculator rows={rows} tickerNames={tickerNames} currency={currency} feePct={feePct} tick={tick} calcFee={calcFee} />
    </div>
  );
}
