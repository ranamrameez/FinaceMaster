import { describe, expect, it } from 'vitest';
import type { BankAccount, BankTransaction } from '../../../types/bankWorkbook';
import { accountBalance, accountByCategory, accountRunningLedger, assetBalanceByCurrency, bankMonthlyFlow, budgetVsActual, creditCardLiabilityByCurrency, totalBalanceByCurrency } from '../bankModule';

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

  it('breaks a same-instant tie by seq, not array position', () => {
    const a = account({ openingBalance: 1000 });
    // Same date, no time -> identical noon-UTC instant. Placed in the
    // array in the OPPOSITE order their seq implies.
    const first = tx({ id: 't1', date: '2026-01-01', amount: -50, seq: 1 });
    const second = tx({ id: 't2', date: '2026-01-01', amount: 200, seq: 2 });
    const rows = accountRunningLedger(a, [second, first]);
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

describe('assetBalanceByCurrency / creditCardLiabilityByCurrency', () => {
  it('splits a checking account and a credit card into asset vs. liability', () => {
    const checking = account({ id: 'a1', currencyCode: 'USD', openingBalance: 1000 });
    const card = account({ id: 'a2', currencyCode: 'USD', openingBalance: 0, isLiability: true });
    const txs = [tx({ id: 't1', accountId: 'a2', amount: -150 })]; // a $150 purchase on the card
    expect(assetBalanceByCurrency([checking, card], txs)).toEqual({ USD: 1000 });
    expect(creditCardLiabilityByCurrency([checking, card], txs)).toEqual({ USD: 150 });
  });

  it('a paid-off or in-credit card contributes 0 liability, never a negative one', () => {
    const card = account({ id: 'a1', currencyCode: 'USD', openingBalance: 0, isLiability: true });
    const txs = [tx({ id: 't1', accountId: 'a1', amount: 50 })]; // overpaid — the card is now in credit
    expect(creditCardLiabilityByCurrency([card], txs)).toEqual({});
  });

  it('assetBalanceByCurrency omits liability accounts entirely, even a currency only a card uses', () => {
    const card = account({ id: 'a1', currencyCode: 'PKR', openingBalance: 0, isLiability: true });
    expect(assetBalanceByCurrency([card], [])).toEqual({});
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

describe('bankMonthlyFlow', () => {
  it('sums income (positive amounts) and expense (negative amounts) per month for the given accounts', () => {
    const txs: BankTransaction[] = [
      tx({ id: 't1', accountId: 'a1', date: '2026-01-05', amount: 1000 }),
      tx({ id: 't2', accountId: 'a1', date: '2026-01-10', amount: -300 }),
      tx({ id: 't3', accountId: 'a1', date: '2026-02-01', amount: -100 }),
    ];
    const flow = bankMonthlyFlow(txs, ['a1']);
    expect(flow).toEqual([
      { month: '2026-01', income: 1000, expense: 300, net: 700 },
      { month: '2026-02', income: 0, expense: 100, net: -100 },
    ]);
  });

  it('ignores transactions for accounts not in the given list', () => {
    const txs: BankTransaction[] = [tx({ accountId: 'a1', amount: -50 }), tx({ id: 't2', accountId: 'a2', amount: -9999 })];
    const flow = bankMonthlyFlow(txs, ['a1']);
    expect(flow[0].expense).toBe(50);
  });
});

describe('budgetVsActual', () => {
  it('sums actual spend per category for the given month, matched against budget targets', () => {
    const txs: BankTransaction[] = [
      tx({ id: 't1', accountId: 'a1', date: '2026-01-05', amount: -150, category: 'Groceries' }),
      tx({ id: 't2', accountId: 'a1', date: '2026-01-10', amount: -50, category: 'Groceries' }),
      tx({ id: 't3', accountId: 'a1', date: '2026-01-15', amount: -80, category: 'Dining' }),
      tx({ id: 't4', accountId: 'a1', date: '2026-02-01', amount: -999, category: 'Groceries' }), // different month, excluded
    ];
    const rows = budgetVsActual(txs, ['a1'], { Groceries: 250, Dining: 100 }, '2026-01');
    expect(rows).toEqual([
      { category: 'Dining', budget: 100, actual: 80 },
      { category: 'Groceries', budget: 250, actual: 200 },
    ]);
  });

  it('includes a category with actual spend but no set budget target', () => {
    const txs: BankTransaction[] = [tx({ accountId: 'a1', date: '2026-01-05', amount: -40, category: 'Fuel' })];
    const rows = budgetVsActual(txs, ['a1'], {}, '2026-01');
    expect(rows).toEqual([{ category: 'Fuel', budget: 0, actual: 40 }]);
  });

  it('excludes credits (income) from actual spend', () => {
    const txs: BankTransaction[] = [tx({ accountId: 'a1', date: '2026-01-05', amount: 500, category: 'Salary' })];
    const rows = budgetVsActual(txs, ['a1'], {}, '2026-01');
    expect(rows).toEqual([]);
  });
});
