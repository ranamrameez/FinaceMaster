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
}

export interface BankWorkbook {
  settings: BankSettings;
  transactions: BankTransaction[];
}
