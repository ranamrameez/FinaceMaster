import { cashSummary } from './cashSummary';
import { makeQSEFeeCalculator } from './fees';
import { makePSXFeeCalculator } from './psxFees';
import { cashBalanceByCurrency } from './cashModule';
import { assetBalanceByCurrency, creditCardLiabilityByCurrency as legacyCreditCardLiabilityByCurrency } from './bankModule';
import { creditCardLiabilityByCurrency } from './creditCardModule';
import { netPositionByCurrency } from './personalLoansModule';
import { totalsByCurrency as emiTotalsByCurrency } from './emiModule';
import { fundsValueByCurrency } from './fundsModule';
import { computeNetWorthByCurrency, mergeCurrencyTotals, type CurrencyNetWorth } from './netWorth';
import { includedBankAccounts, includedCreditCards, includedEmiLoans, includedFunds, includedPersonalLoans } from './netWorthInclusion';
import type { CashEntry, CashSettings } from '../../types/cashWorkbook';
import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';
import type { CreditCard, CreditCardTransaction } from '../../types/creditCard';
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
  cashSettings: CashSettings;
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  creditCards: CreditCard[];
  creditCardTransactions: CreditCardTransaction[];
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
 * recomputed from the already-filtered arrays instead of the full history.
 *
 * User-requested (2026-09-06): "let the user choose (checkboxes?) to
 * include the accounts in the Net calcs" — every entity array is also
 * filtered through `netWorthInclusion.ts`'s `included*` helpers here, same
 * as `useNetWorthSummary`'s "today" figure, so an excluded account/loan/
 * fund stays excluded for every past month too, not just the live one. */
export function netWorthAsOfDate(asOfDate: string, inputs: NetWorthAsOfInputs): CurrencyNetWorth[] {
  const cash = inputs.cashSettings.includeInNetWorth === false
    ? {}
    : cashBalanceByCurrency(inputs.cashEntries.filter((e) => e.date <= asOfDate));

  // User-reported (2026-09-06): "charts and tables show incorrect/mock data
  // when they find nothing in a month" — `accountBalance()` unconditionally
  // adds a Bank account's `openingBalance` regardless of `asOfDate`, but
  // that value is really "the balance as of whenever the account's history
  // was last seeded/imported" (often close to today), not a figure that
  // held true since the account's creation. Left unguarded, an account with
  // real transactions only from (say) 2026 still "existed" with its full
  // opening balance for every earlier month too — a phantom balance for a
  // period the account has zero evidence for, not genuinely "no data."
  // Fixed the same way QSE/PSX already gate themselves above/below
  // (`qseHasActivity`/`psxHasActivity`): only count an account once it has
  // at least one real transaction on or before `asOfDate` — exactly mirrors
  // `useNetWorthSummary`'s own "today" figure once enough time has passed
  // for that to be trivially true, so "today" itself is never affected;
  // only a date before an account's own first transaction newly excludes
  // it, which is correct since nothing is actually known about it that far
  // back. An account with literally zero transactions ever (e.g. one just
  // created with an opening balance and nothing logged) never appears in
  // any past-month figure — only in the live "today" one — since there is
  // no known date its balance ever held.
  const includedAccounts = includedBankAccounts(inputs.bankAccounts).filter((a) =>
    inputs.bankTransactions.some((t) => t.accountId === a.id && t.date <= asOfDate),
  );
  const bankTxAsOf = inputs.bankTransactions.filter((t) => t.date <= asOfDate);
  const bank = assetBalanceByCurrency(includedAccounts, bankTxAsOf);
  const creditCardTxAsOf = inputs.creditCardTransactions.filter((t) => t.date <= asOfDate);
  const creditCards = mergeCurrencyTotals(
    legacyCreditCardLiabilityByCurrency(includedAccounts, bankTxAsOf),
    creditCardLiabilityByCurrency(includedCreditCards(inputs.creditCards), creditCardTxAsOf),
  );

  const loansAsOf = includedPersonalLoans(inputs.personalLoans).filter((l) => l.date <= asOfDate);
  const repaymentsAsOf = inputs.personalLoanRepayments.filter((r) => r.date <= asOfDate);
  const personalLoansNet = netPositionByCurrency(loansAsOf, repaymentsAsOf);

  const emiLoansAsOf = includedEmiLoans(inputs.emiLoans).filter((l) => l.startDate <= asOfDate);
  const emiTotals = emiTotalsByCurrency(emiLoansAsOf, new Date(asOfDate));
  const emiOutstanding: Record<string, number> = {};
  Object.entries(emiTotals).forEach(([code, t]) => { emiOutstanding[code] = t.outstanding; });

  const fundsTxAsOf = inputs.fundsTransactions.filter((t) => t.date <= asOfDate);
  const fundsPricesAsOf = marketPricesAsOf(fundsTxAsOf, inputs.fundsPriceHistory, asOfDate);
  const fundsValues = fundsValueByCurrency(includedFunds(inputs.fundsFunds), fundsTxAsOf, fundsPricesAsOf);

  const qseTxAsOf = inputs.qseTransactions.filter((t) => t.date <= asOfDate);
  const qseTransfersAsOf = inputs.qseTransfers.filter((t) => t.date <= asOfDate);
  const qseAdjustmentsAsOf = inputs.qseAdjustments.filter((a) => a.date <= asOfDate);
  const qseHasActivity = qseTxAsOf.length > 0 || qseTransfersAsOf.length > 0 || qseAdjustmentsAsOf.length > 0;
  let qse: Record<string, number> = {};
  if (qseHasActivity && inputs.qseSettings.includeInNetWorth !== false) {
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
  if (psxHasActivity && inputs.psxSettings.includeInNetWorth !== false) {
    const psxCalcFee = makePSXFeeCalculator(inputs.psxSettings, psxTxAsOf);
    const psxPricesAsOf = marketPricesAsOf(psxTxAsOf, inputs.psxPriceHistory, asOfDate);
    const psxSummary = cashSummary(psxTxAsOf, psxTransfersAsOf, psxAdjustmentsAsOf, psxPricesAsOf, psxCalcFee);
    psx = { [inputs.psxSettings.currency]: psxSummary.netWorth };
  }

  return computeNetWorthByCurrency({ cash, bank, qse, psx, funds: fundsValues, personalLoansNet, emiOutstanding, creditCards });
}

/** The earliest real date across every module `netWorthAsOfDate` reads —
 * user-reported (2026-09-06): "monthly widgets are moving without a check
 * of user's first date of transaction," i.e. the Net Worth monthly
 * window's ◀ Earlier button could scroll indefinitely into the past with
 * nothing to stop it, well before the user ever had any data at all.
 * Callers use this as a floor: never show (or navigate to) a month before
 * this one, since a month with no real evidence anywhere isn't "empty," it
 * genuinely doesn't exist for this user yet. Returns `undefined` when
 * NOTHING dated is found anywhere (a brand new, fully empty account) — a
 * caller should fall back to its own default range rather than clamp to
 * nothing. EMI loans are keyed by `startDate` (a loan has no transaction
 * log of its own until installments begin); every other module here is
 * keyed by its own real transaction/entry date, same field
 * `netWorthAsOfDate` itself filters on. */
export function earliestActivityDate(inputs: NetWorthAsOfInputs): string | undefined {
  const dates: string[] = [
    ...inputs.cashEntries.map((e) => e.date),
    ...inputs.bankTransactions.map((t) => t.date),
    ...inputs.creditCardTransactions.map((t) => t.date),
    ...inputs.personalLoans.map((l) => l.date),
    ...inputs.personalLoanRepayments.map((r) => r.date),
    ...inputs.emiLoans.map((l) => l.startDate),
    ...inputs.fundsTransactions.map((t) => t.date),
    ...inputs.qseTransactions.map((t) => t.date),
    ...inputs.qseTransfers.map((t) => t.date),
    ...inputs.qseAdjustments.map((a) => a.date),
    ...inputs.psxTransactions.map((t) => t.date),
    ...inputs.psxTransfers.map((t) => t.date),
    ...inputs.psxAdjustments.map((a) => a.date),
  ];
  return dates.length ? dates.reduce((min, d) => (d < min ? d : min)) : undefined;
}
