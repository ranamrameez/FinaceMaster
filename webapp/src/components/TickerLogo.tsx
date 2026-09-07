import { useState } from 'react';
import { tickerColor } from '../lib/cssVar';

/** User-reported (2026-09-07): "QSE few logos are present in root repo but
 * not utilized in the new webapp, old index is using very good mechanism,
 * find logo in our repo, otherwise find it through the template URL
 * otherwise Text-tag type symbol." Investigated first, not guessed at: no
 * `logos/` folder actually exists anywhere in this repo's git history (a
 * whole-history `git log` search for `logos/*` came back empty) — so
 * "present in root repo" was the user's own memory of the LEGACY app's
 * mechanism (`index.html`'s `tickerLogo()`/`logoFallback()`), which this
 * component ports as-is, not a real local asset that got missed. The CSS
 * (`.ticker-logo`/`.ticker-logo-fallback` in `theme.css`) was already
 * copied over from the legacy app at some point, but nothing in the React
 * codebase ever actually used it — this is that missing piece.
 *
 * Exact 3-stage fallback chain, same priority order the user asked for:
 * 1. **Local repo logo** — `{BASE_URL}logos/{TICKER}.svg`. Nothing ships
 *    there today (same as the legacy app — its own `./logos/` folder was
 *    never committed either), but dropping SVGs into `webapp/public/logos/`
 *    (named `TICKER.svg`) makes them pick up automatically, no code change
 *    needed — matches the legacy app's own "drop your own logos here" design.
 * 2. **Template URL** — QSE only. The legacy app's own broker logo CDN
 *    (`https://webd.thegroup.com.qa/logos/{TICKER}.svg`), proxied through
 *    `wsrv.nl` (which fetches server-side and re-serves with permissive
 *    CORS/CORP headers — hotlinking the broker URL directly fails in-browser
 *    without this, per the legacy app's own comment). PSX has no known
 *    public logo CDN (same conclusion the legacy `PSX_Trade_Planner.html`
 *    already reached), so a PSX ticker skips straight from local to the
 *    text-tag fallback.
 * 3. **Text-tag fallback** — a small colored-initials badge (first 2
 *    letters of the ticker), deterministic color via the SAME `tickerColor()`
 *    this app's charts already use (not the legacy app's own separate
 *    palette) — a ticker's fallback badge matches its chart color elsewhere
 *    in the app, a small but free consistency win from reusing what's
 *    already here instead of reintroducing a second palette.
 *
 * A single `<img>` element (not remounted between stages) so an `onError`
 * on stage 1 just updates `src` and re-triggers loading, same as the
 * legacy app's own `img.src = ...` reassignment — `stage`, not `key`, is
 * what changes. */

type Stage = 'local' | 'remote' | 'fallback';

const QSE_LOGO_CDN = 'https://webd.thegroup.com.qa/logos/';
const WSRV_PROXY = 'https://wsrv.nl/?url=';

export function TickerLogo({
  ticker,
  size = 'md',
  exchange = 'qse',
  className = '',
}: {
  ticker: string;
  size?: 'sm' | 'md' | 'lg';
  exchange?: 'qse' | 'psx';
  className?: string;
}) {
  const symbol = String(ticker || '').toUpperCase();
  const [stage, setStage] = useState<Stage>('local');
  if (!symbol) return null;

  const sizeClass = size === 'lg' ? ' lg' : size === 'sm' ? ' sm' : '';
  const cls = `${className ? className + ' ' : ''}${sizeClass}`.trim();

  if (stage === 'fallback') {
    return (
      <span
        className={`ticker-logo ticker-logo-fallback${cls ? ' ' + cls : ''}`}
        aria-label={symbol}
        style={{ '--ticker-accent': tickerColor(symbol) } as React.CSSProperties}
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  const local = `${import.meta.env.BASE_URL}logos/${encodeURIComponent(symbol)}.svg`;
  const remote = `${WSRV_PROXY}${encodeURIComponent(`${QSE_LOGO_CDN}${encodeURIComponent(symbol)}.svg`)}`;
  const src = stage === 'local' ? local : remote;

  return (
    <img
      className={`ticker-logo${cls ? ' ' + cls : ''}`}
      src={src}
      alt={symbol}
      loading="lazy"
      onError={() => setStage((s) => (s === 'local' && exchange === 'qse' ? 'remote' : 'fallback'))}
    />
  );
}
