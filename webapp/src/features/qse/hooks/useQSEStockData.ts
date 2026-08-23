import { useEffect, useState } from 'react';
import { fetchQSEStockData, type QSEStockData } from '../../../lib/stockData/reader';
import { QSE_FUNDAMENTALS, QSE_TICKER_NAMES } from '../../../lib/stockData/qseSeed';

const FALLBACK: QSEStockData = { tickerNames: QSE_TICKER_NAMES, fundamentals: QSE_FUNDAMENTALS };

/** README item 1: reads ticker names + fundamentals from the shared
 * `stockData/QSE` Firebase node instead of hard-coded JS, falling back to
 * the bundled seed if Firebase isn't reachable yet. */
export function useQSEStockData(): QSEStockData {
  const [data, setData] = useState<QSEStockData>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    fetchQSEStockData().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
