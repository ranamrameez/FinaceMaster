// Shared constants + small helpers used by background.js, popup.js and
// options.js (all loaded as ES modules). content.js is a plain content
// script (no module imports allowed there), so it duplicates the tiny bit
// of selector-config-reading logic it needs instead of importing this file.

// Same Firebase project FinanceRecorder itself uses (webapp/src/lib/firebase/client.ts).
// This API key is not a secret — it only identifies the project; real access
// control lives in the Realtime Database security rules, same as the web app.
export const FIREBASE_API_KEY = 'AIzaSyCzg_KmLGNUXlIzqEAUJctG29kyJQruM8I';
export const RTDB_BASE_URL = 'https://qse-app-default-rtdb.asia-southeast1.firebasedatabase.app';
export const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';
export const SECURE_TOKEN_BASE = 'https://securetoken.googleapis.com/v1';

export const DEFAULT_TARGET_URL = 'https://webd.thegroup.com.qa/en/markets/qatar';

// Every ticker the scraper finds is synced — there is no allow-list. What IS
// throttled is how often we're willing to actually WRITE to Firebase RTDB:
// collection (scraping the page) happens on a short, randomized cadence
// since it's free/local, but a push to Firebase only happens once at least
// `minPushIntervalMinutes` have elapsed, PLUS a random extra delay on top
// (so the real gap between pushes is randomized between 1x and 2x the
// floor, never a perfectly predictable period) — this is both kinder to
// Firebase RTDB's write-rate limits and less bot-like as a request pattern
// against the brokerage's own page.
export const MIN_PUSH_INTERVAL_MINUTES_FLOOR = 2;
export const DEFAULT_MIN_PUSH_INTERVAL_MINUTES = 2;

// Collection (local scrape, no network write) cadence — randomized between
// these two bounds each cycle, not user-adjustable (see README: this is
// intentionally not exposed as a "make it faster" knob, since scraping the
// live brokerage page too aggressively risks being flagged as bot traffic
// regardless of whether anything gets pushed to Firebase yet).
export const COLLECT_MIN_SECONDS = 45;
export const COLLECT_MAX_SECONDS = 90;

export const STORAGE_KEYS = {
  AUTH: 'auth', // { idToken, refreshToken, uid, email, expiresAt }
  SCRAPE_CONFIG: 'scrapeConfig', // { targetUrl, rowSelector, tickerSelector, priceSelector, changeSelector, nameSelector }
  SYNC_CONFIG: 'syncConfig', // { minPushIntervalMinutes }
  STATUS: 'status', // { lastScrapeAt, lastScrapeCount, lastPushAt, lastPushCount, lastNamesCount, nextPushAt, lastError }
};

export const DEFAULT_SCRAPE_CONFIG = {
  targetUrl: DEFAULT_TARGET_URL,
  rowSelector: '',
  tickerSelector: '',
  priceSelector: '',
  changeSelector: '',
  nameSelector: '',
};

export const DEFAULT_SYNC_CONFIG = {
  minPushIntervalMinutes: DEFAULT_MIN_PUSH_INTERVAL_MINUTES,
};

export async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

export async function setStorage(obj) {
  return chrome.storage.local.set(obj);
}

export async function getAuth() {
  const { [STORAGE_KEYS.AUTH]: auth } = await getStorage(STORAGE_KEYS.AUTH);
  return auth || null;
}

export async function setAuth(auth) {
  await setStorage({ [STORAGE_KEYS.AUTH]: auth });
}

export async function clearAuth() {
  await chrome.storage.local.remove(STORAGE_KEYS.AUTH);
}

export async function getScrapeConfig() {
  const { [STORAGE_KEYS.SCRAPE_CONFIG]: cfg } = await getStorage(STORAGE_KEYS.SCRAPE_CONFIG);
  return { ...DEFAULT_SCRAPE_CONFIG, ...(cfg || {}) };
}

export async function setScrapeConfig(patch) {
  const current = await getScrapeConfig();
  await setStorage({ [STORAGE_KEYS.SCRAPE_CONFIG]: { ...current, ...patch } });
}

export async function getSyncConfig() {
  const { [STORAGE_KEYS.SYNC_CONFIG]: cfg } = await getStorage(STORAGE_KEYS.SYNC_CONFIG);
  const merged = { ...DEFAULT_SYNC_CONFIG, ...(cfg || {}) };
  merged.minPushIntervalMinutes = Math.max(MIN_PUSH_INTERVAL_MINUTES_FLOOR, Number(merged.minPushIntervalMinutes) || DEFAULT_MIN_PUSH_INTERVAL_MINUTES);
  return merged;
}

export async function setSyncConfig(patch) {
  const current = await getSyncConfig();
  const next = { ...current, ...patch };
  next.minPushIntervalMinutes = Math.max(MIN_PUSH_INTERVAL_MINUTES_FLOOR, Number(next.minPushIntervalMinutes) || DEFAULT_MIN_PUSH_INTERVAL_MINUTES);
  await setStorage({ [STORAGE_KEYS.SYNC_CONFIG]: next });
  return next;
}

// Prices AND ticker names are written to the SAME shared `stockData/QSE`
// node the FinanceRecorder web app already reads for ticker names/
// fundamentals (webapp/src/lib/stockData/reader.ts) — not into any one
// user's own `users/{uid}/workbook`. This is a deliberate choice: a price
// or name scraped by one signed-in user is useful to every FinanceRecorder
// user, not just the person running the extension, and it matches this
// app's own locked architecture decision (see webapp's CLAUDE.md "Design
// decisions": no live market-data API calls from the app itself — fetch on
// a schedule into our own database, serve every read from that local
// store). Writing still requires SOME authenticated Firebase user (RTDB
// rules should gate writes on `auth != null`, not on being any particular
// uid) — see README.md for the exact security-rule change this needs,
// which only the project owner can apply via the Firebase console.
//
// The web app's bundled `qseSeed.ts` only hard-codes ~36 of QSE's ~50+
// listed tickers (a stale, incomplete one-time seed — see that file's own
// comment). Since this extension's content script already scrapes every
// row of the market-watch page for a price, capturing that same row's
// company-name cell and pushing it to `tickerNames/{ticker}` here is how
// the app's actual ticker coverage gets filled in for real, from data the
// bundled seed never had — see README.md.
//
// NOTE: the web app does not yet read `prices`/`priceHistory` from this
// node to resolve a stock's "current price" — today it only reads
// `tickerNames`/`fundamentals` from here. Wiring the app's own price
// resolution to prefer this shared feed is a separate, follow-up change to
// the live app (real blast radius: every QSE holding's displayed price,
// break-even, P/L) and hasn't been made — see README.md.
export function priceCachePath(ticker) {
  return `stockData/QSE/prices/${encodeURIComponent(ticker)}`;
}

export function priceHistoryPath(ticker) {
  return `stockData/QSE/priceHistory/${encodeURIComponent(ticker)}`;
}

export function tickerNamePath(ticker) {
  return `stockData/QSE/tickerNames/${encodeURIComponent(ticker)}`;
}

export const SHARED_LAST_UPDATED_PATH = 'stockData/QSE/pricesUpdatedAt';

export async function getStatus() {
  const { [STORAGE_KEYS.STATUS]: status } = await getStorage(STORAGE_KEYS.STATUS);
  return status || {};
}

export async function patchStatus(patch) {
  const current = await getStatus();
  const next = { ...current, ...patch };
  await setStorage({ [STORAGE_KEYS.STATUS]: next });
  return next;
}

/** Random integer in [min, max], inclusive on both ends. */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
