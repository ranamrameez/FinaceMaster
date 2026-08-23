/** README item 19 / MODULES_PLAN.md §7-§8: money moving between two
 * modules (e.g. Bank -> Cash, Bank -> a stock exchange's cash balance, a
 * tenant's rent into Bank and a Rentals property at once) as one linked
 * record instead of two independently-typed entries that can silently
 * drift apart (one side edited or deleted without the other).
 *
 * v1 scope: Cash <-> Bank, Bank <-> QSE, Bank <-> PSX. Extended
 * 2026-08-23 to include Rentals (Bank/Cash <-> a specific property — a
 * rent payment in, or an expense paid out) since `RentalEntry` already had
 * a stable id and needed no retrofit, unlike Personal Loans (repayments
 * were addressed by `(loanId, index)`, not a stable id) or EMI (no
 * repayment ledger to link into at all — see MODULES_PLAN.md §8). Extended
 * again the same day to include Personal Loans now that
 * `PersonalLoanRepayment` has been retrofitted with a stable id
 * (Bank/Cash <-> a specific loan's repayment ledger). Funds linking can
 * follow once its `Transfer` field is actually exposed in the UI. */
export type LinkModule = 'cash' | 'bank' | 'qse' | 'psx' | 'rentals' | 'personalLoans';

export const LINK_MODULES: LinkModule[] = ['cash', 'bank', 'qse', 'psx', 'rentals', 'personalLoans'];

export const LINK_MODULE_LABELS: Record<LinkModule, string> = {
  cash: 'Cash',
  bank: 'Banking',
  qse: 'QSE (Stocks)',
  psx: 'PSX (Stocks)',
  rentals: 'Rentals',
  personalLoans: 'Personal Loans',
};

export interface LinkSideConfig {
  module: LinkModule;
  /** A `BankAccount.id` when `module === 'bank'`, a `Property.id` when
   * `module === 'rentals'`, or a `PersonalLoan.id` when
   * `module === 'personalLoans'` — the sides with more than one sub-entity
   * to choose from. Ignored otherwise. */
  ref?: string;
  /** A `CashEntry.currencyCode` when `module === 'cash'` — the only side
   * whose ledger record needs its own currency field (Bank/Rentals derive
   * it from the account/property, QSE/PSX from the exchange's single
   * settings.currency). */
  currencyCode?: string;
}

export interface InterEntityTransferInput {
  date: string;
  /** Always positive, in the `from` side's own currency. */
  fromAmount: number;
  /** Always positive, in the `to` side's own currency. Independent of
   * `fromAmount` — MODULES_PLAN.md §8: no live FX-rate lookup, so a
   * genuinely cross-currency transfer (e.g. USD bank account -> PKR cash)
   * needs the user to enter both amounts from whatever real conversion
   * actually happened (their bank's rate, a cash exchange receipt, ...).
   * When both sides share a currency this is typically equal to
   * `fromAmount`, but is never silently assumed to be — always stored
   * explicitly so an edit can recompute either side correctly without
   * losing the original manual conversion. */
  toAmount: number;
  from: LinkSideConfig;
  to: LinkSideConfig;
  note?: string;
}

export interface InterEntityTransfer extends InterEntityTransferInput {
  id: string;
  /** id of the ledger record this link created on the `from` side. */
  fromRecordId: string;
  /** id of the ledger record this link created on the `to` side. */
  toRecordId: string;
}

export interface InterEntityWorkbook {
  settings: Record<string, never>;
  entries: InterEntityTransfer[];
}
