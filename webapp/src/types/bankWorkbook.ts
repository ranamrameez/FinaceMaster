import type { Finance } from './finance';

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
  /** User-requested (2026-08-26): credit card tracking, "so we can truly
   * count net worth." A credit card is its own independent `BankAccount`
   * (own balance, own transaction ledger) — NOT tied to whichever real
   * account happens to pay its statement, since the user explicitly noted
   * a card can be paid from any of several accounts at the same bank, ad
   * hoc each time (a manual debit-on-one-account + credit-on-the-card
   * pair of transactions, same as any other inter-account movement in
   * this app — no dedicated "linked payer" field). `isLiability` is the
   * only thing that changes behavior: `lib/calc/bankModule.ts`'s
   * `assetBalanceByCurrency`/`creditCardLiabilityByCurrency` split on it,
   * and Net Worth counts a liability account's balance as debt instead of
   * an asset. The existing signed-transaction convention (negative =
   * debit/spend, positive = credit/payment) already works unmodified for
   * a credit card — spending drives its balance negative (money owed),
   * a payment brings it back toward zero, exactly like a real statement. */
  isLiability?: boolean;
  creditLimit?: number;
  annualFee?: number;
  /** Day of month (1-31) the billing cycle closes / statement generates. */
  statementDate?: number;
  /** Day of month (1-31) payment is due. */
  paymentDueDate?: number;
  /** Late-payment charge applied after `paymentDueDate` passes unpaid. */
  lateFeeAfterDue?: number;
  /** The minimum amount due on a statement (a fixed figure, not a %  —
   * real cards vary here; a fixed minimum is what the user asked for). */
  minPaymentAmount?: number;
  /** Free-form (e.g. "Visa", "Mastercard") — never a fixed enum, per this
   * project's own "category fields must be free-form" rule; a suggestion
   * datalist covers the common ones. Optionally auto-filled from
   * `cardBin` via `lib/binLookup.ts`. */
  cardNetwork?: string;
  /** First 6-8 digits of the card (a BIN/IIN) — enough to identify the
   * issuing network/bank via a public lookup, deliberately never the full
   * card number (this app never asks for or stores that, same caution
   * already applied to `accountNumber`, which only ever holds a masked
   * trailing few digits). */
  cardBin?: string;
}

/** Extends the shared `Finance` base (2026-09-03 restructure — see
 * `types/finance.ts`'s file-level comment). `amount` stays SIGNED here
 * (Finance's own doc comment names this as the one deliberate exception —
 * see there for why) and `description` (not `Finance.title`) remains the
 * real required "what is this" field, since it already did that job. */
export interface BankTransaction extends Finance {
  accountId: string;
  description: string;
  /** @deprecated superseded by `Finance.categoryID` — see
   * `CashEntry.category`'s doc comment for the full reasoning, identical
   * here. */
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
