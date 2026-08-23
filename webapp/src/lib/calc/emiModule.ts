import type { EMILoan } from '../../types/emiWorkbook';

export interface EMIScheduleRow {
  month: number;
  emi: number;
  interest: number; // "markup" in fixed-total mode
  principalComp: number;
  balance: number;
}

/** Amortization schedule for one loan, either repayment mode. Ported from
 * the reference prototype (`reference/finance-suite-prototype/`), same
 * formulas:
 * - interest mode: standard reducing-balance EMI.
 * - fixedTotal mode (no-interest/Sharia-compliant): straight-line
 *   principal reduction, markup spread evenly, no compounding. */
export function emiSchedule(loan: EMILoan): { emi: number; rows: EMIScheduleRow[] } {
  const n = loan.tenureMonths;
  if (loan.repaymentMode === 'fixedTotal') {
    const total = loan.totalToReturn ?? loan.principal;
    const installment = total / n;
    const principalPerMonth = loan.principal / n;
    const markupPerMonth = (total - loan.principal) / n;
    let balance = loan.principal;
    const rows: EMIScheduleRow[] = [];
    for (let m = 1; m <= n; m++) {
      balance = Math.max(0, balance - principalPerMonth);
      rows.push({ month: m, emi: installment, interest: markupPerMonth, principalComp: principalPerMonth, balance });
    }
    return { emi: installment, rows };
  }

  const r = (loan.annualRatePct ?? 0) / 12 / 100;
  const emi = r === 0 ? loan.principal / n : (loan.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let balance = loan.principal;
  const rows: EMIScheduleRow[] = [];
  for (let m = 1; m <= n; m++) {
    const interest = balance * r;
    const principalComp = emi - interest;
    balance = Math.max(0, balance - principalComp);
    rows.push({ month: m, emi, interest, principalComp, balance });
  }
  return { emi, rows };
}

export interface EMISummary {
  emi: number;
  outstanding: number;
  paidSoFar: number;
  interestSoFar: number;
  totalInterest: number;
  monthsRemaining: number;
  elapsed: number;
  rows: EMIScheduleRow[];
}

/** Outstanding balance / paid-so-far / interest-so-far, read off the
 * schedule at the row for however many full months have elapsed since
 * `startDate` — assumes on-schedule payment (no missed/late-payment
 * tracking in v1, matching the reference prototype's own deferred scope). */
export function emiSummary(loan: EMILoan, asOf: Date = new Date()): EMISummary {
  const { emi, rows } = emiSchedule(loan);
  const start = new Date(loan.startDate);
  let elapsed = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  elapsed = Math.max(0, Math.min(elapsed, loan.tenureMonths));
  const outstanding = elapsed === 0 ? loan.principal : rows[elapsed - 1].balance;
  const paidSoFar = elapsed * emi;
  const interestSoFar = rows.slice(0, elapsed).reduce((s, r) => s + r.interest, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const monthsRemaining = loan.tenureMonths - elapsed;
  return { emi, outstanding, paidSoFar, interestSoFar, totalInterest, monthsRemaining, elapsed, rows };
}

export interface EMITotals {
  monthlyInstallment: number;
  outstanding: number;
  paidSoFar: number;
}

/** Aggregate stats across every loan, grouped by currency — feeds the
 * main EMI/Loans landing page's summary cards (README item 23 / user
 * feedback: every module needs an overall-stats view, not just per-loan
 * detail). Never blended across currencies, same rule as every other
 * module's totals. */
export function totalsByCurrency(loans: EMILoan[], asOf: Date = new Date()): Record<string, EMITotals> {
  const out: Record<string, EMITotals> = {};
  loans.forEach((loan) => {
    const sum = emiSummary(loan, asOf);
    if (!out[loan.currencyCode]) out[loan.currencyCode] = { monthlyInstallment: 0, outstanding: 0, paidSoFar: 0 };
    out[loan.currencyCode].monthlyInstallment += sum.emi;
    out[loan.currencyCode].outstanding += sum.outstanding;
    out[loan.currencyCode].paidSoFar += sum.paidSoFar;
  });
  return out;
}
