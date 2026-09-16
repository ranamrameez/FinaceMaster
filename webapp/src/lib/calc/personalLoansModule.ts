import type { PersonalLoan, PersonalLoanRepayment } from '../../types/personalLoansWorkbook';
import { dateOnlyMs } from '../datetime';

export function loanOutstanding(loan: PersonalLoan, repayments: PersonalLoanRepayment[]): number {
  const repaid = repayments.filter((r) => r.loanId === loan.id && !r.isPending).reduce((s, r) => s + r.amount, 0);
  return Math.max(0, loan.principal - repaid);
}

export function loanPendingImpact(loan: PersonalLoan, repayments: PersonalLoanRepayment[]): number {
  return repayments.filter((r) => r.loanId === loan.id && r.isPending).reduce((s, r) => s + r.amount, 0);
}

export function repaymentRunningOutstanding(loan: PersonalLoan, repayments: PersonalLoanRepayment[]): Map<string, number> {
  const forLoan = repayments.filter((r) => r.loanId === loan.id && !r.isPending).sort((a, b) => dateOnlyMs(a.date) - dateOnlyMs(b.date) || (a.seq ?? 0) - (b.seq ?? 0));
  const out = new Map<string, number>();
  let remaining = loan.principal;
  for (const r of forLoan) {
    remaining = Math.max(0, remaining - r.amount);
    out.set(r.id, remaining);
  }
  return out;
}

export function loanBalanceHistory(loan: PersonalLoan, repayments: PersonalLoanRepayment[]): { date: string; balance: number }[] {
  const forLoan = repayments.filter((r) => r.loanId === loan.id && !r.isPending).sort((a, b) => dateOnlyMs(a.date) - dateOnlyMs(b.date) || (a.seq ?? 0) - (b.seq ?? 0));
  const points: { date: string; balance: number }[] = [{ date: loan.date, balance: loan.principal }];
  let remaining = loan.principal;
  for (const r of forLoan) {
    remaining = Math.max(0, remaining - r.amount);
    points.push({ date: r.date, balance: remaining });
  }
  return points;
}

export function netPositionByCurrency(loans: PersonalLoan[], repayments: PersonalLoanRepayment[]): Record<string, number> {
  const out: Record<string, number> = {};
  loans.forEach((loan) => {
    const outstanding = loanOutstanding(loan, repayments);
    const sign = loan.direction === 'owed_to_me' ? 1 : -1;
    out[loan.currencyCode] = (out[loan.currencyCode] || 0) + sign * outstanding;
  });
  return out;
}

export function netPendingByCurrency(loans: PersonalLoan[], repayments: PersonalLoanRepayment[]): Record<string, number> {
  const out: Record<string, number> = {};
  loans.forEach((loan) => {
    const pending = loanPendingImpact(loan, repayments);
    const sign = loan.direction === 'owed_to_me' ? -1 : 1;
    out[loan.currencyCode] = (out[loan.currencyCode] || 0) + sign * pending;
  });
  return out;
}

export interface LoanOutstandingRow { loanId: string; person: string; direction: PersonalLoan['direction']; outstanding: number; }

export function outstandingByLoan(loans: PersonalLoan[], repayments: PersonalLoanRepayment[], currencyCode: string): LoanOutstandingRow[] {
  return loans.filter((l) => l.currencyCode === currencyCode).map((l) => ({ loanId: l.id, person: l.person, direction: l.direction, outstanding: loanOutstanding(l, repayments) }));
}

export interface MonthlyRepayment { month: string; amount: number; }

export function repaymentsByMonth(loans: PersonalLoan[], repayments: PersonalLoanRepayment[], currencyCode: string): MonthlyRepayment[] {
  const loanCurrency = new Map(loans.map((l) => [l.id, l.currencyCode]));
  const byMonth: Record<string, number> = {};
  repayments.filter((r) => !r.isPending).forEach((r) => {
    if (loanCurrency.get(r.loanId) !== currencyCode) return;
    const month = r.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + r.amount;
  });
  return Object.keys(byMonth).sort().map((month) => ({ month, amount: byMonth[month] }));
}

export interface PayoffProjection { months: number; payoffDate: string; }

/** Uses UTC calendar arithmetic so a YYYY-MM-DD input never shifts by one
 * day when the browser's local timezone differs from UTC. */
export function projectPayoff(outstanding: number, monthlyRepayment: number, fromDate: string): PayoffProjection | null {
  if (outstanding <= 0) return { months: 0, payoffDate: fromDate };
  if (monthlyRepayment <= 0) return null;
  const months = Math.ceil(outstanding / monthlyRepayment);
  const [y, m, d] = fromDate.split('-').map(Number);
  const rawMonth = (m - 1) + months;
  const year = y + Math.floor(rawMonth / 12);
  const month0 = ((rawMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const payoffDate = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { months, payoffDate };
}
