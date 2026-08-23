export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Deterministic per-ticker color, same idea as the legacy app's
 * tickerColor(): hashes the symbol into a fixed palette so a ticker always
 * gets the same color across charts/renders. */
const TICKER_PALETTE = [
  '#c9a35a', '#5aa9c9', '#7bc95a', '#c95a8f', '#8f5ac9',
  '#c9835a', '#5ac9a9', '#c9c15a', '#5a7bc9', '#c95a5a',
  '#5ac97b', '#a35ac9',
];

export function tickerColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return TICKER_PALETTE[hash % TICKER_PALETTE.length];
}
