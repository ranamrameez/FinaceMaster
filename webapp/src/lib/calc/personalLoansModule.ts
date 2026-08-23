import type { PersonalLoan, PersonalLoanRepayment } from '../../types/personalLoansWorkbook';

export function loanOutstanding(loan: PersonalLoan, repayments: PersonalLoanRepayment[]): number {
  const repaid = repayments.filter((r) => r.loanId === loan.id).reduce((s, r) => s + r.amount, 0);
  return Math.max(0, loan.principal - repaid);
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
