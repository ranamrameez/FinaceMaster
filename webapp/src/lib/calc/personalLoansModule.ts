import type { PersonalLoan, PersonalLoanRepayment } from '../../types/personalLoansWorkbook';

export function loanOutstanding(loan: PersonalLoan, repayments: PersonalLoanRepayment[]): number {
  const repaid = repayments.filter((r) => r.loanId === loan.id).reduce((s, r) => s + r.amount, 0);
  return Math.max(0, loan.principal - repaid);
}

/** Running "remaining outstanding" after each repayment to this loan, in
 * date order — user-reported gap: no running balance column on the
 * repayments list, only the loan's current total (`loanOutstanding`).
 * Returns a map keyed by `PersonalLoanRepayment.id` so the caller can look
 * up a value regardless of what order the table is currently sorted in
 * (same pattern as `transferRunningBalance`). Clamped at 0 per-row like
 * `loanOutstanding` itself — an overpayment shows the loan as settled, not
 * negative. */
export function repaymentRunningOutstanding(loan: PersonalLoan, repayments: PersonalLoanRepayment[]): Map<string, number> {
  const forLoan = repayments
    .filter((r) => r.loanId === loan.id)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.date.localeCompare(b.r.date) || a.i - b.i);
  const out = new Map<string, number>();
  let remaining = loan.principal;
  for (const { r } of forLoan) {
    remaining = Math.max(0, remaining - r.amount);
    out.set(r.id, remaining);
  }
  return out;
}

/** Net position per currency: positive means net owed *to* you, negative
 * means you owe net overall, in that currency. Never blended across
 * currencies — no live FX-rate source (see MODULES_PLAN.md). */
export function netPositionByCurrency(loans: PersonalLoan[], repayments: PersonalLoanRepayment[]): Record<string, number> {
  const out: Record<string, number> = {};
  loans.forEach((loan) => {
    const outstanding = loanOutstanding(loan, repayments);
    const sign = loan.direction === 'owed_to_me' ? 1 : -1;
    out[loan.currencyCode] = (out[loan.currencyCode] || 0) + sign * outstanding;
  });
  return out;
}

export interface LoanOutstandingRow {
  loanId: string;
  person: string;
  direction: PersonalLoan['direction'];
  outstanding: number;
}

/** One row per loan (not netted per person) in the requested currency —
 * feeds the Analytics tab's outstanding-by-person chart. Kept per-loan
 * rather than aggregated, since netting two loans with the same person
 * but opposite directions into one bar would hide which is which. */
export function outstandingByLoan(loans: PersonalLoan[], repayments: PersonalLoanRepayment[], currencyCode: string): LoanOutstandingRow[] {
  return loans
    .filter((l) => l.currencyCode === currencyCode)
    .map((l) => ({ loanId: l.id, person: l.person, direction: l.direction, outstanding: loanOutstanding(l, repayments) }));
}

export interface MonthlyRepayment {
  month: string; // YYYY-MM
  amount: number;
}

/** Total repayments logged per calendar month, for loans in one currency —
 * feeds the Analytics tab's repayment timeline. */
export function repaymentsByMonth(loans: PersonalLoan[], repayments: PersonalLoanRepayment[], currencyCode: string): MonthlyRepayment[] {
  const loanCurrency = new Map(loans.map((l) => [l.id, l.currencyCode]));
  const byMonth: Record<string, number> = {};
  repayments.forEach((r) => {
    if (loanCurrency.get(r.loanId) !== currencyCode) return;
    const month = r.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + r.amount;
  });
  return Object.keys(byMonth)
    .sort()
    .map((month) => ({ month, amount: byMonth[month] }));
}

export interface PayoffProjection {
  months: number;
  payoffDate: string; // YYYY-MM-DD
}

/** Simple linear payoff projection — no interest/compounding concept for
 * an informal personal loan (unlike EMI/Loans), just "how many months of
 * this repayment rate clears the remaining outstanding balance." Returns
 * `null` when the rate can't clear it (a non-positive monthly repayment
 * with a still-outstanding balance) rather than an infinite/NaN result. */
export function projectPayoff(outstanding: number, monthlyRepayment: number, fromDate: string): PayoffProjection | null {
  if (outstanding <= 0) return { months: 0, payoffDate: fromDate };
  if (monthlyRepayment <= 0) return null;
  const months = Math.ceil(outstanding / monthlyRepayment);
  const d = new Date(fromDate);
  d.setMonth(d.getMonth() + months);
  return { months, payoffDate: d.toISOString().slice(0, 10) };
}
