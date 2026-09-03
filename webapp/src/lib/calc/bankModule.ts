import { categoryName } from '../categories';
import type { Category } from '../../types/finance';
import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';
import { toInstantMs } from '../datetime';

export interface BankLedgerRow {
  tx: BankTransaction;
  balance: number;
}

/** Running balance for one account, starting from its opening balance, in
 * real-instant chronological order; two transactions tied at the same
 * instant (the common case for untimed records, which default to the
 * same noon-UTC placeholder) are then ordered by `serialNumber` — a
 * stable, persisted per-transaction counter (see `Finance.serialNumber`'s
 * doc comment) — rather than relying on `Array.prototype.sort`'s
 * stability. */
export function accountRunningLedger(account: BankAccount, transactions: BankTransaction[]): BankLedgerRow[] {
  const accountTxs = transactions.filter((t) => t.accountId === account.id);
  const sorted = [...accountTxs].sort((a, b) => {
    const byInstant = toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone);
    return byInstant !== 0 ? byInstant : (a.serialNumber ?? 0) - (b.serialNumber ?? 0);
  });
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
 * blended/converted (no live FX-rate source, see MODULES_PLAN.md).
 * Includes liability (credit card) accounts blended in with the rest —
 * this is intentionally a NET figure (a card's negative balance already
 * offsets a checking account's positive one when summed), used for
 * Banking's own "Accounts in CODE" stat card. For a figure that separates
 * assets from credit-card debt (e.g. Net Worth's own breakdown), use
 * `assetBalanceByCurrency`/`creditCardLiabilityByCurrency` instead. */
export function totalBalanceByCurrency(accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  accounts.forEach((a) => {
    out[a.currencyCode] = (out[a.currencyCode] || 0) + accountBalance(a, transactions);
  });
  return out;
}

/** Same as `totalBalanceByCurrency` but excludes liability (credit card)
 * accounts — the pure-asset figure Net Worth should count as a plain
 * positive contribution. */
export function assetBalanceByCurrency(accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  accounts.filter((a) => !a.isLiability).forEach((a) => {
    out[a.currencyCode] = (out[a.currencyCode] || 0) + accountBalance(a, transactions);
  });
  return out;
}

/** How much is owed across liability (credit card) accounts, grouped by
 * currency — always returned as a POSITIVE "amount owed" figure (a card's
 * own `accountBalance` is negative while money is owed, following the
 * same signed-transaction convention as every other account; this flips
 * it to the positive-debt convention Net Worth's `emiOutstanding`/
 * `personalLoansNet` liability inputs already use). A card that's paid
 * off or in credit (a positive `accountBalance`) contributes 0, never a
 * negative "liability." */
export function creditCardLiabilityByCurrency(accounts: BankAccount[], transactions: BankTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  accounts.filter((a) => a.isLiability).forEach((a) => {
    const owed = Math.max(0, -accountBalance(a, transactions));
    if (owed > 0) out[a.currencyCode] = (out[a.currencyCode] || 0) + owed;
  });
  return out;
}

/** Category breakdown for one account (net credit minus debit per
 * category). Keyed by category NAME (resolved from `categoryID` via the
 * shared registry), not the id itself — every existing caller/chart
 * already expects a display-ready name as the key. */
export function accountByCategory(account: BankAccount, transactions: BankTransaction[], categories: Category[]): Record<string, number> {
  const out: Record<string, number> = {};
  transactions
    .filter((t) => t.accountId === account.id)
    .forEach((t) => {
      const cat = categoryName(t.categoryID, categories);
      out[cat] = (out[cat] || 0) + t.amount;
    });
  return out;
}

export interface BankMonthlyFlow {
  month: string;
  income: number;
  expense: number;
  net: number;
}

/** Income vs. spend per calendar month, across whichever accounts the
 * caller passes in (MODULES_PLAN.md §11: "income vs. spend by month" for
 * Banking's Analytics tab) — same shape as Cash's `cashMonthlyFlow`, but
 * built from Bank's signed-`amount` transactions instead of Cash's
 * IN/OUT + unsigned-amount entries, since the two modules' data models
 * differ. Callers pass the set of account ids sharing the currency being
 * charted (see `accountByCategory`'s equivalent per-account scoping). */
export function bankMonthlyFlow(transactions: BankTransaction[], accountIds: string[]): BankMonthlyFlow[] {
  const ids = new Set(accountIds);
  const byMonth: Record<string, { income: number; expense: number }> = {};
  transactions
    .filter((t) => ids.has(t.accountId))
    .forEach((t) => {
      const month = t.date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
      if (t.amount >= 0) byMonth[month].income += t.amount;
      else byMonth[month].expense += -t.amount;
    });
  return Object.keys(byMonth)
    .sort()
    .map((month) => ({ month, income: byMonth[month].income, expense: byMonth[month].expense, net: byMonth[month].income - byMonth[month].expense }));
}

export interface BudgetRow {
  category: string;
  budget: number;
  actual: number;
}

/** Monthly category spend vs. a user-set target — the "simple budget/
 * spend-plan tool" MODULES_PLAN.md §11 asks for. `budgets` is keyed by
 * category name (free-form, per this app's own "categories are never a
 * fixed enum" rule) with a monthly target amount. Only debits (spend)
 * count toward `actual` — a credit in a spend category (e.g. a refund)
 * nets against it rather than being ignored, matching how a real budget
 * would treat a refund. Includes every category that has EITHER a set
 * budget OR actual spend this month, so an unbudgeted category the user
 * actually spent in still shows up rather than being silently dropped. */
export function budgetVsActual(
  transactions: BankTransaction[],
  accountIds: string[],
  budgets: Record<string, number>,
  month: string,
  categories: Category[],
): BudgetRow[] {
  const ids = new Set(accountIds);
  const actualByCategory: Record<string, number> = {};
  transactions
    .filter((t) => ids.has(t.accountId) && t.date.slice(0, 7) === month && t.amount < 0)
    .forEach((t) => {
      const cat = categoryName(t.categoryID, categories);
      actualByCategory[cat] = (actualByCategory[cat] || 0) - t.amount;
    });
  const categoryNames = new Set([...Object.keys(budgets), ...Object.keys(actualByCategory)]);
  return [...categoryNames]
    .sort()
    .map((category) => ({ category, budget: budgets[category] || 0, actual: actualByCategory[category] || 0 }));
}
