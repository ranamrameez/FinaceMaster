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
