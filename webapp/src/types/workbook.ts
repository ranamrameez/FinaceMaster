export interface Transaction {
  date: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  shares: number;
  price: number;
}

export interface Transfer {
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
