export interface Transaction {
  /** Stable id, not the transaction's array position. Optional because
   * QSE/PSX transactions have historically been index-addressed (see
   * CLAUDE.md) — added specifically so a Trade Planner leg ("Mark as
   * done") can keep pointing at the exact transaction it created even as
   * other transactions are added/edited/deleted around it, so an edit made
   * later in the Transactions page is reflected back in the plan instead
   * of the plan showing a stale snapshot. Retrofitted onto existing data
   * by `createWorkbookStore.ts`'s `normalize()`, same pattern as
   * `Transfer.id`. */
  id?: string;
  date: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  shares: number;
  price: number;
  /** PSX only (README item 7): manual override of the auto same-day-round-trip
   * detection, for when the recorded `date` doesn't line up with the actual
   * trade day (e.g. settlement-date entry) but the user knows from their
   * statement that this leg was netted. Ignored by QSE. */
  manualSameDay?: boolean;
  /** README item 11: manual override of this transaction's total fee, for
   * reconciling against the real account statement — when set, both
   * calculators (`makeQSEFeeCalculator`, `makePSXFeeCalculator`) return this
   * value directly instead of computing one, bypassing same-day netting
   * too. `undefined` means "use the computed fee" (the normal case);
   * unlike `manualSameDay` this is shared/meaningful for both exchanges. */
  feeOverride?: number;
}

export interface Transfer {
  /** Stable id, not the transfer's array position — needed so cross-entity
   * transfer links (README item 19) can reference a specific transfer that
   * survives other transfers being added/edited/deleted around it. */
  id: string;
  date: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  gross: number;
  fee: number;
}

export interface Adjustment {
  /** Stable id, not the adjustment's array position — added for the same
   * reason as `Transaction.id` (README item 51): every record type should
   * carry one, not just the ones a specific feature happened to need first.
   * Optional and retrofitted by `createWorkbookStore.ts`'s `normalize()`
   * since existing data predates this field; still index-addressed for now
   * (`updateAdjustment`/`removeAdjustment` unchanged) — nothing currently
   * needs to reference a specific adjustment the way linking needs
   * `Transfer.id`, so this is the groundwork, not a full addressing switch. */
  id?: string;
  date: string;
  amount: number;
  note?: string;
}

export interface TradePlanLeg {
  action: 'BUY' | 'SELL';
  ticker: string;
  shares: number;
  price: number;
  date?: string;
  /** True once this leg has been converted into a real Transaction via
   * "Mark as done" (README item 9) — the leg itself is left in place as a
   * record of the plan, the corresponding Transaction is a separate,
   * independent entry in `transactions`. */
  executed?: boolean;
  /** The `id` of the real Transaction this leg's "Mark as done" created —
   * lets the UI show that transaction's LIVE data (date/shares/price/fee)
   * instead of the leg's own frozen-at-execution-time snapshot, so an edit
   * made later in the Transactions page is reflected here too. Absent on
   * legs executed before this field existed, or if the linked transaction
   * was later deleted — the UI falls back to the leg's own snapshot in
   * either case. */
  executedTransactionId?: string;
}

/** README item 9: a saved, multi-leg trade sketch — plan several buys/sells
 * ahead of time, edit them, and convert individual legs into real
 * transactions ("Mark as done") without re-typing the same data. */
export interface TradePlan {
  id: string;
  name: string;
  createdAt: string;
  notes?: string;
  legs: TradePlanLeg[];
  /** Most trade plans revolve around one ticker ("standard is, a default
   * ticker per trade plan" — user request) — set once, new legs
   * (both the initial one and any added later) pre-fill with it instead of
   * starting blank, while a leg can still be changed to a different
   * ticker for the (less common) multi-ticker plan. */
  defaultTicker?: string;
}

export interface PricePoint {
  date: string;
  time?: string;
  price: number;
}

export interface WatchlistItem {
  ticker: string;
  target: number;
  current?: number;
}

export interface Dividend {
  /** Stable id — same reasoning as `Adjustment.id` above (README item 51). */
  id?: string;
  date: string;
  ticker: string;
  perShare: number;
  shares: number;
  amount: number;
}

export interface QSESettings {
  feePct: number;
  minFee: number;
  tick: number;
  currency: string;
  depositFee: number;
}

export interface Appearance {
  theme: 'light' | 'dark';
  font: string;
  fontSize: string;
  colorTheme: string;
  density: string;
  /** User-reported preference: stat-card money values were made compact
   * (10,000 -> "10k") unconditionally (README item 56) with the full number
   * only a hover away — this lets the user flip that default and see raw,
   * un-abbreviated numbers everywhere instead. Optional so existing stored
   * appearance JSON without this field still parses; `undefined` is treated
   * as `'compact'` (today's unchanged default) wherever it's read. */
  numberDisplay?: 'compact' | 'raw';
}

export interface Workbook {
  settings: QSESettings;
  /** @deprecated appearance is now a global preference (see
   * store/appearanceStore.ts), not per-workbook — kept optional here only
   * so old exported/synced JSON still parses. */
  appearance?: Appearance;
  transactions: Transaction[];
  transfers: Transfer[];
  adjustments: Adjustment[];
  marketPrices: Record<string, number>;
  priceHistory: Record<string, PricePoint[]>;
  watchlist: WatchlistItem[];
  dividends: Dividend[];
  /** ticker -> user-entered estimated annual dividend per share, used for
   * the yearly projection table. Not derived from historical payouts. */
  dividendEstimates: Record<string, number>;
  tradePlans: TradePlan[];
}

/** Computes a transaction's fee. Kept pluggable so different exchanges can
 * reuse the same calc engine (computePositions, buildCashLedger, etc.).
 * `context` is optional and ignored by simple percentage-fee calculators
 * (e.g. QSE) — PSX's calculator uses `context.shares` for per-share fee
 * tiers (CDC, low-price commission) and `context.tx` to net same-day
 * buy/sell commissions against each other. */
export type FeeCalculator = (
  amount: number,
  isBuy: boolean,
  context?: { shares?: number; tx?: Transaction },
) => number;

export interface PricingContext {
  calcFee: FeeCalculator;
  feePct: number;
  tick: number;
}

export interface Position {
  ticker: string;
  shares: number;
  invested: number;
  buyFees: number;
  sellFees: number;
  realized: number;
  totalBoughtShares: number;
  totalSoldShares: number;
  buyCount: number;
  sellCount: number;
  firstDate: string;
  lastDate: string;
}

export interface CashLedgerEvent {
  date: string;
  kind: 'trade' | 'transfer' | 'adjustment';
  action: string;
  label: string;
  amount: number;
  fee: number;
  balance: number;
}

export interface CashSummary {
  totalInward: number;
  totalOutward: number;
  transferFees: number;
  tradingFees: number;
  totalCharges: number;
  totalRewards: number;
  realizedPL: number;
  unrealizedPL: number;
  netPL: number;
  cashBalance: number;
  portfolioValue: number;
  netWorth: number;
  ledger: CashLedgerEvent[];
}

export interface RealizedPLPoint {
  date: string;
  value: number;
}

export interface PriceStats {
  min: number;
  minDate: string;
  max: number;
  maxDate: string;
  median: number;
  count: number;
  totalUpdates: number;
  recent: PricePoint[];
  chronological: PricePoint[];
}
