import type { Adjustment, Appearance, Dividend, PricePoint, Transaction, TradePlan, Transfer, WatchlistItem } from './workbook';

export interface PSXSettings {
  feePct: number;
  lowPriceThreshold: number;
  lowPriceFee: number;
  sstPct: number;
  sstIncludedInCommission: boolean;
  psxFeePct: number;
  nccplFeePct: number;
  secpLevyPct: number;
  cdcPerShare: number;
  cvtPct: number;
  minFee: number;
  tick: number;
  currency: string;
  depositFee: number;
  cgtFilerPct: number;
  cgtNonFilerPct: number;
  filerStatus: 'filer' | 'nonfiler';
  /** README item 8: cost-basis method for realized/unrealized P/L and CGT.
   * 'average' (default) is the original weighted-average behavior — every
   * buy blends into one running average cost, so a sell can't be tied to a
   * specific lot. 'fifo' tracks each buy as its own lot ("each buy should
   * have its own sell peer") and consumes the oldest open lot first on a
   * sell, giving lot-accurate realized P/L. Opt-in, not the default,
   * because switching it changes a real user's computed historical P/L
   * numbers — never flip this silently. */
  costBasisMethod: 'average' | 'fifo';
  /** User-requested 2026-08-27 ("I need automation... auto check the
   * commission + manual entry (%age or lump sum), not itemized fields I
   * have to reconcile myself"): an alternative to the itemized commission+
   * SST+levies breakdown above — one all-in % of trade value, applied on
   * the CHARGED side of a trade exactly like the itemized total is (same-
   * day netting still auto-detected from Buy/Sell/date the same way), with
   * the netted side paying nothing extra (this mode has no separate
   * "levies" figure to net down to, and the itemized mode's own levies are
   * already a tiny fraction of a percent by default — see `calcFeeBreakdown`).
   * Optional/undefined behaves as 'itemized' so no existing account is
   * silently switched. Never the default for a NEW workbook either — the
   * itemized breakdown stays calibrated against a real broker statement
   * (README Done item 130) and is what a user sees until they explicitly
   * opt into Simple with their own observed all-in rate. */
  feeMode?: 'itemized' | 'simple';
  /** All-in commission %, used only when `feeMode === 'simple'`. */
  allInFeePct?: number;
}

export interface PSXWorkbook {
  settings: PSXSettings;
  /** @deprecated appearance is now a global preference, not per-exchange —
   * kept optional here only so old exported/synced JSON still parses. */
  appearance?: Appearance;
  transactions: Transaction[];
  transfers: Transfer[];
  adjustments: Adjustment[];
  marketPrices: Record<string, number>;
  priceHistory: Record<string, PricePoint[]>;
  watchlist: WatchlistItem[];
  dividends: Dividend[];
  dividendEstimates: Record<string, number>;
  tradePlans: TradePlan[];
}
