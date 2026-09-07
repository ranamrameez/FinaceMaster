// Content script — runs on The Group's market-watch page. Reads whatever
// selector overrides are stored (set from the Options page's "Test scrape"
// tool), falling back to a generic heuristic scan when none are configured
// or the configured selectors match nothing. Never sends credentials or
// page content anywhere itself — it only replies to messages from this
// extension's own background service worker with the parsed rows.

const STORAGE_KEY = 'scrapeConfig';

/** A QSE ticker is 2-6 uppercase letters (occasionally digits appear on
 * some exchanges, so allow them too) — used by the heuristic fallback to
 * decide "does this cell look like a ticker symbol." */
const TICKER_LIKE = /^[A-Z][A-Z0-9]{1,5}$/;

/** A price cell: a plain decimal number, optionally with thousands
 * separators, optionally negative (for a change column, not price itself,
 * but the same parser is reused for both). */
const NUMBER_LIKE = /^-?[\d,]+(\.\d+)?$/;

function parseNumber(text) {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '').trim();
  if (!NUMBER_LIKE.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cellText(el) {
  return (el?.textContent || '').trim();
}

/** Configured-selector strategy: `rowSelector` picks each stock row;
 * `tickerSelector`/`priceSelector`/`changeSelector` are CSS selectors
 * evaluated RELATIVE to each row (via `row.querySelector`). Any of the
 * optional ones may be blank. */
function scrapeWithConfig(cfg) {
  if (!cfg.rowSelector || !cfg.tickerSelector || !cfg.priceSelector) return null;
  const rows = Array.from(document.querySelectorAll(cfg.rowSelector));
  if (!rows.length) return null;
  const out = [];
  for (const row of rows) {
    const tickerEl = row.querySelector(cfg.tickerSelector);
    const priceEl = row.querySelector(cfg.priceSelector);
    const changeEl = cfg.changeSelector ? row.querySelector(cfg.changeSelector) : null;
    const ticker = cellText(tickerEl).toUpperCase();
    const price = parseNumber(cellText(priceEl));
    if (!ticker || price === null) continue;
    out.push({ ticker, price, changePct: changeEl ? parseNumber(cellText(changeEl)) : null });
  }
  return out.length ? out : null;
}

/** Heuristic fallback used when no selectors are configured yet, or the
 * configured ones match nothing (e.g. the page changed). Scans every
 * `<table>` on the page; for each row, looks for one cell that looks like
 * a ticker symbol and a DIFFERENT cell (to its right) that parses as a
 * plain number, and takes the first such number as the price. This is
 * necessarily a best-effort default — a real market-watch table's actual
 * column layout should be captured via the Options page's "Test scrape"
 * tool and saved as explicit selectors once the page is seen live. */
function scrapeHeuristic() {
  const out = [];
  const seen = new Set();
  const tables = document.querySelectorAll('table');
  const scanRows = (rows) => {
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, th'));
      if (cells.length < 2) continue;
      let ticker = null;
      let tickerIdx = -1;
      for (let i = 0; i < cells.length; i++) {
        const text = cellText(cells[i]);
        if (TICKER_LIKE.test(text)) {
          ticker = text;
          tickerIdx = i;
          break;
        }
      }
      if (!ticker || seen.has(ticker)) continue;
      let price = null;
      for (let i = tickerIdx + 1; i < cells.length; i++) {
        const n = parseNumber(cellText(cells[i]));
        if (n !== null && n > 0) {
          price = n;
          break;
        }
      }
      if (price === null) continue;
      seen.add(ticker);
      out.push({ ticker, price, changePct: null });
    }
  };
  for (const table of tables) {
    scanRows(table.querySelectorAll('tbody tr, tr'));
  }
  if (!out.length) {
    // Some market-watch widgets aren't real <table> markup at all (div grids).
    // Fall back to scanning every element with children for the same pattern,
    // one level shallower — best-effort only.
    scanRows(document.querySelectorAll('tr, [role="row"]'));
  }
  return out;
}

async function scrapePrices(overrideConfig) {
  let cfg = overrideConfig || {};
  if (!overrideConfig) {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      cfg = stored[STORAGE_KEY] || {};
    } catch (e) {
      // storage unavailable for some reason — fall through to heuristic
    }
  }
  const configured = scrapeWithConfig(cfg);
  if (configured) return { rows: configured, strategy: 'configured' };
  const heuristic = scrapeHeuristic();
  return { rows: heuristic, strategy: 'heuristic' };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SCRAPE_NOW') {
    // `message.config`, when present, is an UNSAVED draft config from the
    // Options page's "Test scrape" button — lets the user iterate on
    // selectors before saving. The regular background-driven cycle never
    // sets this, so it always reads the saved config from storage instead.
    scrapePrices(message.config)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
    return true; // async response
  }
  return undefined;
});
