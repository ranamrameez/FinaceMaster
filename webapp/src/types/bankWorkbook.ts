export interface BankAccount {
  id: string;
  name: string;
  /** An account has one currency (real-world bank accounts do) — unlike
   * Cash/Personal Loans, currency isn't repeated per-transaction here. */
  currencyCode: string;
  openingBalance: number;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  /** Signed: negative = debit/spend, positive = credit/deposit. */
  amount: number;
  description: string;
  /** Free-form, user-definable — never a fixed enum (locked decision,
   * MODULES_PLAN.md). */
  category?: string;
  source: 'manual' | 'statement-import';
  /** Which imported statement (filename) this row came from, for
   * traceability back to the source file. */
  statementRef?: string;
}

export interface BankSettings {
  accounts: BankAccount[];
  /** Monthly spend target per category (free-form category name -> a
   * currency-agnostic target amount, in whatever currency the user has in
   * mind when setting it — same simplification as the rest of this app's
   * "no live FX conversion" rule). Optional so existing stored workbooks
   * without any budgets set still parse; `undefined` is treated as `{}`
   * wherever it's read. MODULES_PLAN.md §11's "simple budget/spend-plan
   * tool" for Banking's Analytics tab. */
  budgets?: Record<string, number>;
}

export interface BankWorkbook {
  settings: BankSettings;
  transactions: BankTransaction[];
}
