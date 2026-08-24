/** FX rate cache for the Net Worth dashboard's currency conversion.
 *
 * Deliberately NOT a live per-page-load API call (the app's locked rule —
 * see CLAUDE.md's Design decisions) — rates are fetched at most once, cached
 * in localStorage with a timestamp, and reused until stale. If the fetch
 * ever fails (network error, the provider being unreachable, CORS), the app
 * falls back to whatever's already cached, or to the user typing a rate in
 * by hand — the user explicitly approved this "free API if it works,
 * otherwise manual" approach over paying for scheduled Cloud Functions.
 * Global preference, not per-account financial data, so it's plain
 * localStorage (same category as appearanceStore) rather than synced. */

export interface FxRates {
  /** All rates are expressed as 1 unit of `base` = rates[code] units of
   * that currency. */
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
  source: 'api' | 'manual';
}

const FX_CACHE_KEY = 'financerecorder_fx_rates_v1';
const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function loadCachedFxRates(): FxRates | null {
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.rates || typeof parsed.rates !== 'object') return null;
    return parsed as FxRates;
  } catch {
    return null;
  }
}

export function saveFxRates(rates: FxRates): void {
  try {
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
  } catch {
    /* ignore — a failed persist just means it re-fetches/re-asks next time */
  }
}

export function isFxStale(rates: FxRates | null, maxAgeMs: number = STALE_AFTER_MS): boolean {
  if (!rates) return true;
  const fetchedAt = Date.parse(rates.fetchedAt);
  if (Number.isNaN(fetchedAt)) return true;
  return Date.now() - fetchedAt > maxAgeMs;
}

/** Fetches fresh rates from a free, no-API-key provider. Throws on any
 * failure (network, non-2xx, unexpected shape) — callers decide how to
 * degrade (keep the stale cache, prompt for manual entry). */
export async function fetchFxRates(): Promise<FxRates> {
  const res = await fetch(FX_API_URL);
  if (!res.ok) throw new Error(`FX API responded ${res.status}`);
  const data = await res.json();
  if (data?.result !== 'success' || !data.rates || typeof data.rates !== 'object') {
    throw new Error('FX API returned an unexpected shape');
  }
  return { base: 'USD', rates: data.rates, fetchedAt: new Date().toISOString(), source: 'api' };
}

/** Converts an amount between two currency codes using a base-USD rate
 * table. Returns null (rather than a wrong number) when either currency's
 * rate isn't known — callers should show "no rate available", never guess. */
export function convertAmount(amount: number, from: string, to: string, rates: FxRates | null): number | null {
  if (from === to) return amount;
  if (!rates) return null;
  const fromRate = from === rates.base ? 1 : rates.rates[from];
  const toRate = to === rates.base ? 1 : rates.rates[to];
  if (typeof fromRate !== 'number' || typeof toRate !== 'number' || fromRate <= 0) return null;
  const amountInBase = amount / fromRate;
  return amountInBase * toRate;
}

export function setManualRate(code: string, unitsPerBase: number, existing: FxRates | null, base = 'USD'): FxRates {
  const next: FxRates = {
    base,
    rates: { ...(existing?.base === base ? existing.rates : {}), [code]: unitsPerBase, [base]: 1 },
    fetchedAt: new Date().toISOString(),
    source: 'manual',
  };
  return next;
}
