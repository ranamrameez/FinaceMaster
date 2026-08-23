import { describe, expect, it } from 'vitest';
import type { BankAccount, BankTransaction } from '../../../types/bankWorkbook';
import type { CashEntry } from '../../../types/cashWorkbook';
import type { PlannedBankTransaction } from '../../../types/plannedBank';
import type { PlannedCashEntry } from '../../../types/plannedCash';
import { plannedBankProjection, plannedCashProjection } from '../plannedBalance';

describe('plannedCashProjection', () => {
  const entry = (over: Partial<CashEntry>): CashEntry => ({
    id: 'e1',
    date: '2026-01-01',
    type: 'IN',
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
    const entries = [entry({ id: 'e1', type: 'IN', amount: 500 })];
    const planned = [plan({ id: 'p1', type: 'OUT', amount: 200 })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: 500, planned: 300 });
  });

  it('excludes executed plans from the planned delta (already counted in real)', () => {
    const entries = [entry({ id: 'e1', type: 'IN', amount: 500 })];
    const planned = [plan({ id: 'p1', type: 'OUT', amount: 200, executed: true })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: 500, planned: 500 });
  });

  it('keeps currencies separate', () => {
    const entries = [entry({ id: 'e1', type: 'IN', amount: 500, currencyCode: 'USD' })];
    const planned = [plan({ id: 'p1', type: 'OUT', amount: 100, currencyCode: 'PKR' })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: 500, planned: 500 });
    expect(result.PKR).toEqual({ real: 0, planned: -100 });
  });

  it('a planned IN increases the projected balance', () => {
    const entries = [entry({ id: 'e1', type: 'OUT', amount: 100 })];
    const planned = [plan({ id: 'p1', type: 'IN', amount: 300 })];
    const result = plannedCashProjection(entries, planned);
    expect(result.USD).toEqual({ real: -100, planned: 200 });
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
