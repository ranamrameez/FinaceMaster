import { describe, expect, it } from 'vitest';
import { collectUpcomingItems, type UpcomingInputs } from '../upcoming';

const emptyInputs = (): UpcomingInputs => ({
  plannedCash: [], plannedBank: [], bankAccounts: [], emiLoans: [], rentalProperties: [], subscriptions: [],
});

describe('collectUpcomingItems', () => {
  it('includes a one-off Cash plan within the window, excludes an executed one', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      plannedCash: [
        { id: 'c1', date: '2026-01-05', type: 'IN', amount: 500, currencyCode: 'USD' },
        { id: 'c2', date: '2026-01-06', type: 'OUT', amount: 100, currencyCode: 'USD', executed: true },
      ],
    };
    const items = collectUpcomingItems(inputs, 14, new Date('2026-01-01'));
    expect(items).toEqual([{ date: '2026-01-05', module: 'cash', label: 'Cash plan', amount: 500, currencyCode: 'USD', kind: 'income', overdue: false }]);
  });

  it('a recurring Cash plan (salary on the 28th) surfaces its next occurrence, not yet executed', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      plannedCash: [{
        id: 'c1', date: '2026-01-28', type: 'IN', amount: 150000, currencyCode: 'PKR', category: 'Salary',
        recurrence: { cycle: 'monthly', startDate: '2026-01-28' },
      }],
    };
    const items = collectUpcomingItems(inputs, 14, new Date('2026-01-20'));
    expect(items).toEqual([{ date: '2026-01-28', module: 'cash', label: 'Salary', amount: 150000, currencyCode: 'PKR', kind: 'income', overdue: false }]);
  });

  it('excludes a recurring occurrence already marked done via executedThrough', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      plannedCash: [{
        id: 'c1', date: '2026-01-28', type: 'IN', amount: 150000, currencyCode: 'PKR',
        recurrence: { cycle: 'monthly', startDate: '2026-01-28' }, executedThrough: '2026-01-28',
      }],
    };
    const items = collectUpcomingItems(inputs, 14, new Date('2026-01-20'));
    expect(items).toEqual([]);
  });

  it('a Bank plan resolves its currency from the account and flags overdue correctly', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      bankAccounts: [{ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 }],
      plannedBank: [{ id: 'b1', accountId: 'a1', date: '2025-12-20', description: 'Rent', amount: -800 }],
    };
    const items = collectUpcomingItems(inputs, 14, new Date('2026-01-01'));
    expect(items).toEqual([{ date: '2025-12-20', module: 'bank', label: 'Rent', amount: 800, currencyCode: 'USD', kind: 'expense', overdue: true }]);
  });

  it('drops a Bank plan whose account was deleted', () => {
    const inputs: UpcomingInputs = { ...emptyInputs(), plannedBank: [{ id: 'b1', accountId: 'gone', date: '2026-01-05', description: 'X', amount: -1 }] };
    expect(collectUpcomingItems(inputs, 14, new Date('2026-01-01'))).toEqual([]);
  });

  it('surfaces an EMI loan\'s next unpaid installment (first installment is due one month after startDate)', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      emiLoans: [{
        id: 'e1', name: 'Car Loan', lender: 'Bank', currencyCode: 'USD', principal: 1200, tenureMonths: 12,
        startDate: '2026-01-01', repaymentMode: 'interest', annualRatePct: 0,
      }],
    };
    const items = collectUpcomingItems(inputs, 45, new Date('2026-01-01'));
    expect(items).toEqual([{ date: '2026-02-01', module: 'emi', label: 'Car Loan installment', amount: 100, currencyCode: 'USD', kind: 'expense', overdue: false }]);
  });

  it('skips an archived (isActive: false) EMI loan', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      emiLoans: [{
        id: 'e1', name: 'Car Loan', lender: 'Bank', currencyCode: 'USD', principal: 1200, tenureMonths: 12,
        startDate: '2026-01-01', repaymentMode: 'interest', annualRatePct: 0, isActive: false,
      }],
    };
    expect(collectUpcomingItems(inputs, 14, new Date('2026-01-01'))).toEqual([]);
  });

  it('surfaces a Rentals property\'s proposed rent collection', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      rentalProperties: [{
        id: 'p1', name: 'Flat 1', currencyCode: 'USD', monthlyRent: 1000,
        collectionCycle: 'monthly', leaseStartDate: '2025-12-05',
      }],
    };
    const items = collectUpcomingItems(inputs, 14, new Date('2026-01-01'));
    expect(items).toEqual([{ date: '2026-01-05', module: 'rentals', label: 'Flat 1 rent', amount: 1000, currencyCode: 'USD', kind: 'income', overdue: false }]);
  });

  it('surfaces a Subscription\'s next renewal', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      subscriptions: [{ id: 's1', name: 'Netflix', amount: 15, currencyCode: 'USD', billingCycle: 'monthly', startDate: '2026-01-10', active: true }],
    };
    const items = collectUpcomingItems(inputs, 14, new Date('2026-01-01'));
    expect(items).toEqual([{ date: '2026-01-10', module: 'subscriptions', label: 'Netflix', amount: 15, currencyCode: 'USD', kind: 'expense', overdue: false }]);
  });

  it('excludes items beyond the window and sorts the combined list by date', () => {
    const inputs: UpcomingInputs = {
      ...emptyInputs(),
      plannedCash: [
        { id: 'c1', date: '2026-01-10', type: 'IN', amount: 100, currencyCode: 'USD' },
        { id: 'c2', date: '2026-03-01', type: 'IN', amount: 999, currencyCode: 'USD' }, // beyond 14-day window
      ],
      subscriptions: [{ id: 's1', name: 'Netflix', amount: 15, currencyCode: 'USD', billingCycle: 'monthly', startDate: '2026-01-05', active: true }],
    };
    const items = collectUpcomingItems(inputs, 14, new Date('2026-01-01'));
    expect(items.map((i) => i.date)).toEqual(['2026-01-05', '2026-01-10']);
  });
});
