import type { FundsSettings, FundsWorkbook } from '../types/fundsWorkbook';

export const DEFAULT_FUNDS_SETTINGS: FundsSettings = {
  defaultCurrency: 'USD',
};

export function createEmptyFundsWorkbook(): FundsWorkbook {
  return {
    settings: { ...DEFAULT_FUNDS_SETTINGS },
    funds: [],
    brokers: [],
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
