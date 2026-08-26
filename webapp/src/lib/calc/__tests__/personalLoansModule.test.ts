import { describe, expect, it } from 'vitest';
import type { PersonalLoan, PersonalLoanRepayment } from '../../../types/personalLoansWorkbook';
import { loanBalanceHistory, loanOutstanding, netPositionByCurrency, outstandingByLoan, projectPayoff, repaymentRunningOutstanding, repaymentsByMonth } from '../personalLoansModule';

const loan = (over: Partial<PersonalLoan>): PersonalLoan => ({
  id: 'l1',
  person: 'Bilal',
  direction: 'owed_to_me',
  currencyCode: 'USD',
  principal: 500,
  date: '2026-01-01',
  ...over,
});

describe('loanOutstanding', () => {
  it('subtracts repayments from principal', () => {
    const l = loan({ id: 'l1', principal: 500 });
    const repayments: PersonalLoanRepayment[] = [{ id: 'r1', loanId: 'l1', date: '2026-02-01', amount: 200 }];
    expect(loanOutstanding(l, repayments)).toBe(300);
  });

  it('never goes negative even if overpaid', () => {
    const l = loan({ id: 'l1', principal: 500 });
    const repayments: PersonalLoanRepayment[] = [{ id: 'r1', loanId: 'l1', date: '2026-02-01', amount: 600 }];
    expect(loanOutstanding(l, repayments)).toBe(0);
  });

  it('only counts repayments for the matching loan', () => {
    const l = loan({ id: 'l1', principal: 500 });
    const repayments: PersonalLoanRepayment[] = [
      { id: 'r1', loanId: 'l1', date: '2026-02-01', amount: 100 },
      { id: 'r2', loanId: 'other', date: '2026-02-01', amount: 9999 },
    ];
    expect(loanOutstanding(l, repayments)).toBe(400);
  });
});

describe('netPositionByCurrency', () => {
  it('adds owed_to_me and subtracts i_owe, grouped by currency', () => {
    const loans: PersonalLoan[] = [
      loan({ id: 'l1', direction: 'owed_to_me', currencyCode: 'USD', principal: 500 }),
      loan({ id: 'l2', direction: 'i_owe', currencyCode: 'USD', principal: 200 }),
      loan({ id: 'l3', direction: 'owed_to_me', currencyCode: 'PKR', principal: 1000 }),
    ];
    const net = netPositionByCurrency(loans, []);
    expect(net.USD).toBe(300); // 500 - 200
    expect(net.PKR).toBe(1000);
  });

  it('accounts for repayments already made', () => {
    const loans: PersonalLoan[] = [loan({ id: 'l1', direction: 'i_owe', currencyCode: 'USD', principal: 500 })];
    const repayments: PersonalLoanRepayment[] = [{ id: 'r1', loanId: 'l1', date: '2026-02-01', amount: 300 }];
    expect(netPositionByCurrency(loans, repayments).USD).toBe(-200);
  });
});

describe('outstandingByLoan', () => {
  it('returns one row per loan in the requested currency, not netted per person', () => {
    const loans: PersonalLoan[] = [
      loan({ id: 'l1', person: 'Bilal', direction: 'owed_to_me', currencyCode: 'USD', principal: 500 }),
      loan({ id: 'l2', person: 'Bilal', direction: 'i_owe', currencyCode: 'USD', principal: 200 }),
      loan({ id: 'l3', person: 'Ahmed', direction: 'owed_to_me', currencyCode: 'PKR', principal: 1000 }),
    ];
    const rows = outstandingByLoan(loans, [], 'USD');
    expect(rows).toEqual([
      { loanId: 'l1', person: 'Bilal', direction: 'owed_to_me', outstanding: 500 },
      { loanId: 'l2', person: 'Bilal', direction: 'i_owe', outstanding: 200 },
    ]);
  });

  it('reflects repayments already made', () => {
    const loans: PersonalLoan[] = [loan({ id: 'l1', principal: 500 })];
    const repayments: PersonalLoanRepayment[] = [{ id: 'r1', loanId: 'l1', date: '2026-02-01', amount: 100 }];
    expect(outstandingByLoan(loans, repayments, 'USD')[0].outstanding).toBe(400);
  });
});

describe('repaymentsByMonth', () => {
  it('sums repayments per calendar month for loans in one currency', () => {
    const loans: PersonalLoan[] = [loan({ id: 'l1', currencyCode: 'USD' }), loan({ id: 'l2', currencyCode: 'PKR' })];
    const repayments: PersonalLoanRepayment[] = [
      { id: 'r1', loanId: 'l1', date: '2026-01-05', amount: 100 },
      { id: 'r2', loanId: 'l1', date: '2026-01-20', amount: 50 },
      { id: 'r3', loanId: 'l1', date: '2026-02-01', amount: 75 },
      { id: 'r4', loanId: 'l2', date: '2026-01-10', amount: 9999 },
    ];
    expect(repaymentsByMonth(loans, repayments, 'USD')).toEqual([
      { month: '2026-01', amount: 150 },
      { month: '2026-02', amount: 75 },
    ]);
  });
});

describe('projectPayoff', () => {
  it('projects the payoff date at a given monthly repayment rate', () => {
    const result = projectPayoff(1000, 200, '2026-01-01');
    expect(result).toEqual({ months: 5, payoffDate: '2026-06-01' });
  });

  it('rounds up a fractional number of months', () => {
    const result = projectPayoff(1000, 300, '2026-01-01');
    expect(result?.months).toBe(4); // 1000/300 = 3.33 -> 4
  });

  it('returns zero months when already fully repaid', () => {
    expect(projectPayoff(0, 100, '2026-01-01')).toEqual({ months: 0, payoffDate: '2026-01-01' });
  });

  it('returns null when the repayment rate cannot ever clear the balance', () => {
    expect(projectPayoff(500, 0, '2026-01-01')).toBeNull();
    expect(projectPayoff(500, -10, '2026-01-01')).toBeNull();
  });
});

describe('repaymentRunningOutstanding', () => {
  const repayment = (over: Partial<PersonalLoanRepayment>): PersonalLoanRepayment => ({
    id: crypto.randomUUID(),
    loanId: 'l1',
    date: '2026-01-01',
    amount: 0,
    ...over,
  });

  it('decreases remaining balance after each repayment, in date order', () => {
    const l = loan({ principal: 500 });
    const r1 = repayment({ date: '2026-01-05', amount: 100 });
    const r2 = repayment({ date: '2026-01-10', amount: 150 });
    const remaining = repaymentRunningOutstanding(l, [r1, r2]);
    expect(remaining.get(r1.id)).toBe(400);
    expect(remaining.get(r2.id)).toBe(250);
  });

  it('ignores repayments for a different loan', () => {
    const l = loan({ id: 'l1', principal: 500 });
    const mine = repayment({ loanId: 'l1', date: '2026-01-05', amount: 100 });
    const other = repayment({ loanId: 'l2', date: '2026-01-03', amount: 999 });
    const remaining = repaymentRunningOutstanding(l, [mine, other]);
    expect(remaining.get(mine.id)).toBe(400);
    expect(remaining.has(other.id)).toBe(false);
  });

  it('clamps at 0 on an overpayment, never goes negative', () => {
    const l = loan({ principal: 100 });
    const r1 = repayment({ date: '2026-01-05', amount: 150 });
    const remaining = repaymentRunningOutstanding(l, [r1]);
    expect(remaining.get(r1.id)).toBe(0);
  });

  it('is independent of input array order — sorts by date first', () => {
    const l = loan({ principal: 500 });
    const early = repayment({ date: '2026-01-01', amount: 100 });
    const later = repayment({ date: '2026-01-10', amount: 50 });
    const remaining = repaymentRunningOutstanding(l, [later, early]);
    expect(remaining.get(early.id)).toBe(400);
    expect(remaining.get(later.id)).toBe(350);
  });
});

describe('loanBalanceHistory', () => {
  const repayment = (over: Partial<PersonalLoanRepayment>): PersonalLoanRepayment => ({
    id: crypto.randomUUID(),
    loanId: 'l1',
    date: '2026-01-01',
    amount: 0,
    ...over,
  });

  it('starts at the loan\'s own principal on its own date, then steps down after each repayment', () => {
    const l = loan({ principal: 500, date: '2026-01-01' });
    const r1 = repayment({ date: '2026-01-05', amount: 100 });
    const r2 = repayment({ date: '2026-01-10', amount: 150 });
    const history = loanBalanceHistory(l, [r2, r1]); // deliberately out of order
    expect(history).toEqual([
      { date: '2026-01-01', balance: 500 },
      { date: '2026-01-05', balance: 400 },
      { date: '2026-01-10', balance: 250 },
    ]);
  });

  it('is just the opening point when there are no repayments yet', () => {
    const l = loan({ principal: 500, date: '2026-01-01' });
    expect(loanBalanceHistory(l, [])).toEqual([{ date: '2026-01-01', balance: 500 }]);
  });

  it('clamps at 0 on an overpayment and ignores other loans\' repayments', () => {
    const l = loan({ id: 'l1', principal: 100, date: '2026-01-01' });
    const mine = repayment({ loanId: 'l1', date: '2026-01-05', amount: 150 });
    const other = repayment({ loanId: 'l2', date: '2026-01-03', amount: 999 });
    const history = loanBalanceHistory(l, [mine, other]);
    expect(history).toEqual([
      { date: '2026-01-01', balance: 100 },
      { date: '2026-01-05', balance: 0 },
    ]);
  });
});
