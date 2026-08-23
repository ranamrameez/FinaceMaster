import { useState } from 'react';

const STORAGE_PREFIX = 'financerecorder_last_currency_';

/** Remembers the last currency the user picked in a given add-form (keyed
 * per module, e.g. 'cash', 'bank-account', 'personalLoans') so the next
 * time they open that form it starts from what they actually used last,
 * not always the module's configured default currency — user feedback:
 * re-picking the same non-default currency every single time was
 * repetitive for anyone whose main currency isn't the module's default.
 * Falls back to `fallback` (typically the module's settings.defaultCurrency)
 * when nothing has been remembered yet, or when localStorage is
 * unavailable (private browsing, storage quota, ...) — this is a
 * convenience, not data that needs to survive at all costs. */
export function useLastCurrency(key: string, fallback: string): [string, (currency: string) => void] {
  const storageKey = STORAGE_PREFIX + key;
  const [currency, setCurrencyState] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || fallback;
    } catch {
      return fallback;
    }
  });

  const setCurrency = (next: string) => {
    setCurrencyState(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Best-effort — losing the remembered currency isn't worth surfacing.
    }
  };

  return [currency, setCurrency];
}
