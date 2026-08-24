export interface Transaction {
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
