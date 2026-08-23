import { describe, expect, it } from 'vitest';
import type { BankAccount, BankTransaction } from '../../../types/bankWorkbook';
import { accountBalance, accountByCategory, accountRunningLedger, totalBalanceByCurrency } from '../bankModule';

const account = (over: Partial<BankAccount>): BankAccount => ({
  id: 'a1',
  name: 'Checking',
  currencyCode: 'USD',
  openingBalance: 1000,
  ...over,
});

const tx = (over: Partial<BankTransaction>): BankTransaction => ({
  id: 't1',
  accountId: 'a1',
  date: '2026-01-01',
  amount: -50,
  description: 'Groceries',
  source: 'manual',
  ...over,
});

describe('accountBalance', () => {
  it('adds opening balance and all transactions for that account', () => {
    const a = account({ openingBalance: 1000 });
    const txs = [tx({ amount: -50 }), tx({ id: 't2', amount: 200 })];
    expect(accountBalance(a, txs)).toBe(1150);
  });

  it('ignores transactions for other accounts', () => {
    const a = account({ id: 'a1', openingBalance: 1000 });
    const txs = [tx({ accountId: 'a1', amount: -50 }), tx({ id: 't2', accountId: 'a2', amount: 9999 })];
    expect(accountBalance(a, txs)).toBe(950);
  });
});

describe('accountRunningLedger', () => {
  it('produces a chronological running balance starting from opening balance', () => {
    const a = account({ openingBalance: 1000 });
    const txs = [
      tx({ id: 't2', date: '2026-01-10', amount: 200 }),
      tx({ id: 't1', date: '2026-01-01', amount: -50 }),
    ];
    const rows = accountRunningLedger(a, txs);
    expect(rows.map((r) => r.tx.id)).toEqual(['t1', 't2']);
    expect(rows.map((r) => r.balance)).toEqual([950, 1150]);
  });
});

describe('totalBalanceByCurrency', () => {
  it('groups multiple accounts by currency without converting', () => {
    const accounts = [
      account({ id: 'a1', currencyCode: 'USD', openingBalance: 1000 }),
      account({ id: 'a2', currencyCode: 'USD', openingBalance: 500 }),
      account({ id: 'a3', currencyCode: 'PKR', openingBalance: 10000 }),
    ];
    const txs = [tx({ accountId: 'a1', amount: -100 })];
    const totals = totalBalanceByCurrency(accounts, txs);
    expect(totals.USD).toBe(1400); // (1000-100) + 500
    expect(totals.PKR).toBe(10000);
  });
});

describe('accountByCategory', () => {
  it('nets credits/debits per category for one account', () => {
    const a = account({ id: 'a1' });
    const txs = [
      tx({ id: 't1', accountId: 'a1', amount: -50, category: 'Food' }),
      tx({ id: 't2', accountId: 'a1', amount: -30, category: 'Food' }),
      tx({ id: 't3', accountId: 'a1', amount: 2000, category: 'Salary' }),
    ];
    const byCategory = accountByCategory(a, txs);
    expect(byCategory.Food).toBe(-80);
    expect(byCategory.Salary).toBe(2000);
  });

  it('falls back to "Uncategorized"', () => {
    const a = account({ id: 'a1' });
    expect(accountByCategory(a, [tx({ category: undefined })]).Uncategorized).toBe(-50);
  });
});
