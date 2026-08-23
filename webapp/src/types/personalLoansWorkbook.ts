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
  loanId: string;
  date: string;
  amount: number;
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
