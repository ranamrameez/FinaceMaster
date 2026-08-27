/** Budget Planner (README item 106 / user-requested 2026-08-26) — a
 * cross-module view over Cash/Bank/Rentals' ALREADY-EXISTING planned
 * entries (their own "Planning" tabs, see `plannedBalance.ts` and
 * `rentalPlanning.ts`) plus their real transaction history, unified into
 * one list and one monthly income/expense projection. Deliberately NOT a
 * new parallel budgeting system — per the user's own explicit design
 * choice (asked via `AskUserQuestion` before building), this reuses every
 * module's existing store rather than inventing a fourth one; "linking a
 * financial source" means picking which existing module/account a new
 * plan gets written into, through that module's own already-tested
 * `addEntry`/`addEntries` action.
 *
 * Every module's real+planned records get normalized into one common
 * shape (`BudgetActivity`) so a single monthly-bucketing function can
 * treat "a Cash IN of 500" and "a Bank transaction of -50" the same way —
 * each module's own type stays completely untouched; this is a pure
 * read-side combine, same spirit as `netWorth.ts`. */

import type { CashEntry } from '../../types/cashWorkbook';
import type { PlannedCashEntry } from '../../types/plannedCash';
import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';
import type { PlannedBankTransaction } from '../../types/plannedBank';
import type { Property, RentalEntry } from '../../types/rentalsWorkbook';
import type { PlannedRentalEntry } from '../../types/plannedRentals';

export type BudgetModule = 'cash' | 'bank' | 'rentals';

export interface BudgetActivity {
  id: string;
  module: BudgetModule;
  /** A human label for which specific account/property this belongs to —
   * "Cash" itself for the Cash module (no sub-accounts), an account/
   * property name for Bank/Rentals. */
  sourceLabel: string;
  date: string;
  /** Signed: positive = income, negative = expense — same convention as
   * `BankTransaction.amount`, so Bank needs no sign transformation at all;
   * Cash's `type: IN|OUT` and Rentals' `type: RENT_INCOME|EXPENSE` both
   * get mapped onto this one signed convention here. */
  amount: number;
  currencyCode: string;
  category?: string;
  description: string;
  /** `false` = a not-yet-executed plan (still just an intention); `true` =
   * a real transaction that already happened. An executed plan is
   * deliberately excluded from this list entirely by the normalizers
   * below (its real counterpart is already included as `executed: true`,
   * so including both would double-count the same money movement). */
  executed: boolean;
  /** Passthrough of `PlannedBankTransaction.sourceEmiLoanId` — set only for
   * a not-yet-executed EMI "Link to bank" installment plan. Exists so
   * `netWorthTrend.ts`'s monthly projection can exclude these from its
   * cash-flow term (their effect on Net Worth is already captured via the
   * EMI schedule's own liability reduction — counting both would double-
   * count the payment, see that file's own doc comment). */
  sourceEmiLoanId?: string;
}

function normalizeCash(entries: CashEntry[], plans: PlannedCashEntry[]): BudgetActivity[] {
  const real: BudgetActivity[] = entries.map((e) => ({
    id: e.id, module: 'cash', sourceLabel: 'Cash', date: e.date,
    amount: e.type === 'IN' ? e.amount : -e.amount, currencyCode: e.currencyCode,
    category: e.category, description: e.note || (e.type === 'IN' ? 'Cash in' : 'Cash out'), executed: true,
  }));
  const planned: BudgetActivity[] = plans.filter((p) => !p.executed).map((p) => ({
    id: p.id, module: 'cash', sourceLabel: 'Cash', date: p.date,
    amount: p.type === 'IN' ? p.amount : -p.amount, currencyCode: p.currencyCode,
    category: p.category, description: p.note || (p.type === 'IN' ? 'Planned cash in' : 'Planned cash out'), executed: false,
  }));
  return [...real, ...planned];
}

function normalizeBank(accounts: BankAccount[], transactions: BankTransaction[], plans: PlannedBankTransaction[]): BudgetActivity[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const real: BudgetActivity[] = transactions.flatMap((t) => {
    const account = accountById.get(t.accountId);
    if (!account) return [];
    return [{
      id: t.id, module: 'bank' as const, sourceLabel: account.name, date: t.date,
      amount: t.amount, currencyCode: account.currencyCode,
      category: t.category, description: t.description, executed: true,
    }];
  });
  const planned: BudgetActivity[] = plans.filter((p) => !p.executed).flatMap((p) => {
    const account = accountById.get(p.accountId);
    if (!account) return [];
    return [{
      id: p.id, module: 'bank' as const, sourceLabel: account.name, date: p.date,
      amount: p.amount, currencyCode: account.currencyCode,
      category: p.category, description: p.description, executed: false,
      sourceEmiLoanId: p.sourceEmiLoanId,
    }];
  });
  return [...real, ...planned];
}

function normalizeRentals(properties: Property[], entries: RentalEntry[], plans: PlannedRentalEntry[]): BudgetActivity[] {
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const real: BudgetActivity[] = entries.flatMap((e) => {
    const property = propertyById.get(e.propertyId);
    if (!property) return [];
    return [{
      id: e.id, module: 'rentals' as const, sourceLabel: property.name, date: e.date,
      amount: e.type === 'RENT_INCOME' ? e.amount : -e.amount, currencyCode: property.currencyCode,
      category: e.category, description: e.note || (e.type === 'RENT_INCOME' ? 'Rent income' : 'Expense'), executed: true,
    }];
  });
  const planned: BudgetActivity[] = plans.filter((p) => !p.executed).flatMap((p) => {
    const property = propertyById.get(p.propertyId);
    if (!property) return [];
    return [{
      id: p.id, module: 'rentals' as const, sourceLabel: property.name, date: p.date,
      amount: p.type === 'RENT_INCOME' ? p.amount : -p.amount, currencyCode: property.currencyCode,
      category: p.category, description: p.note || (p.type === 'RENT_INCOME' ? 'Planned rent income' : 'Planned expense'), executed: false,
    }];
  });
  return [...real, ...planned];
}

export function collectBudgetActivities(inputs: {
  cashEntries: CashEntry[]; plannedCash: PlannedCashEntry[];
  bankAccounts: BankAccount[]; bankTransactions: BankTransaction[]; plannedBank: PlannedBankTransaction[];
  rentalProperties: Property[]; rentalEntries: RentalEntry[]; plannedRentals: PlannedRentalEntry[];
}): BudgetActivity[] {
  return [
    ...normalizeCash(inputs.cashEntries, inputs.plannedCash),
    ...normalizeBank(inputs.bankAccounts, inputs.bankTransactions, inputs.plannedBank),
    ...normalizeRentals(inputs.rentalProperties, inputs.rentalEntries, inputs.plannedRentals),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthlyIncomeExpense {
  month: string; // "YYYY-MM"
  income: Record<string, number>; // by currency
  expense: Record<string, number>; // by currency, always positive
}

/** Buckets every activity (real + planned combined — this IS the
 * "projected" figure: what already happened this month plus what's still
 * planned to happen) into calendar months, split into income/expense per
 * currency. Callers typically ask for exactly 3 months (previous/current/
 * next) per the user's own request, but this itself is unbounded — pass
 * whichever months you want. */
export function monthlyIncomeExpense(activities: BudgetActivity[], months: string[]): MonthlyIncomeExpense[] {
  return months.map((month) => {
    const income: Record<string, number> = {};
    const expense: Record<string, number> = {};
    activities
      .filter((a) => a.date.slice(0, 7) === month)
      .forEach((a) => {
        if (a.amount >= 0) income[a.currencyCode] = (income[a.currencyCode] || 0) + a.amount;
        else expense[a.currencyCode] = (expense[a.currencyCode] || 0) + -a.amount;
      });
    return { month, income, expense };
  });
}

/** Calendar month strings ("YYYY-MM") from `asOf + startOffset` through
 * `asOf + endOffset` months, inclusive — the general form both
 * `threeMonthWindow` and the Budget Planner's own scrollable window
 * (README item 107, 2026-08-27) build on. */
export function monthRange(startOffset: number, endOffset: number, asOf: Date = new Date()): string[] {
  const out: string[] = [];
  for (let offset = startOffset; offset <= endOffset; offset++) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() + offset, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Previous/current/next calendar month strings ("YYYY-MM"), anchored to
 * `asOf` (defaults to today) — the exact 3-month window the user asked
 * for by name. */
export function threeMonthWindow(asOf: Date = new Date()): string[] {
  return monthRange(-1, 1, asOf);
}

/** The current calendar month string ("YYYY-MM"), anchored to `asOf`. */
export function currentMonth(asOf: Date = new Date()): string {
  return `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}`;
}

/** Predefined category suggestions (income and expense kept separate,
 * since they rarely overlap) — a plain suggestion datalist, never a fixed
 * enum, same "category fields must be free-form" rule as every other
 * module. Any custom category the user types is accepted identically. */
export const PREDEFINED_INCOME_CATEGORIES = [
  'Salary', 'Business income', 'Rent received', 'Dividends', 'Interest', 'Freelance', 'Gift received', 'Refund', 'Other income',
];
export const PREDEFINED_EXPENSE_CATEGORIES = [
  'Rent/Mortgage', 'Utilities', 'Groceries', 'Transport', 'Dining out', 'Entertainment', 'Healthcare', 'Insurance',
  'Education', 'Subscriptions', 'Shopping', 'Travel', 'Debt payment', 'Savings/Investment', 'Charity', 'Other expense',
];
