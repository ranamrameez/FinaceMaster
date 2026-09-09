import { useMemo } from 'react';
import { CURRENCIES } from '../lib/currencies';
import { useEnabledCurrenciesStore } from '../store/enabledCurrenciesStore';

/** The currency list a `<select>` should actually render — the user's own
 * chosen subset (Account page, "App setting should let the user choose his
 * currencies... rather [than] scrolling through a list") when configured,
 * falling back to the full `CURRENCIES` list when nothing's been set
 * (zero-migration: an existing user sees no change until they opt in).
 *
 * `currentValue` (the `<select>`'s own current/existing value, e.g. an
 * already-saved entity's `currencyCode`) is ALWAYS included in the result
 * even if it fell outside the chosen subset — never hide a currency the
 * user's own real data already uses, even if they forgot to check it or
 * it's simply not in `CURRENCIES` at all (a currency a real broker/bank
 * statement used that isn't in this app's own short list). */
export function useEnabledCurrencies(currentValue?: string): { code: string; symbol: string }[] {
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  return useMemo(() => {
    const base = enabledCodes ? CURRENCIES.filter((c) => enabledCodes.includes(c.code)) : [...CURRENCIES];
    if (currentValue && !base.some((c) => c.code === currentValue)) {
      const existing = CURRENCIES.find((c) => c.code === currentValue);
      return [...base, existing ?? { code: currentValue, symbol: currentValue + ' ' }];
    }
    return base;
  }, [enabledCodes, currentValue]);
}
