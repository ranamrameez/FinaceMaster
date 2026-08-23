import { useEffect, useState } from 'react';
import { useAuthState } from '../../../lib/firebase/useAuthState';
import { fetchQSEStockData, type QSEStockData } from '../../../lib/stockData/reader';
import { QSE_FUNDAMENTALS, QSE_TICKER_NAMES } from '../../../lib/stockData/qseSeed';

const FALLBACK: QSEStockData = { tickerNames: QSE_TICKER_NAMES, fundamentals: QSE_FUNDAMENTALS };

/** README item 1: reads ticker names + fundamentals from the shared
 * `stockData/QSE` Firebase node instead of hard-coded JS, falling back to
 * the bundled seed if Firebase isn't reachable yet.
 *
 * Only attempted once signed in: `stockData/QSE` isn't publicly readable
 * yet, so a signed-out visitor's read is a guaranteed permission-denied —
 * the Firebase SDK logs that to the console itself before our catch runs,
 * which isn't something app code can suppress. Skipping the attempt for
 * the common signed-out/browsing case avoids that noise entirely. */
export function useQSEStockData(): QSEStockData {
  const [data, setData] = useState<QSEStockData>(FALLBACK);
  const { user, authResolved } = useAuthState();
  useEffect(() => {
    if (!authResolved || !user) return;
    let cancelled = false;
    fetchQSEStockData().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [authResolved, user]);
  return data;
}
