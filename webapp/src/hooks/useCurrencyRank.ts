import { useEnabledCurrenciesStore } from '../store/enabledCurrenciesStore';

/** "Ordering in currency-grouped displays" — one of the three controls the
 * user confirmed for the 2026-09-16 Primary/Secondary/Other currency-tier
 * design (see `useEnabledCurrencies`'s own doc comment for the full
 * reasoning and the three real cases it was designed against). Returns a
 * comparator for `Array.prototype.sort` that orders currency codes by the
 * user's own ranked `enabledCodes` (index 0 = Primary, 1 = Secondary, the
 * rest Other). A currency outside the ranked set — or every currency, when
 * nothing's been ranked at all — sorts after every ranked one, keeping its
 * own relative order (a stable no-op for an unconfigured account). */
export function useCurrencyRankComparator(): (a: string, b: string) => number {
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  return (a: string, b: string) => {
    const ra = enabledCodes ? enabledCodes.indexOf(a) : -1;
    const rb = enabledCodes ? enabledCodes.indexOf(b) : -1;
    const ia = ra === -1 ? Infinity : ra;
    const ib = rb === -1 ? Infinity : rb;
    return ia - ib;
  };
}
