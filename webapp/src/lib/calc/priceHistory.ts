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
    // `seq` (see `Transaction.seq`'s doc comment) breaks a same-date tie by
    // real entry order, not array position.
    buys.sort((a, b) => a.date.localeCompare(b.date) || (a.seq ?? 0) - (b.seq ?? 0));
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

/** Lowest / median / highest, and the trend line, across every price
 * update on record for a ticker — "is this cheap or expensive relative to
 * its own recent range." **Computed from the raw (per-update) log, not
 * the day-collapsed one** — a real bug (2026-08-24): a user updating a
 * price several times over one trading day had every stat here silently
 * collapse to that day's *last* update only, since `getDailyPriceHistory`
 * keeps just one point per calendar day. Lowest/median/highest all showed
 * the identical value, and the trend chart plotted a single flat point —
 * both read as "the graph isn't picking up today's prices" even though
 * every update really was recorded (visible in `recent`, which was
 * already raw-based). Sorting by real timestamp (falling back to date
 * when `time` is absent — old data recorded before `time` was tracked)
 * means a ticker updated many times in one day now shows genuine
 * intraday movement, while a ticker updated once a day still renders
 * exactly as before (raw and daily are identical in that case). */
export function computePriceStats(ticker: string, priceHistory: Record<string, PricePoint[]>): PriceStats | null {
  const raw = getPriceHistory(ticker, priceHistory);
  const daily = getDailyPriceHistory(ticker, priceHistory);
  if (!raw.length) return null;

  const chronological = [...raw].sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date));
  const sorted = [...raw].sort((a, b) => a.price - b.price);
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
    recent: [...chronological].slice(-8).reverse(),
    chronological,
  };
}
