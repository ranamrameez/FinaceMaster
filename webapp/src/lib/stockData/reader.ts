import { get, ref, set } from 'firebase/database';
import { db } from '../firebase/client';
import { QSE_FUNDAMENTALS, QSE_TICKER_NAMES, type FundamentalsEntry } from './qseSeed';

const STOCK_DATA_PATH = 'stockData/QSE';

export interface QSEStockData {
  tickerNames: Record<string, string>;
  fundamentals: Record<string, FundamentalsEntry>;
}

/** Reads the shared/public QSE stock-data node. Falls back to the bundled
 * seed values if Firebase isn't reachable or the node hasn't been seeded
 * yet, so the app is never empty on first load.
 *
 * `tickerNames`/`fundamentals` each MERGE with the bundled seed (Firebase
 * wins per-key on overlap) rather than an all-or-nothing pair, and rather
 * than either source replacing the other outright. Two reasons: (1) a
 * `thegroup-price-sync` Chrome extension (see its own README) writes real
 * scraped ticker names into this node continuously, but has no way to
 * populate `fundamentals` (profit/EPS/etc, which needs a financial
 * disclosure, not a market-watch page) — requiring both fields to be
 * present, as this used to, meant a real, live `tickerNames` from Firebase
 * was silently thrown away just because `fundamentals` hadn't been seeded
 * yet. (2) Early on, or if a scrape only captures a handful of names in
 * one cycle, Firebase's own `tickerNames` can legitimately have FEWER
 * entries than the bundled seed — replacing outright (instead of merging)
 * would make the app's ticker coverage briefly get WORSE while the
 * extension is still filling in, not just slow to improve. */
export async function fetchQSEStockData(): Promise<QSEStockData> {
  if (!db) return { tickerNames: QSE_TICKER_NAMES, fundamentals: QSE_FUNDAMENTALS };
  try {
    const snap = await get(ref(db, STOCK_DATA_PATH));
    const val = snap.val();
    return {
      tickerNames: { ...QSE_TICKER_NAMES, ...(val?.tickerNames || {}) },
      fundamentals: { ...QSE_FUNDAMENTALS, ...(val?.fundamentals || {}) },
    };
  } catch (e) {
    console.warn('Failed to read shared QSE stock data from Firebase, using bundled seed.', e);
  }
  return { tickerNames: QSE_TICKER_NAMES, fundamentals: QSE_FUNDAMENTALS };
}

/** Writes the bundled seed values into the shared node. Run this once
 * (e.g. from the browser console via a debug hook) to populate
 * `stockData/QSE` in Firebase; not called automatically by the app. */
export async function seedQSEStockData(): Promise<void> {
  if (!db) throw new Error('Firebase is not initialized');
  await set(ref(db, STOCK_DATA_PATH), {
    tickerNames: QSE_TICKER_NAMES,
    fundamentals: QSE_FUNDAMENTALS,
  });
}
