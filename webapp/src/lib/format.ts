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
 * significant digits instead — 2.155 and 21.55 both carry 4 sig figs. */
export function fmtPrice(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  if (n === 0) return '0.000';
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const decimals = Math.max(0, 4 - magnitude - 1);
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
