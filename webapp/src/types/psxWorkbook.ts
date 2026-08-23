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
