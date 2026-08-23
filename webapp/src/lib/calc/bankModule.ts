import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';

export interface BankLedgerRow {
  tx: BankTransaction;
  balance: number;
}

/** Running balance for one account, starting from its opening balance,
 * chronological order (ties keep original array order — stable sort). */
export function accountRunningLedger(account: BankAccount, transactions: BankTransaction[]): BankLedgerRow[] {
  const accountTxs = transactions.filter((t) => t.accountId === account.id);
  const sorted = [...accountTxs].sort((a, b) => a.date.localeCompare(b.date));
  let balance = account.openingBalance;
  return sorted.map((tx) => {
    balance += tx.amount;
    return { tx, balance };
  });
}

/** Current balance for one account: opening balance + all its transactions. */
export function accountBalance(account: BankAccount, transactions: BankTransaction[]): number {
  return transactions
    .filter((t) => t.accountId === account.id)
    .reduce((sum, t) => sum + t.amount, 0) + account.openingBalance;
}

/** Total balance across all accounts, grouped by currency — never
 * blended/converted (no live FX-rate source, see MODULES_PLAN.md). */
export function totalBalanceByCurrency(accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  accounts.forEach((a) => {
    out[a.currencyCode] = (out[a.currencyCode] || 0) + accountBalance(a, transactions);
  });
  return out;
}

/** Category breakdown for one account (net credit minus debit per
 * category). */
export function accountByCategory(account: BankAccount, transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  transactions
    .filter((t) => t.accountId === account.id)
    .forEach((t) => {
      const cat = t.category?.trim() || 'Uncategorized';
      out[cat] = (out[cat] || 0) + t.amount;
    });
  return out;
}
