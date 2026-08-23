import type { ChartFilter } from '../lib/calc/chartFilters';

/** README item 17: shared ticker + month-range filter controls for the
 * Analytics pages — exchange-agnostic (QSE and PSX each pass their own
 * ticker list and filter state; the component has no store access of its
 * own). See lib/calc/chartFilters.ts for why this only filters per-ticker
 * and per-month chart data rather than re-deriving portfolio state. */
export function ChartFilterBar({
  tickers,
  filter,
  onChange,
}: {
  tickers: string[];
  filter: ChartFilter;
  onChange: (filter: ChartFilter) => void;
}) {
  const toggleTicker = (t: string) => {
    const has = filter.tickers.includes(t);
    onChange({ ...filter, tickers: has ? filter.tickers.filter((x) => x !== t) : [...filter.tickers, t] });
  };

  return (
    <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="footer-note">Tickers:</span>
        <button
          type="button"
          className={`chip${filter.tickers.length === 0 ? ' active' : ''}`}
          onClick={() => onChange({ ...filter, tickers: [] })}
        >
          All
        </button>
        {tickers.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip${filter.tickers.includes(t) ? ' active' : ''}`}
            onClick={() => toggleTicker(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="footer-note">Months:</span>
        <input
          type="month"
          value={filter.fromMonth ?? ''}
          onChange={(e) => onChange({ ...filter, fromMonth: e.target.value || undefined })}
          aria-label="From month"
        />
        <span className="footer-note">to</span>
        <input
          type="month"
          value={filter.toMonth ?? ''}
          onChange={(e) => onChange({ ...filter, toMonth: e.target.value || undefined })}
          aria-label="To month"
        />
        {(filter.fromMonth || filter.toMonth) && (
          <button type="button" className="btn secondary small" onClick={() => onChange({ ...filter, fromMonth: undefined, toMonth: undefined })}>
            Clear
          </button>
        )}
      </div>
      <p className="footer-note" style={{ margin: 0, width: '100%' }}>
        Ticker/month filters apply to per-ticker and monthly charts below. Whole-portfolio totals (realized vs
        unrealized P/L, cash vs stocks, fees breakdown, deposits vs invested) always reflect your full history —
        they can't be meaningfully filtered to a ticker or date window without changing what "current holdings" means.
      </p>
    </div>
  );
}
