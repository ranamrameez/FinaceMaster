import { cashSummary } from './cashSummary';
import { makeQSEFeeCalculator } from './fees';
import { makePSXFeeCalculator } from './psxFees';
import { cashBalanceByCurrency } from './cashModule';
import { assetBalanceByCurrency, creditCardLiabilityByCurrency } from './bankModule';
import { netPositionByCurrency } from './personalLoansModule';
import { totalsByCurrency as emiTotalsByCurrency } from './emiModule';
import { fundsValueByCurrency } from './fundsModule';
import { computeNetWorthByCurrency, type CurrencyNetWorth } from './netWorth';
import type { CashEntry } from '../../types/cashWorkbook';
import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';
import type { PersonalLoan, PersonalLoanRepayment } from '../../types/personalLoansWorkbook';
import type { EMILoan } from '../../types/emiWorkbook';
import type { Fund } from '../../types/fundsWorkbook';
import type { Adjustment, PricePoint, QSESettings, Transaction, Transfer } from '../../types/workbook';
import type { PSXSettings } from '../../types/psxWorkbook';

/** The known price for a ticker AS OF a given date, not "right now" — the
 * missing piece needed to value a stock/fund position historically, since
 * `getMarketPrice`'s own cached `marketPrices[ticker]` only ever reflects
 * TODAY's manually-set current price. Scans the raw price-history log for
 * the latest point on or before `asOfDate` (plain date-string comparison —
 * a monthly-granularity question doesn't need instant-level precision).
 * Returns 0 (never a guess) when nothing is known that far back — the
 * caller's own `getMarketPrice` (inside `cashSummary`/`fundsValueByCurrency`)
 * already has a second, independent fallback for exactly this case (the
 * last BUY price at or before the same date, since callers here always
 * pass an already date-filtered transaction list) — returning 0 just lets
 * that existing fallback take over rather than duplicating it. */
export function priceAsOfDate(ticker: string, priceHistory: Record<string, PricePoint[]>, asOfDate: string): number {
  const points = (priceHistory[ticker] ?? []).filter((p) => p.date <= asOfDate);
  if (!points.length) return 0;
  return [...points].sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date)).pop()!.price;
}

function marketPricesAsOf(transactions: Transaction[], priceHistory: Record<string, PricePoint[]>, asOfDate: string): Record<string, number> {
  const tickers = [...new Set(transactions.map((t) => t.ticker))];
  return Object.fromEntries(tickers.map((t) => [t, priceAsOfDate(t, priceHistory, asOfDate)]));
}

export interface NetWorthAsOfInputs {
  cashEntries: CashEntry[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  personalLoans: PersonalLoan[];
  personalLoanRepayments: PersonalLoanRepayment[];
  emiLoans: EMILoan[];
  fundsFunds: Fund[];
  fundsTransactions: Transaction[];
  fundsPriceHistory: Record<string, PricePoint[]>;
  qseTransactions: Transaction[];
  qseTransfers: Transfer[];
  qseAdjustments: Adjustment[];
  qsePriceHistory: Record<string, PricePoint[]>;
  qseSettings: QSESettings;
  psxTransactions: Transaction[];
  psxTransfers: Transfer[];
  psxAdjustments: Adjustment[];
  psxPriceHistory: Record<string, PricePoint[]>;
  psxSettings: PSXSettings;
}

/** Real point-in-time Net Worth — "the sum of all accounts" as they
 * actually stood on `asOfDate`, not a projection. User-reported
 * (2026-09-04): "Monthly Net Worth should be the sum of all accounts on
 * the last day of a month" — the app's Net Worth trend used to read PAST
 * months from sporadically-saved `NetWorthSnapshot`s (showing "—" for any
 * month before the snapshot feature existed, or one that was simply never
 * saved that day). This instead re-derives the real figure for ANY date
 * directly from each module's own transaction/entry log, filtered to
 * `date <= asOfDate` before calling the exact same per-module total
 * functions the LIVE ("today") Net Worth figure already uses
 * (`useNetWorthSummary`) — so a past month's number is computed the
 * identical way "today" always has been, just with an earlier cutoff, and
 * works for any date with real transaction history regardless of whether
 * a snapshot was ever saved for it.
 *
 * QSE/PSX/Funds need one extra step past a plain date-filter: their value
 * depends on a STOCK/NAV PRICE, which changes over time — see
 * `priceAsOfDate` above for how the historical price is resolved. Personal
 * Loans/EMI need their own record types (not just transactions) filtered
 * too — a loan/EMI schedule that didn't exist yet as of `asOfDate` must
 * not contribute a liability for a date before it was ever taken out
 * (`emiSummary`'s own elapsed-installment math would otherwise still
 * report the full opening balance as "outstanding" for a loan whose
 * `startDate` is actually still in the future relative to `asOfDate`).
 *
 * An exchange/module with zero activity as of `asOfDate` is simply absent
 * from the result (via `computeNetWorthByCurrency`'s own zero-amount
 * filtering upstream in `NetWorthInputs`) rather than shown as a spurious
 * 0 — same rule `useNetWorthSummary`'s own `qseUsed`/`psxUsed` checks
 * apply for "today," just naturally date-bounded here since the flag is
 * recomputed from the already-filtered arrays instead of the full history. */
export function netWorthAsOfDate(asOfDate: string, inputs: NetWorthAsOfInputs): CurrencyNetWorth[] {
  const cash = cashBalanceByCurrency(inputs.cashEntries.filter((e) => e.date <= asOfDate));

  const bankTxAsOf = inputs.bankTransactions.filter((t) => t.date <= asOfDate);
  const bank = assetBalanceByCurrency(inputs.bankAccounts, bankTxAsOf);
  const creditCards = creditCardLiabilityByCurrency(inputs.bankAccounts, bankTxAsOf);

  const loansAsOf = inputs.personalLoans.filter((l) => l.date <= asOfDate);
  const repaymentsAsOf = inputs.personalLoanRepayments.filter((r) => r.date <= asOfDate);
  const personalLoansNet = netPositionByCurrency(loansAsOf, repaymentsAsOf);

  const emiLoansAsOf = inputs.emiLoans.filter((l) => l.startDate <= asOfDate);
  const emiTotals = emiTotalsByCurrency(emiLoansAsOf, new Date(asOfDate));
  const emiOutstanding: Record<string, number> = {};
  Object.entries(emiTotals).forEach(([code, t]) => { emiOutstanding[code] = t.outstanding; });

  const fundsTxAsOf = inputs.fundsTransactions.filter((t) => t.date <= asOfDate);
  const fundsPricesAsOf = marketPricesAsOf(fundsTxAsOf, inputs.fundsPriceHistory, asOfDate);
  const fundsValues = fundsValueByCurrency(inputs.fundsFunds, fundsTxAsOf, fundsPricesAsOf);

  const qseTxAsOf = inputs.qseTransactions.filter((t) => t.date <= asOfDate);
  const qseTransfersAsOf = inputs.qseTransfers.filter((t) => t.date <= asOfDate);
  const qseAdjustmentsAsOf = inputs.qseAdjustments.filter((a) => a.date <= asOfDate);
  const qseHasActivity = qseTxAsOf.length > 0 || qseTransfersAsOf.length > 0 || qseAdjustmentsAsOf.length > 0;
  let qse: Record<string, number> = {};
  if (qseHasActivity) {
    const qseCalcFee = makeQSEFeeCalculator(inputs.qseSettings);
    const qsePricesAsOf = marketPricesAsOf(qseTxAsOf, inputs.qsePriceHistory, asOfDate);
    const qseSummary = cashSummary(qseTxAsOf, qseTransfersAsOf, qseAdjustmentsAsOf, qsePricesAsOf, qseCalcFee);
    qse = { [inputs.qseSettings.currency]: qseSummary.netWorth };
  }

  const psxTxAsOf = inputs.psxTransactions.filter((t) => t.date <= asOfDate);
  const psxTransfersAsOf = inputs.psxTransfers.filter((t) => t.date <= asOfDate);
  const psxAdjustmentsAsOf = inputs.psxAdjustments.filter((a) => a.date <= asOfDate);
  const psxHasActivity = psxTxAsOf.length > 0 || psxTransfersAsOf.length > 0 || psxAdjustmentsAsOf.length > 0;
  let psx: Record<string, number> = {};
  if (psxHasActivity) {
    const psxCalcFee = makePSXFeeCalculator(inputs.psxSettings, psxTxAsOf);
    const psxPricesAsOf = marketPricesAsOf(psxTxAsOf, inputs.psxPriceHistory, asOfDate);
    const psxSummary = cashSummary(psxTxAsOf, psxTransfersAsOf, psxAdjustmentsAsOf, psxPricesAsOf, psxCalcFee);
    psx = { [inputs.psxSettings.currency]: psxSummary.netWorth };
  }

  return computeNetWorthByCurrency({ cash, bank, qse, psx, funds: fundsValues, personalLoansNet, emiOutstanding, creditCards });
}
