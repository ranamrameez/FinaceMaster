export function fmt(n: number | undefined | null, dec = 3): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtMoney(n: number, currency: string): string {
  return `${fmt(n, 2)} ${currency}`;
}

/** Abbreviates a large magnitude (1,234,567 -> "1.23M") for compact display
 * in stat cards — full precision is still available separately (callers
 * pass the un-abbreviated `fmt`/`fmtMoney` string as a tooltip). Below
 * 1,000 this is identical to `fmt` (abbreviating "842" to anything shorter
 * isn't useful and would just look inconsistent next to prices that don't
 * abbreviate). Negative numbers abbreviate the same way, sign preserved. */
export function fmtCompact(n: number | undefined | null, dec = 2): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return fmt(n, 0);
  const sign = n < 0 ? '-' : '';
  const units: [number, string][] = [
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'k'],
  ];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      return `${sign}${scaled.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec })}${suffix}`;
    }
  }
  return fmt(n, 0);
}

export function fmtMoneyCompact(n: number, currency: string): string {
  return `${fmtCompact(n)} ${currency}`;
}

/** README item 3: QSE prices span a wide range (e.g. ~1-3 for some tickers,
 * ~20+ for others) and a fixed decimal count either truncates precision on
 * low-priced tickers or pads noise on high-priced ones. This formats to 4
 * significant digits, with a floor of 2 decimals — 2.155 and 21.55 both
 * carry 4 sig figs, and very small prices (e.g. 0.0025) still get extra
 * decimals to stay legible. The floor matters: a plain 4-sig-fig rule alone
 * rounds AWAY real precision the user actually entered once the price
 * clears 3 digits (123.456 -> "123.5", one decimal; 1234.5 -> "1235", zero)
 * — a real user-reported regression, since a manually-entered buy price
 * should never look less precise on screen than what was typed. Flooring
 * at 2 keeps that from happening for the vast majority of real prices. */
export function fmtPrice(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  if (n === 0) return '0.000';
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const decimals = Math.max(2, 4 - magnitude - 1);
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
