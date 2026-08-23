import { useMemo } from 'react';
import { useQSEStockData } from '../features/qse/hooks/useQSEStockData';
import { useWorkbookStore } from '../store/workbookStore';

export const QSE_TICKER_DATALIST_ID = 'qse-ticker-suggestions';

/** Populates a shared <datalist> for ticker autocomplete, same idea as the
 * legacy app's populateTickerDatalist(): known QSE tickers plus any ticker
 * already seen in this workbook (transactions/watchlist), so a typo'd or
 * new ticker the user already trades still autocompletes next time. */
export function TickerDatalist() {
  const { tickerNames } = useQSEStockData();
  const workbook = useWorkbookStore((s) => s.workbook);

  const symbols = useMemo(() => {
    const set = new Set<string>(Object.keys(tickerNames));
    workbook.transactions.forEach((t) => set.add(t.ticker));
    workbook.watchlist.forEach((w) => set.add(w.ticker));
    return [...set].sort();
  }, [tickerNames, workbook.transactions, workbook.watchlist]);

  return (
    <datalist id={QSE_TICKER_DATALIST_ID}>
      {symbols.map((sym) => (
        <option key={sym} value={sym} label={tickerNames[sym] || ''} />
      ))}
    </datalist>
  );
}
