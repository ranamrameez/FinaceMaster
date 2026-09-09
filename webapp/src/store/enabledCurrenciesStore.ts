import { create } from 'zustand';
import { CURRENCIES } from '../lib/currencies';

const STORAGE_KEY = 'financerecorder_enabled_currencies_v1';

/** User-requested (2026-09-08): "App setting should let the user choose his
 * currencies. and rest of the app use only those... this app supports
 * multiple currencies but not all users are multi-currency!" A global,
 * non-financial preference (same "own localStorage key, not part of any
 * module's workbook" shape as `appearanceStore`) — this is a UI convenience
 * (which currencies clutter a picker), not financial data, so it doesn't
 * belong in any per-module workbook or sync to Firebase.
 *
 * `null` (the default — no real user has ever set this) means "not
 * configured, show every currency" — the zero-migration case. An empty
 * array is deliberately distinct from `null` and never persisted (see
 * `toggle` below) — `useEnabledCurrencies()` would otherwise have nothing
 * to fall back to for an existing user's own real data. */
export type EnabledCurrencies = string[] | null;

function load(): EnabledCurrencies {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore, fall through to "not configured" */
  }
  return null;
}

function persist(codes: EnabledCurrencies) {
  try {
    if (codes === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch (e) {
    console.warn('Failed to save enabled-currencies preference', e);
  }
}

interface EnabledCurrenciesState {
  enabledCodes: EnabledCurrencies;
  setEnabledCodes: (codes: EnabledCurrencies) => void;
  /** Flips one currency's membership. Toggling off the LAST remaining
   * currency is a no-op (returns false) rather than persisting an empty
   * subset — the Account-page UI surfaces this as a toast instead of
   * letting the picker end up with nothing checked. */
  toggle: (code: string) => boolean;
}

export const useEnabledCurrenciesStore = create<EnabledCurrenciesState>((set, get) => ({
  enabledCodes: load(),

  setEnabledCodes: (codes) => {
    set({ enabledCodes: codes });
    persist(codes);
  },

  toggle: (code) => {
    // Toggling from "not configured" (null, meaning "everything checked")
    // starts the subset as every known code, then applies this one flip —
    // matches what the user visually sees (every chip already active).
    const base = get().enabledCodes ?? CURRENCIES.map((c) => c.code);
    const next = base.includes(code) ? base.filter((c) => c !== code) : [...base, code];
    if (!next.length) return false;
    get().setEnabledCodes(next);
    return true;
  },
}));
