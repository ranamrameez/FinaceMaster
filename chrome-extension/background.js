// Background service worker: owns the collect → (throttled, randomized)
// push loop, Firebase Auth (email/password, via plain REST calls — no SDK
// bundling needed in an MV3 service worker), and the safe read-modify-write
// against the shared `stockData/QSE` RTDB node. The popup and options pages
// talk to this file only via chrome.runtime messages; they never touch
// Firebase or chrome.alarms directly.

import {
  FIREBASE_API_KEY,
  RTDB_BASE_URL,
  IDENTITY_TOOLKIT_BASE,
  SECURE_TOKEN_BASE,
  COLLECT_MIN_SECONDS,
  COLLECT_MAX_SECONDS,
  priceCachePath,
  priceHistoryPath,
  tickerNamePath,
  SHARED_LAST_UPDATED_PATH,
  getAuth,
  setAuth,
  clearAuth,
  getScrapeConfig,
  getSyncConfig,
  patchStatus,
  getStatus,
  randInt,
} from './common.js';

const COLLECT_ALARM = 'collect-tick';

// ---------- Auth (Firebase Identity Toolkit REST, no SDK needed) ----------

function normalizeAuthResponse(json, fallbackEmail) {
  const idToken = json.idToken || json.id_token;
  const refreshToken = json.refreshToken || json.refresh_token;
  const uid = json.localId || json.user_id;
  const expiresInSec = Number(json.expiresIn || json.expires_in || 3600);
  return {
    idToken,
    refreshToken,
    uid,
    email: json.email || fallbackEmail || null,
    // Refresh a minute early rather than racing an exact expiry.
    expiresAt: Date.now() + Math.max(60, expiresInSec - 60) * 1000,
  };
}

async function signInWithPassword(email, password) {
  const res = await fetch(`${IDENTITY_TOOLKIT_BASE}/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Sign-in failed (${res.status})`;
    throw new Error(friendlyAuthError(msg));
  }
  const auth = normalizeAuthResponse(json, email);
  await setAuth(auth);
  return auth;
}

async function signUpWithPassword(email, password) {
  const res = await fetch(`${IDENTITY_TOOLKIT_BASE}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Sign-up failed (${res.status})`;
    throw new Error(friendlyAuthError(msg));
  }
  const auth = normalizeAuthResponse(json, email);
  await setAuth(auth);
  return auth;
}

function friendlyAuthError(code) {
  const map = {
    EMAIL_NOT_FOUND: 'No account with that email.',
    INVALID_PASSWORD: 'Wrong password.',
    INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.',
    USER_DISABLED: 'This account has been disabled.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts — try again in a bit.',
    EMAIL_EXISTS: 'An account with that email already exists — sign in instead.',
    INVALID_EMAIL: 'That email address looks invalid.',
  };
  if (map[code]) return map[code];
  if (typeof code === 'string' && code.startsWith('WEAK_PASSWORD')) return 'Password must be at least 6 characters.';
  return code;
}

async function refreshAuth(auth) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refreshToken });
  const res = await fetch(`${SECURE_TOKEN_BASE}/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    // Refresh token itself is no longer valid — the user needs to sign in again.
    await clearAuth();
    throw new Error('Signed out (token expired) — sign in again from the popup.');
  }
  const next = normalizeAuthResponse(json, auth.email);
  await setAuth(next);
  return next;
}

/** Returns a currently-valid idToken, refreshing first if it's near expiry.
 * Returns null if never signed in; throws if refresh itself fails (caller
 * should surface that as a "please sign in again" state). */
async function getFreshAuth() {
  const auth = await getAuth();
  if (!auth) return null;
  if (Date.now() < auth.expiresAt) return auth;
  return refreshAuth(auth);
}

// ---------- RTDB REST helpers ----------

async function putScalar(path, value, idToken) {
  const res = await fetch(`${RTDB_BASE_URL}/${path}.json?auth=${idToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`RTDB write failed for ${path}: ${res.status}`);
}

/** Safe read-modify-write of a shared array using RTDB's conditional-write
 * support (an ETag from a GET, sent back as `if-match` on the PUT) so two
 * concurrent writers (e.g. two people each running this extension) can't
 * silently clobber each other's append — one gets a 412 and retries against
 * the now-current value instead. Retries once; on a second conflict it just
 * skips this ticker for this cycle rather than looping forever, since the
 * next scheduled push will pick it up anyway. */
async function appendHistoryPointSafely(ticker, point, idToken) {
  const url = `${RTDB_BASE_URL}/${priceHistoryPath(ticker)}.json?auth=${idToken}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const getRes = await fetch(url, { headers: { 'X-Firebase-ETag': 'true' } });
    if (!getRes.ok) throw new Error(`RTDB read failed for ${ticker} history: ${getRes.status}`);
    const etag = getRes.headers.get('ETag');
    const current = (await getRes.json()) || [];
    const last = current[current.length - 1];
    // Skip appending an identical consecutive price (e.g. no change since
    // the last push) so the array doesn't grow forever on a quiet ticker.
    if (last && last.price === point.price) return { appended: false };
    const next = [...current, point];
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'if-match': etag },
      body: JSON.stringify(next),
    });
    if (putRes.ok) return { appended: true };
    if (putRes.status !== 412) throw new Error(`RTDB write failed for ${ticker} history: ${putRes.status}`);
    // 412 Precondition Failed — someone else wrote in between; retry once.
  }
  return { appended: false, conflicted: true };
}

async function pushRows(rows) {
  const auth = await getFreshAuth();
  if (!auth) throw new Error('Not signed in — open the popup and sign in to push scraped prices.');
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  let pushed = 0;
  let namesPushed = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await putScalar(priceCachePath(row.ticker), row.price, auth.idToken);
      await appendHistoryPointSafely(row.ticker, { date: today, time: nowIso, price: row.price }, auth.idToken);
      pushed++;
    } catch (e) {
      errors.push(`${row.ticker}: ${e.message || e}`);
    }
    // Ticker name is a best-effort extra on top of the price push above —
    // a name-write failure (or a row with no scraped name at all) never
    // blocks or fails the price push for that same ticker.
    const name = row.name && row.name.trim();
    if (name) {
      try {
        await putScalar(tickerNamePath(row.ticker), name, auth.idToken);
        namesPushed++;
      } catch (e) {
        errors.push(`${row.ticker} (name): ${e.message || e}`);
      }
    }
  }
  try {
    await putScalar(SHARED_LAST_UPDATED_PATH, nowIso, auth.idToken);
  } catch (e) {
    // Non-critical — the per-ticker writes already landed.
  }
  return { pushed, namesPushed, total: rows.length, errors };
}

// ---------- Scraping (delegates to the content script) ----------

async function findTargetTab(targetUrl) {
  let originPattern = 'https://webd.thegroup.com.qa/*';
  try {
    originPattern = `${new URL(targetUrl).origin}/*`;
  } catch (e) {
    // fall back to the default pattern above
  }
  const tabs = await chrome.tabs.query({ url: originPattern });
  if (!tabs.length) return null;
  const exact = tabs.find((t) => t.url && t.url.startsWith(targetUrl));
  return exact || tabs[0];
}

async function scrapeTab(tab, overrideConfig) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_NOW', config: overrideConfig }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from page' });
    });
  });
}

// ---------- The collect → throttled/randomized push cycle ----------

async function runCycle({ forcePush = false } = {}) {
  const scrapeConfig = await getScrapeConfig();
  const tab = await findTargetTab(scrapeConfig.targetUrl);
  if (!tab) {
    await patchStatus({ lastError: 'No matching tab open — open the market page for auto-refresh to work.' });
    scheduleNextCollect();
    return;
  }

  const result = await scrapeTab(tab);
  if (!result.ok) {
    await patchStatus({ lastError: `Scrape failed: ${result.error}` });
    scheduleNextCollect();
    return;
  }

  const rows = result.rows || [];
  await patchStatus({
    lastScrapeAt: Date.now(),
    lastScrapeCount: rows.length,
    lastStrategy: result.strategy,
    lastError: rows.length ? '' : 'Scraped 0 rows — the page layout may not match; tune selectors in Options.',
  });

  if (!rows.length) {
    scheduleNextCollect();
    return;
  }

  const status = await getStatus();
  const syncConfig = await getSyncConfig();
  const due = forcePush || !status.nextPushAt || Date.now() >= status.nextPushAt;

  if (due) {
    try {
      const { pushed, namesPushed, total, errors } = await pushRows(rows);
      const floorMs = syncConfig.minPushIntervalMinutes * 60000;
      // Randomized gap: between 1x and 2x the configured floor, re-rolled
      // fresh after every push — never a perfectly predictable period.
      const nextPushAt = Date.now() + floorMs + randInt(0, floorMs);
      await patchStatus({
        lastPushAt: Date.now(),
        lastPushCount: pushed,
        lastPushTotal: total,
        lastNamesCount: namesPushed,
        nextPushAt,
        lastError: errors.length ? `${errors.length} ticker(s) failed to push (see console).` : '',
      });
      if (errors.length) console.warn('[thegroup-price-sync] push errors:', errors);
    } catch (e) {
      await patchStatus({ lastError: e.message || String(e) });
    }
  }

  scheduleNextCollect();
}

function scheduleNextCollect() {
  const delaySec = randInt(COLLECT_MIN_SECONDS, COLLECT_MAX_SECONDS);
  chrome.alarms.create(COLLECT_ALARM, { when: Date.now() + delaySec * 1000 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === COLLECT_ALARM) runCycle();
});

chrome.runtime.onInstalled.addListener(() => scheduleNextCollect());
chrome.runtime.onStartup.addListener(() => scheduleNextCollect());

// ---------- Messages from popup.js / options.js ----------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case 'SIGN_IN': {
        try {
          const auth = await signInWithPassword(message.email, message.password);
          sendResponse({ ok: true, email: auth.email, uid: auth.uid });
        } catch (e) {
          sendResponse({ ok: false, error: e.message || String(e) });
        }
        break;
      }
      case 'SIGN_UP': {
        try {
          const auth = await signUpWithPassword(message.email, message.password);
          sendResponse({ ok: true, email: auth.email, uid: auth.uid });
        } catch (e) {
          sendResponse({ ok: false, error: e.message || String(e) });
        }
        break;
      }
      case 'SIGN_OUT': {
        await clearAuth();
        sendResponse({ ok: true });
        break;
      }
      case 'SCRAPE_NOW_MANUAL': {
        await runCycle({ forcePush: false });
        sendResponse({ ok: true });
        break;
      }
      case 'PUSH_NOW': {
        await runCycle({ forcePush: true });
        sendResponse({ ok: true });
        break;
      }
      case 'TEST_SCRAPE': {
        const scrapeConfig = await getScrapeConfig();
        const targetUrl = message.targetUrl || scrapeConfig.targetUrl;
        const tab = await findTargetTab(targetUrl);
        if (!tab) {
          sendResponse({ ok: false, error: 'No matching tab open. Open the market page first.' });
          break;
        }
        // Use the caller's draft selectors (possibly unsaved) rather than
        // whatever's currently saved, so Options' "Test scrape" reflects
        // in-progress edits immediately.
        const result = await scrapeTab(tab, message.config);
        sendResponse(result);
        break;
      }
      default:
        sendResponse({ ok: false, error: `Unknown message type: ${message?.type}` });
    }
  })();
  return true; // async response
});
