import { cashBalanceByCurrency } from '../../../lib/calc/cashModule';
import { totalBalanceByCurrency } from '../../../lib/calc/bankModule';
import { netPositionByCurrency } from '../../../lib/calc/personalLoansModule';
import { totalsByCurrency as emiTotalsByCurrency } from '../../../lib/calc/emiModule';
import { fundsValueByCurrency } from '../../../lib/calc/fundsModule';
import { computeNetWorthByCurrency, type CurrencyNetWorth } from '../../../lib/calc/netWorth';
import { useCashWorkbookStore } from '../../../store/cashWorkbookStore';
import { useBankWorkbookStore } from '../../../store/bankWorkbookStore';
import { usePersonalLoansWorkbookStore } from '../../../store/personalLoansWorkbookStore';
import { useEMIWorkbookStore } from '../../../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../../../store/fundsWorkbookStore';
import { useWorkbookStore } from '../../../store/workbookStore';
import { usePSXWorkbookStore } from '../../../store/psxWorkbookStore';
import { useQSEDerived } from '../../qse/hooks/useQSEDerived';
import { usePSXDerived } from '../../psx/hooks/usePSXDerived';

export interface NetWorthSummary {
  rows: CurrencyNetWorth[];
  /** Whichever currency the user has the largest (absolute) net exposure
   * in — falls back to 'USD' when there's no data yet to judge by. Used
   * both as `NetWorthPage`'s own first-ever preferred-currency default and
   * as the Dashboard rail's "which currency to show" pick, so both agree
   * on what "the" net worth figure means for a user with several
   * currencies in play. */
  biggestExposureCurrency: string;
}

/** Cross-module net worth aggregation (README item 39 / MODULES_PLAN.md
 * §16), extracted from `NetWorthPage.tsx` so the Dashboard's right-rail
 * summary panel (README Pending item 54) can reuse the exact same
 * assembly instead of duplicating seven store subscriptions and the
 * exchange-unused-skip logic. `NetWorthPage.tsx` itself now calls this too
 * — single source of truth for "what counts toward net worth," not two
 * copies that could drift. */
export function useNetWorthSummary(): NetWorthSummary {
  const cashEntries = useCashWorkbookStore((s) => s.workbook.entries);
  const bank = useBankWorkbookStore((s) => s.workbook);
  const personalLoans = usePersonalLoansWorkbookStore((s) => s.workbook);
  const emiLoans = useEMIWorkbookStore((s) => s.workbook.entries);
  const funds = useFundsWorkbookStore((s) => s.workbook);
  const qseSettings = useWorkbookStore((s) => s.workbook.settings);
  const psxSettings = usePSXWorkbookStore((s) => s.workbook.settings);
  const qse = useQSEDerived();
  const psx = usePSXDerived();

  const cash = cashBalanceByCurrency(cashEntries);
  const bankTotals = totalBalanceByCurrency(bank.settings.accounts, bank.transactions);
  const personalLoansNet = netPositionByCurrency(personalLoans.loans, personalLoans.repayments);
  const emiOutstanding: Record<string, number> = {};
  Object.entries(emiTotalsByCurrency(emiLoans)).forEach(([code, t]) => { emiOutstanding[code] = t.outstanding; });
  const fundsValues = fundsValueByCurrency(funds.funds, funds.transactions, funds.marketPrices);

  // Skip an exchange entirely if it's never been touched — otherwise an
  // unused QSE/PSX account always contributes a spurious "0" row in its
  // default currency, cluttering the summary for anyone who only uses one
  // exchange (or neither).
  const qseUsed = qse.workbook.transactions.length > 0 || qse.workbook.transfers.length > 0 || qse.workbook.adjustments.length > 0;
  const psxUsed = psx.workbook.transactions.length > 0 || psx.workbook.transfers.length > 0 || psx.workbook.adjustments.length > 0;

  const rows = computeNetWorthByCurrency({
    cash,
    bank: bankTotals,
    qse: qseUsed ? { [qseSettings.currency]: qse.summary.netWorth } : {},
    psx: psxUsed ? { [psxSettings.currency]: psx.summary.netWorth } : {},
    funds: fundsValues,
    personalLoansNet,
    emiOutstanding,
  });

  const biggestExposureCurrency = rows.length
    ? [...rows].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))[0].currency
    : 'USD';

  return { rows, biggestExposureCurrency };
}
