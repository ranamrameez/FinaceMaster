import type { PricePoint, PriceStats, Transaction } from '../../types/workbook';

/** Returns the manually-set market price for a ticker, falling back to the
 * most recent BUY price on record. Ported from the legacy `getMarketPrice()`. */
export function getMarketPrice(
  ticker: string,
  marketPrices: Record<string, number>,
  transactions: Transaction[],
): number {
  if (marketPrices[ticker] !== undefined && Number(marketPrices[ticker]) > 0) {
    return Number(marketPrices[ticker]);
  }
  const buys = (transactions || []).filter(
    (t) => t.ticker.toUpperCase() === ticker.toUpperCase() && t.action === 'BUY' && Number(t.price) > 0,
  );
  if (buys.length) {
    buys.sort((a, b) => a.date.localeCompare(b.date));
    return Number(buys[buys.length - 1].price);
  }
  return 0;
}

export function getPriceHistory(ticker: string, priceHistory: Record<string, PricePoint[]>): PricePoint[] {
  return priceHistory[ticker] || [];
}

/** Collapses the raw (append-only) price log to one point per calendar day
 * — that day's last entry wins. */
export function getDailyPriceHistory(ticker: string, priceHistory: Record<string, PricePoint[]>): PricePoint[] {
  const raw = getPriceHistory(ticker, priceHistory);
  const byDay: Record<string, number> = {};
  const order: string[] = [];
  raw.forEach((h) => {
    if (!(h.date in byDay)) order.push(h.date);
    byDay[h.date] = h.price;
  });
  return order.map((date) => ({ date, price: byDay[date] }));
}

/** Lowest / median / highest across every daily price on record for a
 * ticker — "is this cheap or expensive relative to its own recent range."
 * Ported 1:1 from the legacy `computePriceStats()`. */
export function computePriceStats(ticker: string, priceHistory: Record<string, PricePoint[]>): PriceStats | null {
  const raw = getPriceHistory(ticker, priceHistory);
  const daily = getDailyPriceHistory(ticker, priceHistory);
  if (!daily.length) return null;

  const sorted = [...daily].sort((a, b) => a.price - b.price);
  const mid =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1].price + sorted[sorted.length / 2].price) / 2
      : sorted[(sorted.length - 1) / 2].price;
  const minEntry = sorted[0];
  const maxEntry = sorted[sorted.length - 1];

  return {
    min: minEntry.price,
    minDate: minEntry.date,
    max: maxEntry.price,
    maxDate: maxEntry.date,
    median: mid,
    count: daily.length,
    totalUpdates: raw.length,
    recent: [...raw].sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date)).slice(-8).reverse(),
    chronological: [...daily].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
