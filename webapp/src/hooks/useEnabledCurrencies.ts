import { useMemo } from 'react';
import { CURRENCIES } from '../lib/currencies';
import { useEnabledCurrenciesStore } from '../store/enabledCurrenciesStore';

/** The currency list a `<select>`/chip-picker should actually render — the
 * user's own chosen subset (Account page, "App setting should let the user
 * choose his currencies... rather [than] scrolling through a list") when
 * configured, falling back to the full `CURRENCIES` list when nothing's
 * been set (zero-migration: an existing user sees no change until they
 * opt in).
 *
 * User-requested currency-tier design (2026-09-16, walked through three
 * real cases — a single-currency UK user, a dual-currency UAE/Philippines
 * migrant, a triple-currency KSA/Pakistan/US trader): `enabledCodes`' own
 * ARRAY ORDER *is* the ranking — index 0 is Primary, index 1 Secondary,
 * the rest Other — no separate tier field, since the user already
 * expresses rank by the order they pick/reorder currencies in on the
 * Account page. This function used to re-sort the enabled subset back
 * into `CURRENCIES`' own fixed catalog order, which silently discarded
 * that ranking — now it preserves `enabledCodes`' order exactly, so
 * `options[0]` is always Primary and callers (e.g. `CurrencyChips`) can
 * split the list into prominent-vs-collapsed tiers.
 *
 * `currentValue` (the `<select>`'s own current/existing value, e.g. an
 * already-saved entity's `currencyCode`) is ALWAYS included in the result
 * even if it fell outside the chosen subset — never hide a currency the
 * user's own real data already uses, even if they forgot to check it or
 * it's simply not in `CURRENCIES` at all (a currency a real broker/bank
 * statement used that isn't in this app's own short list). Appended at
 * the end (lowest priority), matching where a freshly-enabled currency
 * already lands via `toggle()`. */
export function useEnabledCurrencies(currentValue?: string): { code: string; symbol: string }[] {
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  return useMemo(() => {
    const base = enabledCodes
      ? enabledCodes.map((code) => CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code + ' ' })
      : [...CURRENCIES];
    if (currentValue && !base.some((c) => c.code === currentValue)) {
      const existing = CURRENCIES.find((c) => c.code === currentValue);
      return [...base, existing ?? { code: currentValue, symbol: currentValue + ' ' }];
    }
    return base;
  }, [enabledCodes, currentValue]);
}
