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
   * specific lot; this can make a real loss look like a profit once the
   * account has done any deliberate cheap-lot-first selling (the reduction
   * gets spread across the whole position instead of really coming off the
   * lot sold). 'fifo' and 'lowestCostFirst' both track each buy as its own
   * lot instead — 'fifo' consumes the oldest open lot first on an
   * untargeted sell, 'lowestCostFirst' consumes the cheapest.
   *
   * **Recommended: 'fifo'.** Real-world research (2026-09-18, prompted by
   * the user directly asking "please study how exchanges handle the
   * trades"): NCCPL, mandated by Pakistan's FBR under Section 37A of the
   * Income Tax Ordinance 2001, computes every investor's real Capital
   * Gains Tax using MANDATORY chronological FIFO, tracked per-lot through
   * CDC — a real PSX broker's own "Buy Average"/CGT figure is genuine
   * FIFO, not lowest-cost-first (an earlier version of this comment
   * claimed the opposite; that was an unverified guess, corrected once
   * actually researched — see webapp/README.md's "Cost-basis worked
   * examples" section for the full citations and the IQCD case this
   * reasoning was checked against). 'lowestCostFirst' is kept as a
   * deliberate, real, opt-in second view — the "Trader Strategy" style the
   * Trade Strategy page's Partial Trade Advisor always uses regardless of
   * this setting (see `partialTradeStrategy.ts`) — not the recommended
   * default for the OFFICIAL numbers.
   *
   * Either lot-based mode still needs `Transaction.targetLotBuyId`/
   * `lotAllocations` for the common real case of a deliberate,
   * non-chronological, non-cheapest sale (e.g. protecting one specific
   * expensive lot) — see those fields' own doc comments for the full
   * attribution priority. All three options are opt-in, not the default,
   * because switching changes a real user's computed historical P/L
   * numbers — never flip this silently. */
  costBasisMethod: 'average' | 'fifo' | 'lowestCostFirst';
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
  /** User-requested (2026-09-06): "let the user choose (checkboxes?) to
   * include the accounts in the Net calcs" — PSX is one portfolio with no
   * sub-accounts, so this is a whole-module on/off switch (same rationale
   * as `CashSettings.includeInNetWorth`). Optional, defaults to included
   * (true) when absent. Checked from the Dashboard's "Include in Net
   * Worth" panel. */
  includeInNetWorth?: boolean;
  /** User-requested (2026-09-11): opt-in, off by default — "it should be
   * configurable in settings, if user like to opt this risky strategy."
   * See `QSESettings.partialTradeAlertsEnabled`'s identical doc comment. */
  partialTradeAlertsEnabled?: boolean;
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
