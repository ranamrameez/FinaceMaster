import type { EMILoan, EMIRepayment } from '../../types/emiWorkbook';

export interface EMIScheduleRow {
  month: number;
  emi: number;
  interest: number; // "markup" in fixed-total mode
  principalComp: number;
  balance: number;
  /** True when this month's payment came from `EMILoan.installmentOverrides`
   * rather than the regular computed installment (README item 6 of a
   * 2026-08-26 feedback batch — some loans have irregular real-world terms,
   * e.g. a bigger payment every 6th month). */
  overridden?: boolean;
  /** True on the one auto-computed "true-up" final payment that closes out
   * whatever `customMonthlyPayment` (see `EMILoan`'s own doc comment)
   * happened to leave outstanding — distinct from `overridden`, since the
   * user didn't type this specific amount in, the engine computed it. */
  isBalloon?: boolean;
}

/** Amortization schedule for one loan, either repayment mode. Ported from
 * the reference prototype (`reference/finance-suite-prototype/`), same
 * formulas:
 * - interest mode: standard reducing-balance EMI.
 * - fixedTotal mode (no-interest/Sharia-compliant): straight-line
 *   principal reduction, markup spread evenly, no compounding.
 *
 * `loan.installmentOverrides` (keyed by 1-indexed month) substitutes a
 * different actual payment for a specific month — every later month's
 * balance/interest recalculates from whatever was actually paid, and the
 * loop stops early if an override pays the loan off before its full
 * tenure (same early-stop idea `whatIfExtraPayment` already uses). In
 * fixedTotal mode, an overridden payment keeps the SAME principal:markup
 * split ratio as the regular installment — there's no compounding to
 * recompute there, just a bigger/smaller slice of the same straight-line
 * split.
 *
 * `loan.customMonthlyPayment` (user-reported request: "set custom monthly
 * EMI, remaining amount charged in the final EMI") substitutes a single
 * fixed payment for every month instead of the computed amortizing EMI —
 * unlike `installmentOverrides`, which is set per month by hand, this is
 * one number applied everywhere an override doesn't already win. Because a
 * fixed payment generally doesn't divide the loan evenly by month `n`
 * (it's not solved for like the real EMI formula is), the LAST month is a
 * "balloon": the engine charges whatever's actually still owed — the
 * remaining balance plus that month's own interest/markup — instead of
 * repeating `customMonthlyPayment` and either leaving a residual balance
 * or overshooting. If `customMonthlyPayment` already happens to fully
 * amortize the loan before month `n` (or exactly at it), the existing
 * `balance <= 0.01` early-stop fires first and there's no separate
 * balloon row — the schedule just ends, same as any other early payoff. */
export function emiSchedule(loan: EMILoan): { emi: number; rows: EMIScheduleRow[] } {
  const n = loan.tenureMonths;
  const overrides = loan.installmentOverrides;
  const customPayment = loan.customMonthlyPayment;
  if (loan.repaymentMode === 'fixedTotal') {
    const total = loan.totalToReturn ?? loan.principal;
    const installment = total / n;
    const principalPerMonth = loan.principal / n;
    const principalRatio = installment > 0 ? principalPerMonth / installment : 1;
    const totalMarkup = total - loan.principal;
    let balance = loan.principal;
    let markupSoFar = 0;
    const rows: EMIScheduleRow[] = [];
    for (let m = 1; m <= n; m++) {
      const override = overrides?.[m];
      const isBalloon = override == null && customPayment != null && m === n;
      let payment: number;
      let principalComp: number;
      let markup: number;
      if (isBalloon) {
        // True up: pay off whatever principal and markup are still
        // outstanding, so the loan's grand total still equals `total`
        // regardless of how `customMonthlyPayment` compared to the
        // regular installment in every prior month.
        principalComp = balance;
        markup = totalMarkup - markupSoFar;
        payment = principalComp + markup;
      } else {
        payment = override ?? customPayment ?? installment;
        principalComp = payment * principalRatio;
        markup = payment - principalComp;
      }
      balance = Math.max(0, balance - principalComp);
      markupSoFar += markup;
      rows.push({ month: m, emi: payment, interest: markup, principalComp, balance, overridden: override != null, isBalloon });
      if (balance <= 0.01) break;
    }
    return { emi: customPayment ?? installment, rows };
  }

  const r = (loan.annualRatePct ?? 0) / 12 / 100;
  const emi = r === 0 ? loan.principal / n : (loan.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let balance = loan.principal;
  const rows: EMIScheduleRow[] = [];
  for (let m = 1; m <= n; m++) {
    const override = overrides?.[m];
    const interest = balance * r;
    const isBalloon = override == null && customPayment != null && m === n;
    // Balloon: closes the loan out exactly (balance + this month's own
    // interest), rather than charging `customPayment` again and leaving a
    // residual balance or overshooting past zero.
    const payment = isBalloon ? balance + interest : (override ?? customPayment ?? emi);
    const principalComp = payment - interest;
    balance = Math.max(0, balance - principalComp);
    rows.push({ month: m, emi: payment, interest, principalComp, balance, overridden: override != null, isBalloon });
    if (balance <= 0.01) break;
  }
  return { emi: customPayment ?? emi, rows };
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
 * tracking in v1, matching the reference prototype's own deferred scope).
 * Clamps against `rows.length`, not `loan.tenureMonths` — with per-month
 * overrides the schedule can now legitimately finish early, and
 * `paidSoFar` sums each row's own actual payment (not `elapsed * emi`)
 * so an overridden month is reflected correctly. */
export function emiSummary(loan: EMILoan, asOf: Date = new Date()): EMISummary {
  const { emi, rows } = emiSchedule(loan);
  const start = new Date(loan.startDate);
  let elapsed = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  elapsed = Math.max(0, Math.min(elapsed, rows.length));
  const outstanding = elapsed === 0 ? loan.principal : rows[elapsed - 1].balance;
  const paidSoFar = rows.slice(0, elapsed).reduce((s, r) => s + r.emi, 0);
  const interestSoFar = rows.slice(0, elapsed).reduce((s, r) => s + r.interest, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const monthsRemaining = rows.length - elapsed;
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
  if (loan.paymentDayOfMonth) {
    // Same day-doesn't-exist-in-target-month clamp `setMonth` already gives
    // us for free (day 31 landing in February clamps to the 28th/29th) —
    // setting the date AFTER the month has already rolled forward, on a
    // fresh Date anchored to that target month's 1st, gets the same
    // clamping behavior for a day-of-month that isn't `startDate`'s own.
    const target = new Date(d.getFullYear(), d.getMonth(), 1);
    target.setDate(loan.paymentDayOfMonth);
    // setDate on the 1st with a day beyond that month's length rolls into
    // the NEXT month instead of clamping — pull back to the target month's
    // actual last day when that happens.
    if (target.getMonth() !== d.getMonth()) target.setDate(0);
    return target.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/** The due date actually shown/exported for one schedule row — prefers a
 * specific `EMIRepayment.date` for that month when one exists (the "well
 * editable for individual EMI" half of the 2026-08-26 request: a whole-loan
 * `paymentDayOfMonth` sets the default, one month's own repayment record can
 * still be pinned to a different date on top of that), falling back to the
 * computed `installmentDueDate` otherwise. */
export function resolvedDueDate(loan: EMILoan, month: number, repayments?: EMIRepayment[]): string {
  const custom = repayments?.find((r) => r.loanId === loan.id && r.month === month)?.date;
  return custom || installmentDueDate(loan, month);
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

export interface BigEmiOptions {
  /** e.g. 6 for "a bigger payment every 6 months". */
  intervalMonths: number;
  /** The amount typed by the user for a major month — either the WHOLE
   * payment for that month ('majorOnly') or an extra amount stacked on top
   * of the regular installment ('regularPlusMajor'), per the user's own
   * 2026-08-26 clarification that both should be supported. */
  amount: number;
  mode: 'majorOnly' | 'regularPlusMajor';
  /** User's own explicit choice (2026-08-26, via AskUserQuestion): on by
   * default. See this function's own doc comment for what it does. */
  reconcileLastMonth: boolean;
}

/** "Big EMI every N months" recurring-installment generator (2026-08-26,
 * user-requested — design forks resolved with the user via AskUserQuestion
 * before building). Distinct from a single by-hand `installmentOverrides`
 * entry: this computes a BATCH of major-month overrides at once. The user
 * explicitly chose to KEEP the loan's original `tenureMonths` rather than
 * let the extra payments finish it early (unlike `whatIfExtraPayment`,
 * which is deliberately the opposite — an early-finish planner) — so when
 * `reconcileLastMonth` is on, whatever the regular schedule would still owe
 * at month `tenureMonths`, after every major-month override is applied,
 * gets swept into that final month's own override, the same "true up the
 * last payment" idea `customMonthlyPayment`'s balloon already uses (see
 * `emiSchedule`'s own doc comment), just anchored to the loan's actual
 * declared tenure instead of wherever a fixed payment happens to clear the
 * balance. Reuses `emiSchedule()` itself to compute the pre-reconciliation
 * balances rather than duplicating the amortization loop. If the majors are
 * big enough that the loan is ALREADY fully paid off before `tenureMonths`
 * on the schedule's own early-stop, there's genuinely no remaining debt to
 * reconcile at the final month — this function leaves that case alone
 * rather than fabricating a payment for debt that no longer exists (the
 * same "can't force tenure past a real payoff" tradeoff `customMonthlyPayment`
 * already accepts). Returns a plain `{month: amount}` map — the caller is
 * responsible for turning that into real `EMIRepayment` records (add or
 * update, month by month), same as a manual override already does. */
export function generateBigEmiOverrides(loan: EMILoan, fromMonth: number, opts: BigEmiOptions): Record<number, number> {
  const n = loan.tenureMonths;
  const start = Math.max(1, fromMonth);
  const overrides: Record<number, number> = {};
  if (start > n || !(opts.intervalMonths > 0)) return overrides;

  const regular = loan.repaymentMode === 'fixedTotal'
    ? (loan.customMonthlyPayment ?? (loan.totalToReturn ?? loan.principal) / n)
    : (loan.customMonthlyPayment ?? emiSchedule({ ...loan, installmentOverrides: undefined, customMonthlyPayment: undefined }).emi);

  for (let m = opts.intervalMonths; m <= n; m += opts.intervalMonths) {
    if (m < start) continue;
    overrides[m] = opts.mode === 'majorOnly' ? opts.amount : regular + opts.amount;
  }

  if (opts.reconcileLastMonth) {
    const candidate: EMILoan = { ...loan, installmentOverrides: { ...loan.installmentOverrides, ...overrides } };
    const schedule = emiSchedule(candidate);
    if (schedule.rows.length >= n) {
      // Didn't finish early on its own — figure out what's still owed
      // heading into the final month and true it up.
      const beforeFinal = n === 1 ? undefined : schedule.rows[n - 2];
      const balanceBeforeFinal = beforeFinal ? beforeFinal.balance : loan.principal;
      if (balanceBeforeFinal > 0.01) {
        if (loan.repaymentMode === 'fixedTotal') {
          const total = loan.totalToReturn ?? loan.principal;
          const totalMarkup = total - loan.principal;
          const markupSoFar = n === 1 ? 0 : schedule.rows.slice(0, n - 1).reduce((s, r) => s + r.interest, 0);
          overrides[n] = balanceBeforeFinal + (totalMarkup - markupSoFar);
        } else {
          const r = (loan.annualRatePct ?? 0) / 12 / 100;
          overrides[n] = balanceBeforeFinal + balanceBeforeFinal * r;
        }
      }
    }
    // Otherwise the schedule already finished early on its own — nothing
    // left owed at month n to reconcile.
  }

  return overrides;
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
