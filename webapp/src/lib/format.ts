export function fmt(n: number | undefined | null, dec = 3): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtMoney(n: number, currency: string): string {
  return `${fmt(n, 2)} ${currency}`;
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
