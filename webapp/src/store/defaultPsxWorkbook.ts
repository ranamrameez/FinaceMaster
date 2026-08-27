import type { PSXSettings, PSXWorkbook } from '../types/psxWorkbook';

export const DEFAULT_PSX_SETTINGS: PSXSettings = {
  feePct: 0.20,
  lowPriceThreshold: 25,
  lowPriceFee: 0.05,
  sstPct: 15,
  sstIncludedInCommission: false,
  psxFeePct: 0,
  // Calibrated 2026-08-25 against a real JS Global Capital / Zindigi
  // contract note's "Levies Charges" column (13 rows, one full statement,
  // plus 4 independent spot-checks from an earlier statement) — every real
  // value reconciles exactly under standard 2-decimal rounding at this
  // rate (the fitted range was 0.01185%-0.01202%; this app models the
  // whole combined PSX+NCCPL+SECP+CDC "Levies" line item as one bucket via
  // this single field, rather than guessing at each component separately,
  // since the broker's own statement doesn't itemize them either).
  nccplFeePct: 0.0119,
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
  // Itemized stays the default for every new workbook — see PSXSettings'
  // own doc comment for why. allInFeePct starts at 0 rather than a guessed
  // number so a user opting into Simple mode has to type their own real
  // observed rate, never inherit an unverified default.
  feeMode: 'itemized',
  allInFeePct: 0,
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
