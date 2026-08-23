import type { PSXSettings, PSXWorkbook } from '../types/psxWorkbook';

export const DEFAULT_PSX_SETTINGS: PSXSettings = {
  feePct: 0.20,
  lowPriceThreshold: 25,
  lowPriceFee: 0.05,
  sstPct: 15,
  sstIncludedInCommission: false,
  psxFeePct: 0,
  nccplFeePct: 0.011,
  secpLevyPct: 0,
  cdcPerShare: 0,
  cvtPct: 0,
  minFee: 0,
  tick: 0.01,
  currency: 'PKR',
  depositFee: 0,
  cgtFilerPct: 15,
  // README item 5: real broker schedules charge non-filers a much higher
  // rate than filers (JS Bank: ~30%) — the legacy app defaulted both to
  // 15%. Still user-editable in Settings if your broker differs.
  cgtNonFilerPct: 30,
  filerStatus: 'filer',
  costBasisMethod: 'average',
};

export function createEmptyPSXWorkbook(): PSXWorkbook {
  return {
    settings: { ...DEFAULT_PSX_SETTINGS },
    transactions: [],
    transfers: [],
    adjustments: [],
    marketPrices: {},
    priceHistory: {},
    watchlist: [],
    dividends: [],
    dividendEstimates: {},
    tradePlans: [],
  };
}
