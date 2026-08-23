import { describe, expect, it } from 'vitest';
import type { PersonalLoan, PersonalLoanRepayment } from '../../../types/personalLoansWorkbook';
import { loanOutstanding, netPositionByCurrency } from '../personalLoansModule';

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
