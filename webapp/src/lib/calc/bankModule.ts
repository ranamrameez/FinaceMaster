import { categoryName } from '../categories';
import type { Category } from '../../types/finance';
import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';
import { dateOnlyMs } from '../datetime';

export interface BankLedgerRow { tx: BankTransaction; balance: number; }

/** Running cleared balance for one account. Pending transactions are kept out
 * of the actual ledger; use accountPendingBalance for their separate impact. */
export function accountRunningLedger(account: BankAccount, transactions: BankTransaction[]): BankLedgerRow[] {
  const accountTxs = transactions.filter((t) => t.accountId === account.id && !t.isPending);
  const sorted = [...accountTxs].sort((a, b) => {
    const byDate = dateOnlyMs(a.date) - dateOnlyMs(b.date);
    return byDate !== 0 ? byDate : (a.serialNumber ?? 0) - (b.serialNumber ?? 0);
  });
  let balance = account.openingBalance;
  return sorted.map((tx) => {
    balance += tx.amount;
    return { tx, balance };
  });
}

export function accountBalance(account: BankAccount, transactions: BankTransaction[]): number {
  return transactions.filter((t) => t.accountId === account.id && !t.isPending).reduce((sum, t) => sum + t.amount, 0) + account.openingBalance;
}

export function accountPendingBalance(account: BankAccount, transactions: BankTransaction[]): number {
  return transactions.filter((t) => t.accountId === account.id && t.isPending).reduce((sum, t) => sum + t.amount, 0);
}

export function totalBalanceByCurrency(accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  accounts.filter((a) => !a.migratedToCreditCardId).forEach((a) => {
    out[a.currencyCode] = (out[a.currencyCode] || 0) + accountBalance(a, transactions);
  });
  return out;
}

export function assetBalanceByCurrency(accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  accounts.filter((a) => !a.isLiability && !a.migratedToCreditCardId).forEach((a) => {
    out[a.currencyCode] = (out[a.currencyCode] || 0) + accountBalance(a, transactions);
  });
  return out;
}

export function creditCardLiabilityByCurrency(accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  accounts.filter((a) => a.isLiability && !a.migratedToCreditCardId).forEach((a) => {
    const owed = Math.max(0, -accountBalance(a, transactions));
    if (owed > 0) out[a.currencyCode] = (out[a.currencyCode] || 0) + owed;
  });
  return out;
}

export function bankTotalsByCurrency(bankId: string, accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  return totalBalanceByCurrency(accounts.filter((a) => a.bankId === bankId), transactions);
}

/** Category breakdown of actual cleared transactions. Pending activity is
 * intentionally excluded; it has not affected the account yet. */
export function accountByCategory(account: BankAccount, transactions: BankTransaction[], categories: Category[]): Record<string, number> {
  const out: Record<string, number> = {};
  transactions.filter((t) => t.accountId === account.id && !t.isPending).forEach((t) => {
    const cat = categoryName(t.categoryID, categories);
    out[cat] = (out[cat] || 0) + t.amount;
  });
  return out;
}

export interface BankMonthlyFlow { month: string; income: number; expense: number; net: number; }

function monthlyFlowForTransactions(transactions: BankTransaction[]): BankMonthlyFlow[] {
  const byMonth: Record<string, { income: number; expense: number }> = {};
  transactions.forEach((t) => {
    const month = t.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
    if (t.amount >= 0) byMonth[month].income += t.amount;
    else byMonth[month].expense += -t.amount;
  });
  return Object.keys(byMonth).sort().map((month) => ({
    month,
    income: byMonth[month].income,
    expense: byMonth[month].expense,
    net: byMonth[month].income - byMonth[month].expense,
  }));
}

export function bankMonthlyFlow(transactions: BankTransaction[], accountIds: string[]): BankMonthlyFlow[] {
  const ids = new Set(accountIds);
  return monthlyFlowForTransactions(transactions.filter((t) => ids.has(t.accountId) && !t.isPending));
}

export interface AccountPeriodAnalytics {
  /** Full cleared running ledger for exactly one BankAccount. */
  ledger: BankLedgerRow[];
  /** Cleared ledger rows inside the optional inclusive YYYY-MM-DD bounds. */
  periodLedger: BankLedgerRow[];
  /** Exact transaction population used by every period metric/chart. */
  transactions: BankTransaction[];
  monthlyFlow: BankMonthlyFlow[];
  deposits: number;
  withdrawals: number;
  netFlow: number;
}

/**
 * Single source of truth for account analytics.
 *
 * Bank is only a grouping entity; analytics ownership is ALWAYS the
 * selected BankAccount.id. This intentionally starts from
 * accountRunningLedger, which already enforces that ownership and excludes
 * pending rows, then applies the optional month period once. Summary totals,
 * transaction count, category consumers and cash-flow charts can therefore
 * all consume the exact same transaction population.
 */
export function bankAnalyticsFromLedger(periodLedger: BankLedgerRow[]) {
  const periodTransactions = periodLedger.map(({ tx }) => tx);
  const deposits = periodTransactions.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0);
  const withdrawals = periodTransactions.reduce((sum, tx) => sum + (tx.amount < 0 ? -tx.amount : 0), 0);
  return {
    transactions: periodTransactions,
    monthlyFlow: monthlyFlowForTransactions(periodTransactions),
    deposits,
    withdrawals,
    netFlow: deposits - withdrawals,
  };
}

export function accountPeriodAnalytics(
  account: BankAccount,
  transactions: BankTransaction[],
  fromDate?: string,
  toDate?: string,
): AccountPeriodAnalytics {
  const ledger = accountRunningLedger(account, transactions);
  const periodLedger = ledger.filter(({ tx }) =>
    (!fromDate || tx.date >= fromDate) && (!toDate || tx.date <= toDate),
  );
  return { ledger, periodLedger, ...bankAnalyticsFromLedger(periodLedger) };
}

export interface BudgetRow { category: string; budget: number; actual: number; }

export function budgetVsActual(transactions: BankTransaction[], accountIds: string[], budgets: Record<string, number>, month: string, categories: Category[]): BudgetRow[] {
  const ids = new Set(accountIds);
  const actualByCategory: Record<string, number> = {};
  transactions.filter((t) => ids.has(t.accountId) && !t.isPending && t.date.slice(0, 7) === month && t.amount < 0).forEach((t) => {
    const cat = categoryName(t.categoryID, categories);
    actualByCategory[cat] = (actualByCategory[cat] || 0) - t.amount;
  });
  const categoryNames = new Set([...Object.keys(budgets), ...Object.keys(actualByCategory)]);
  return [...categoryNames].sort().map((category) => ({ category, budget: budgets[category] || 0, actual: actualByCategory[category] || 0 }));
}

export function accountBalanceAsOfMonth(ledger: BankLedgerRow[], month: string, openingBalance: number): number {
  let balance = openingBalance;
  for (const row of ledger) {
    if (row.tx.date.slice(0, 7) > month) break;
    balance = row.balance;
  }
  return balance;
}
