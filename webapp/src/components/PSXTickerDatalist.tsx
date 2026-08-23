import { useMemo } from 'react';
import { usePSXStockData } from '../features/psx/hooks/usePSXStockData';
import { usePSXWorkbookStore } from '../store/psxWorkbookStore';

export const PSX_TICKER_DATALIST_ID = 'psx-ticker-suggestions';

/** PSX's equivalent of TickerDatalist — see that component for the
 * rationale (autocomplete over known tickers plus anything already used in
 * this workbook). */
export function PSXTickerDatalist() {
  const { tickerNames } = usePSXStockData();
  const workbook = usePSXWorkbookStore((s) => s.workbook);

  const symbols = useMemo(() => {
    const set = new Set<string>(Object.keys(tickerNames));
    (workbook.transactions || []).forEach((t) => set.add(t.ticker));
    (workbook.watchlist || []).forEach((w) => set.add(w.ticker));
    return [...set].sort();
  }, [tickerNames, workbook.transactions, workbook.watchlist]);

  return (
    <datalist id={PSX_TICKER_DATALIST_ID}>
      {symbols.map((sym) => (
        <option key={sym} value={sym} label={tickerNames[sym] || ''} />
      ))}
    </datalist>
  );
}
