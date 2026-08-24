import { fmt, fmtCompact, fmtMoney, fmtMoneyCompact } from '../lib/format';
import { useAppearanceStore } from '../store/appearanceStore';

/** User-requested (Appearance): a way to see raw, un-abbreviated numbers
 * everywhere instead of the compact "10k"/"1.23M" form stat cards default
 * to (README item 56). One hook, read from the global appearance
 * preference, so every call site that currently hardcodes
 * `fmtMoneyCompact`/`fmtCompact` switches with a single setting instead of
 * needing its own toggle. `raw` money values skip the compact form's
 * "full precision in a hover tooltip" trick entirely, since the visible
 * text already IS the full precision. */
export function useAmountFormat() {
  const raw = useAppearanceStore((s) => s.appearance.numberDisplay) === 'raw';
  return {
    raw,
    /** Money with currency code — compact ("12.35M PKR") or full
     * ("12,345,678.90 PKR") depending on the user's preference. */
    money: (n: number, currency: string): string => (raw ? fmtMoney(n, currency) : fmtMoneyCompact(n, currency)),
    /** A plain number, no currency — compact ("1.2k") or full ("1,200"). */
    num: (n: number | undefined | null, dec = 0): string => (raw ? fmt(n, dec) : fmtCompact(n, dec)),
  };
}
