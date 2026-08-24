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

/** Calendar date a given schedule row (1-indexed month) is due, and the
 * loan's overall expected end date (its last installment's due date) —
 * both derived from `startDate` the same way, so they stay consistent
 * with each other. `setMonth` naturally clamps a day that doesn't exist
 * in the target month (e.g. day 31 landing in February) to that month's
 * last day, which is an accepted simplification here, same tradeoff as
 * the reference prototype and the rest of this app's date-math (no
 * calendar library dependency). */
export function installmentDueDate(loan: EMILoan, month: number): string {
  const d = new Date(loan.startDate);
  d.setMonth(d.getMonth() + month);
  return d.toISOString().slice(0, 10);
}

export function expectedEndDate(loan: EMILoan): string {
  return installmentDueDate(loan, loan.tenureMonths);
}

export interface WhatIfPayoff {
  months: number;
  totalInterest: number;
  interestSaved: number;
  monthsSaved: number;
  newEndDate: string;
}

/** "What if I paid extra each month" planner (MODULES_PLAN.md §11): given
 * a fixed extra amount on top of the normal installment, how much sooner
 * does the loan clear and how much interest/markup is saved. A live,
 * unsaved projection — nothing here is persisted, same as Personal Loans'
 * `projectPayoff`.
 *
 * Interest mode: recomputes the reducing-balance schedule with `emi +
 * extraPerMonth` as the actual monthly payment, stopping once the balance
 * is cleared (capped at the loan's own tenure — extra payment can only
 * ever finish at or before the original schedule, never after).
 *
 * Fixed-total mode has no compounding to reduce, so "interest saved" here
 * is the markup for the months skipped entirely — the accepted
 * simplification is that markup is a flat per-month servicing charge tied
 * to how long the loan stays open, prorated by number of months actually
 * paid, not a fixed total the borrower owes regardless of payoff speed
 * (this is a deliberate reading of the "no compounding" model already
 * used by `emiSchedule`, not a claim about any specific real lender's
 * early-payoff terms). */
export function whatIfExtraPayment(loan: EMILoan, extraPerMonth: number): WhatIfPayoff {
  const base = emiSchedule(loan);
  const baseTotalInterest = base.rows.reduce((s, r) => s + r.interest, 0);
  if (!(extraPerMonth > 0)) {
    return { months: loan.tenureMonths, totalInterest: baseTotalInterest, interestSaved: 0, monthsSaved: 0, newEndDate: expectedEndDate(loan) };
  }

  if (loan.repaymentMode === 'fixedTotal') {
    const total = loan.totalToReturn ?? loan.principal;
    const principalPerMonth = loan.principal / loan.tenureMonths;
    const markupPerMonth = (total - loan.principal) / loan.tenureMonths;
    const months = Math.min(loan.tenureMonths, Math.ceil(loan.principal / (principalPerMonth + extraPerMonth)));
    const totalInterest = markupPerMonth * months;
    return { months, totalInterest, interestSaved: baseTotalInterest - totalInterest, monthsSaved: loan.tenureMonths - months, newEndDate: installmentDueDate(loan, months) };
  }

  const r = (loan.annualRatePct ?? 0) / 12 / 100;
  const payment = base.emi + extraPerMonth;
  let balance = loan.principal;
  let totalInterest = 0;
  let months = 0;
  while (balance > 0.01 && months < loan.tenureMonths) {
    const interest = balance * r;
    const principalComp = Math.min(balance, payment - interest);
    totalInterest += interest;
    balance -= principalComp;
    months++;
  }
  return { months, totalInterest, interestSaved: baseTotalInterest - totalInterest, monthsSaved: loan.tenureMonths - months, newEndDate: installmentDueDate(loan, months) };
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
