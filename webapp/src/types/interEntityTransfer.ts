/** README item 19 / MODULES_PLAN.md §7: money moving between two modules
 * (e.g. Bank -> Cash, Bank -> a stock exchange's cash balance) as one
 * linked record instead of two independently-typed entries that can
 * silently drift apart (one side edited or deleted without the other).
 *
 * v1 scope: Cash <-> Bank, Bank <-> QSE, Bank <-> PSX — the pairs
 * MODULES_PLAN.md calls out as the most common real flows. Funds/Rentals/
 * EMI/Personal Loans linking can follow the same shape later; nothing here
 * assumes only these four modules will ever participate. */
export type LinkModule = 'cash' | 'bank' | 'qse' | 'psx';

export const LINK_MODULES: LinkModule[] = ['cash', 'bank', 'qse', 'psx'];

export const LINK_MODULE_LABELS: Record<LinkModule, string> = {
  cash: 'Cash',
  bank: 'Banking',
  qse: 'QSE (Stocks)',
  psx: 'PSX (Stocks)',
};

export interface LinkSideConfig {
  module: LinkModule;
  /** A `BankAccount.id` when `module === 'bank'` — Bank is the only side
   * with more than one sub-account to choose from. Ignored otherwise. */
  ref?: string;
  /** A `CashEntry.currencyCode` when `module === 'cash'` — the only side
   * whose ledger record needs its own currency field (Bank derives it from
   * the account, QSE/PSX from the exchange's single settings.currency). */
  currencyCode?: string;
}

export interface InterEntityTransferInput {
  date: string;
  /** Always positive — direction is which side is `from` vs `to`. */
  amount: number;
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
