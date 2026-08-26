export interface BankAccount {
  id: string;
  name: string;
  /** An account has one currency (real-world bank accounts do) — unlike
   * Cash/Personal Loans, currency isn't repeated per-transaction here. */
  currencyCode: string;
  openingBalance: number;
  /** User-requested: saved so a future SMS-based transaction-import feature
   * (parsing "Rs. 500 debited from a/c XX1234" style bank alerts) can match
   * an incoming SMS to the right account. All optional — nothing about
   * matching/importing from SMS is built yet, this just gives that future
   * feature somewhere to read from. `accountNumber` is whatever the bank
   * shows on statements/SMS (often partially masked, e.g. "xxxx1234") —
   * intentionally a plain string, not validated against any particular
   * bank's format. `smsSenderId` is the sender ID/short code the bank's
   * alert SMS actually arrives from (e.g. "8123" or a bank name string),
   * separate from `smsSenderNumber` since some banks send from a numeric
   * short code and others from a named sender or a full phone number. */
  accountNumber?: string;
  smsSenderId?: string;
  smsSenderNumber?: string;
  /** README item 82 (2026-08-26 feedback): optional, free-form (not a fixed
   * enum, per this project's own "category fields must be free-form" rule)
   * — a branch name/code and a description like "Savings"/"Current"/
   * "Checking" a user would recognize from their own bank, not a
   * standardized list this app enforces. */
  branch?: string;
  accountType?: string;
  /** User-requested (2026-08-26): an optional IBAN, plus the bank name/BIC
   * a lookup against it can fill in (see `lib/ibanLookup.ts`) — all still
   * freely hand-editable, since lookup can fail or the account may not
   * have an IBAN at all (many PKR/QAR accounts don't). */
  iban?: string;
  bankName?: string;
  bic?: string;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  /** Optional time-of-day ("HH:MM"), defaults to noon when absent — see
   * `lib/datetime.ts`. Lets same-day transactions sort by real chronology. */
  time?: string;
  /** IANA timezone the `date`+`time` are in; defaults to UTC when absent. */
  timezone?: string;
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
