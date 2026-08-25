export interface PersonalLoan {
  id: string;
  person: string;
  direction: 'owed_to_me' | 'i_owe';
  /** Per-loan, not per-module — see MODULES_PLAN.md's cross-cutting
   * currency decision. */
  currencyCode: string;
  principal: number;
  date: string;
  note?: string;
}

export interface PersonalLoanRepayment {
  /** Stable id, not a per-loan array position — retrofitted 2026-08-23 so
   * cross-entity transfer links (README item 19/21) can reference a
   * specific repayment that survives other repayments being added/edited/
   * deleted around it, same reasoning as `Transfer`/`CashEntry`'s earlier
   * id retrofits. */
  id: string;
  loanId: string;
  date: string;
  /** Optional time-of-day ("HH:MM"), defaults to noon when absent — see
   * `lib/datetime.ts`. Lets same-day repayments sort by real chronology. */
  time?: string;
  /** IANA timezone the `date`+`time` are in; defaults to UTC when absent. */
  timezone?: string;
  amount: number;
  /** 'statement-import' added 2026-08-23 (README item 25 / MODULES_PLAN.md
   * §13's CSV-import scope) — same "transaction doesn't care about its
   * source" shape as Bank/Cash/Rentals. Unset (implicitly manual) for
   * every repayment logged before today. */
  source?: 'manual' | 'statement-import';
  statementRef?: string;
}

export interface PersonalLoansSettings {
  /** Pre-fills new entries only — never converts existing ones. */
  defaultCurrency: string;
}

export interface PersonalLoansWorkbook {
  settings: PersonalLoansSettings;
  loans: PersonalLoan[];
  repayments: PersonalLoanRepayment[];
}
