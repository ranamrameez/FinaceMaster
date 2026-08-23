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
 * yet, so the app is never empty on first load. */
export async function fetchQSEStockData(): Promise<QSEStockData> {
  if (!db) return { tickerNames: QSE_TICKER_NAMES, fundamentals: QSE_FUNDAMENTALS };
  try {
    const snap = await get(ref(db, STOCK_DATA_PATH));
    const val = snap.val();
    if (val && val.tickerNames && val.fundamentals) {
      return { tickerNames: val.tickerNames, fundamentals: val.fundamentals };
    }
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
