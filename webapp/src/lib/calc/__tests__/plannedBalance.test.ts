import { describe, expect, it } from 'vitest';
import type { BankAccount, BankTransaction } from '../../../types/bankWorkbook';
import type { CashEntry } from '../../../types/cashWorkbook';
import type { CreditCard, CreditCardTransaction } from '../../../types/creditCard';
import type { PlannedBankTransaction } from '../../../types/plannedBank';
import type { PlannedCashEntry } from '../../../types/plannedCash';
import type { PlannedCreditCardTransaction } from '../../../types/plannedCreditCard';
import { planWithinHorizon, plannedBankProjection, plannedCashProjection, plannedCreditCardProjection } from '../plannedBalance';

describe('plannedCashProjection', () => {
  const entry = (over: Partial<CashEntry>): CashEntry => ({
    id: 'e1',
    date: '2026-01-01',
    isDeposit: true,
    amount: 100,
    currencyCode: 'USD',
    source: 'manual',
    ...over,
  });
  const plan = (over: Partial<PlannedCashEntry>): PlannedCashEntry => ({
    id: 'p1',
    date: '2026-01-10',
    type: 'OUT',
    amount: 50,
    currencyCode: 'USD',
    ...over,
  });

  it('real equals the current balance and planned adds not-yet-executed plans', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 500 })];
    const planned = [plan({ id: 'p1', type: 'OUT', amount: 200 })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: 500, planned: 300 });
  });

  it('excludes executed plans from the planned delta (already counted in real)', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 500 })];
    const planned = [plan({ id: 'p1', type: 'OUT', amount: 200, executed: true })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: 500, planned: 500 });
  });

  it('keeps currencies separate', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 500, currencyCode: 'USD' })];
    const planned = [plan({ id: 'p1', type: 'OUT', amount: 100, currencyCode: 'PKR' })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: 500, planned: 500 });
    expect(result.PKR).toEqual({ real: 0, planned: -100 });
  });

  it('a planned IN increases the projected balance', () => {
    const entries = [entry({ id: 'e1', isDeposit: false, amount: 100 })];
    const planned = [plan({ id: 'p1', type: 'IN', amount: 300 })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: -100, planned: 200 });
  });

  it('a recurring plan counts its own next occurrence, not yet marked done', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 1000 })];
    const planned = [plan({
      id: 'p1', type: 'IN', amount: 150000, date: '2026-01-28',
      recurrence: { cycle: 'monthly', startDate: '2026-01-28' },
    })];
    const result = plannedCashProjection(entries, planned, new Date('2026-01-15'));
    expect(result.USD).toEqual({ real: 1000, planned: 151000 });
  });

  it('a recurring plan already marked done for the exact occurrence asOf lands on is excluded', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 1000 })];
    const planned = [plan({
      id: 'p1', type: 'IN', amount: 150000, date: '2026-01-28',
      recurrence: { cycle: 'monthly', startDate: '2026-01-28' }, executedThrough: '2026-01-28',
    })];
    const sameDay = plannedCashProjection(entries, planned, new Date('2026-01-28'));
    expect(sameDay.USD).toEqual({ real: 1000, planned: 1000 });
  });

  it('a recurring plan marked done a few days early (before the occurrence date arrives) is excluded until then', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 1000 })];
    const planned = [plan({
      id: 'p1', type: 'IN', amount: 150000, date: '2026-01-28',
      recurrence: { cycle: 'monthly', startDate: '2026-01-28' }, executedThrough: '2026-01-28',
    })];
    // asOf is BEFORE the Jan 28 occurrence, which has already been marked
    // done early -> excluded, since the next occurrence date (Jan 28)
    // isn't past executedThrough yet.
    const beforeIt = plannedCashProjection(entries, planned, new Date('2026-01-20'));
    expect(beforeIt.USD).toEqual({ real: 1000, planned: 1000 });
  });

  it('once a later cycle is the next occurrence, it counts again regardless of an earlier executedThrough', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 1000 })];
    const planned = [plan({
      id: 'p1', type: 'IN', amount: 150000, date: '2026-01-28',
      recurrence: { cycle: 'monthly', startDate: '2026-01-28' }, executedThrough: '2026-01-28',
    })];
    // asOf has moved past Jan 28 -> the next occurrence is genuinely Feb 28,
    // which hasn't happened yet, so it correctly counts as planned again.
    const nowFeb = plannedCashProjection(entries, planned, new Date('2026-02-01'));
    expect(nowFeb.USD).toEqual({ real: 1000, planned: 151000 });
  });

  it('a recurring plan past its own endDate stops contributing', () => {
    const entries = [entry({ id: 'e1', isDeposit: true, amount: 1000 })];
    const planned = [plan({
      id: 'p1', type: 'IN', amount: 150000, date: '2026-01-28',
      recurrence: { cycle: 'monthly', startDate: '2026-01-28', endDate: '2026-01-28' },
    })];
    const afterEnd = plannedCashProjection(entries, planned, new Date('2026-03-01'));
    expect(afterEnd.USD).toEqual({ real: 1000, planned: 1000 });
  });
});

describe('plannedBankProjection', () => {
  const account = (over: Partial<BankAccount>): BankAccount => ({
    id: 'acct-1',
    name: 'Checking',
    currencyCode: 'USD',
    openingBalance: 1000,
    ...over,
  });
  const tx = (over: Partial<BankTransaction>): BankTransaction => ({
    id: 't1',
    accountId: 'acct-1',
    date: '2026-01-01',
    amount: -100,
    isDeposit: false,
    description: 'Groceries',
    source: 'manual',
    ...over,
  });
  const plan = (over: Partial<PlannedBankTransaction>): PlannedBankTransaction => ({
    id: 'p1',
    accountId: 'acct-1',
    date: '2026-01-10',
    description: 'Planned rent',
    amount: -500,
    ...over,
  });

  it('real equals account balance and planned subtracts a planned debit', () => {
    const accounts = [account({})];
    const transactions = [tx({ amount: -100 })];
    const planned = [plan({ amount: -500 })];
    const result = plannedBankProjection(accounts, transactions, planned);
    // real = 1000 - 100 = 900; planned = 900 - 500 = 400
    expect(result.USD).toEqual({ real: 900, planned: 400 });
  });

  it('excludes executed plans', () => {
    const accounts = [account({})];
    const transactions = [tx({ amount: -100 })];
    const planned = [plan({ amount: -500, executed: true })];
    const result = plannedBankProjection(accounts, transactions, planned);
    expect(result.USD).toEqual({ real: 900, planned: 900 });
  });

  it('ignores a plan referencing a deleted account instead of guessing its currency', () => {
    const accounts = [account({})];
    const transactions = [tx({ amount: -100 })];
    const planned = [plan({ accountId: 'deleted-acct', amount: -9999 })];
    const result = plannedBankProjection(accounts, transactions, planned);
    expect(result.USD).toEqual({ real: 900, planned: 900 });
  });

  it('sums multiple accounts sharing a currency and multiple plans', () => {
    const accounts = [account({ id: 'a1', currencyCode: 'USD', openingBalance: 500 }), account({ id: 'a2', currencyCode: 'USD', openingBalance: 500 })];
    const transactions: BankTransaction[] = [];
    const planned = [plan({ id: 'p1', accountId: 'a1', amount: -200 }), plan({ id: 'p2', accountId: 'a2', amount: 100 })];
    const result = plannedBankProjection(accounts, transactions, planned);
    // real = 500 + 500 = 1000; planned = 1000 - 200 + 100 = 900
    expect(result.USD).toEqual({ real: 1000, planned: 900 });
  });
});

describe('plannedCreditCardProjection', () => {
  const card = (over: Partial<CreditCard>): CreditCard => ({
    id: 'card-1',
    name: 'Sharia Card',
    currencyCode: 'USD',
    ...over,
  });
  const tx = (over: Partial<CreditCardTransaction>): CreditCardTransaction => ({
    id: 't1',
    cardId: 'card-1',
    date: '2026-01-01',
    kind: 'charge',
    amount: 100,
    description: 'Groceries',
    source: 'manual',
    ...over,
  });
  const plan = (over: Partial<PlannedCreditCardTransaction>): PlannedCreditCardTransaction => ({
    id: 'p1',
    cardId: 'card-1',
    date: '2026-01-10',
    description: 'Subscription renewal',
    amount: 50,
    kind: 'charge',
    ...over,
  });

  it('real equals what is owed and a planned charge adds to it', () => {
    const cards = [card({})];
    const transactions = [tx({ amount: 100 })];
    const planned = [plan({ amount: 50 })];
    const result = plannedCreditCardProjection(cards, transactions, planned);
    expect(result.USD).toEqual({ real: 100, planned: 150 });
  });

  it('a planned payment reduces what is owed, unlike a charge', () => {
    const cards = [card({})];
    const transactions = [tx({ amount: 100 })];
    const planned = [plan({ amount: 40, kind: 'payment' })];
    const result = plannedCreditCardProjection(cards, transactions, planned);
    expect(result.USD).toEqual({ real: 100, planned: 60 });
  });

  it('excludes executed plans (already counted in real)', () => {
    const cards = [card({})];
    const transactions = [tx({ amount: 100 })];
    const planned = [plan({ amount: 50, executed: true })];
    const result = plannedCreditCardProjection(cards, transactions, planned);
    expect(result.USD).toEqual({ real: 100, planned: 100 });
  });

  it('ignores a plan referencing a deleted card instead of guessing its currency', () => {
    const cards = [card({})];
    const transactions = [tx({ amount: 100 })];
    const planned = [plan({ cardId: 'deleted-card', amount: 9999 })];
    const result = plannedCreditCardProjection(cards, transactions, planned);
    expect(result.USD).toEqual({ real: 100, planned: 100 });
  });

  it('keeps currencies separate', () => {
    const cards = [card({ id: 'c1', currencyCode: 'USD' }), card({ id: 'c2', currencyCode: 'PKR' })];
    const transactions = [tx({ cardId: 'c1', amount: 100 })];
    const planned = [plan({ cardId: 'c2', amount: 500 })];
    const result = plannedCreditCardProjection(cards, transactions, planned);
    expect(result.USD).toEqual({ real: 100, planned: 100 });
    expect(result.PKR).toEqual({ real: 0, planned: 500 });
  });
});

describe('horizonDays — user-reported "dumping lifetime plans" fix (2026-09-20)', () => {
  const entry = (over: Partial<CashEntry>): CashEntry => ({
    id: 'e1', date: '2026-06-01', isDeposit: true, amount: 500, currencyCode: 'USD', source: 'manual', ...over,
  });
  const plan = (over: Partial<PlannedCashEntry>): PlannedCashEntry => ({
    id: 'p1', date: '2026-06-10', type: 'OUT', amount: 100, currencyCode: 'USD', ...over,
  });
  const asOf = new Date('2026-06-01T00:00:00Z');

  it('with no horizon (default, unlimited), a far-future one-off plan still counts — the pre-fix behavior, unchanged for a caller that opts out', () => {
    const result = plannedCashProjection([entry({})], [plan({ date: '2028-01-01', amount: 100 })], asOf);
    expect(result.USD).toEqual({ real: 500, planned: 400 });
  });

  it('a 30-day horizon excludes a plan dated well beyond it', () => {
    const result = plannedCashProjection([entry({})], [plan({ date: '2028-01-01', amount: 100 })], asOf, 30);
    expect(result.USD).toEqual({ real: 500, planned: 500 });
  });

  it('a 30-day horizon still includes a plan dated exactly at the boundary', () => {
    const result = plannedCashProjection([entry({})], [plan({ date: '2026-07-01', amount: 100 })], asOf, 30);
    expect(result.USD).toEqual({ real: 500, planned: 400 });
  });

  it('a 30-day horizon excludes a plan one day past the boundary', () => {
    const result = plannedCashProjection([entry({})], [plan({ date: '2026-07-02', amount: 100 })], asOf, 30);
    expect(result.USD).toEqual({ real: 500, planned: 500 });
  });

  it('an overdue (past-dated), not-yet-done plan always counts, regardless of a short horizon — it is the most urgent thing to see, not something a horizon should hide', () => {
    const result = plannedCashProjection([entry({})], [plan({ date: '2020-01-01', amount: 100 })], asOf, 30);
    expect(result.USD).toEqual({ real: 500, planned: 400 });
  });

  it('a recurring plan whose next occurrence falls beyond the horizon is excluded even though it recurs', () => {
    const result = plannedCashProjection(
      [entry({})],
      [plan({ amount: 100, date: '2026-01-28', recurrence: { cycle: 'yearly', startDate: '2026-01-28' } })],
      asOf,
      30,
    );
    // next yearly occurrence from 2026-06-01 is 2027-01-28 — far beyond a 30-day window
    expect(result.USD).toEqual({ real: 500, planned: 500 });
  });

  it('a recurring plan whose next occurrence falls within the horizon still counts', () => {
    const result = plannedCashProjection(
      [entry({})],
      [plan({ amount: 100, date: '2026-01-28', recurrence: { cycle: 'monthly', startDate: '2026-01-28' } })],
      asOf,
      30,
    );
    // next monthly occurrence from 2026-06-01 is 2026-06-28 — within 30 days
    expect(result.USD).toEqual({ real: 500, planned: 400 });
  });
});

describe('planWithinHorizon', () => {
  const asOf = new Date('2026-06-01T00:00:00Z');

  it('null horizon always returns true (no limit)', () => {
    expect(planWithinHorizon({ date: '2099-01-01' }, asOf, null)).toBe(true);
  });

  it('a one-off plan\'s own date decides it, independent of any executed/status concept (the list filter is a separate dimension)', () => {
    expect(planWithinHorizon({ date: '2026-06-15' }, asOf, 30)).toBe(true);
    expect(planWithinHorizon({ date: '2026-12-31' }, asOf, 30)).toBe(false);
  });

  it('an overdue one-off plan is always within horizon', () => {
    expect(planWithinHorizon({ date: '2020-01-01' }, asOf, 30)).toBe(true);
  });

  it('a recurring plan is judged by its own next occurrence', () => {
    const recurring = { date: '2026-01-28', recurrence: { cycle: 'monthly' as const, startDate: '2026-01-28' } };
    expect(planWithinHorizon(recurring, asOf, 30)).toBe(true); // next occurrence 2026-06-28
    expect(planWithinHorizon(recurring, asOf, 10)).toBe(false); // 2026-06-28 is >10 days out
  });

  it('a recurring plan past its own endDate (no more occurrences) is never hidden by horizon', () => {
    const finished = { date: '2026-01-01', recurrence: { cycle: 'monthly' as const, startDate: '2026-01-01', endDate: '2026-02-01' } };
    expect(planWithinHorizon(finished, asOf, 30)).toBe(true);
  });
});
