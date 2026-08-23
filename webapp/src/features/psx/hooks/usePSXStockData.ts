import { PSX_TICKER_NAMES, PSX_TICKER_SECTORS } from '../../../lib/stockData/psxSeed';

/** PSX's equivalent of useQSEStockData. Unlike QSE, there's no shared
 * `stockData/PSX` Firebase node (yet) to read from — this just returns the
 * bundled seed directly. If PSX ever gets a shared/editable stock-data node
 * the way QSE does (see lib/stockData/reader.ts), swap this for the same
 * fetch-with-fallback pattern. */
export function usePSXStockData() {
  return { tickerNames: PSX_TICKER_NAMES, sectors: PSX_TICKER_SECTORS };
}
