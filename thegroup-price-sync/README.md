# TheGroup → FinanceRecorder Price Sync (Chrome extension)

Scrapes live QSE prices — and company names — off [The Group](https://webd.thegroup.com.qa/en/markets/qatar)'s
market-watch page (while it's open in one of your own logged-in tabs) and pushes them into
the **shared** `stockData/QSE` node in FinanceRecorder's Firebase Realtime Database — the
same node the web app already reads ticker names/fundamentals from — so the data is useful
to every FinanceRecorder user, not just whoever runs this extension.

FinanceRecorder's bundled ticker list (`webapp/src/lib/stockData/qseSeed.ts`) only ever
hard-coded a partial set of QSE's real listed companies and was never meant to be kept
up to date by hand. Since this extension already scrapes every row of the market-watch
table for a price, it captures that same row's company-name cell too and pushes it to
`stockData/QSE/tickerNames/{ticker}` — so running this for a while against the real page
is what actually fills in the app's ticker coverage, not a one-off manual edit.

## How it works

- **`content.js`** runs on the market-watch page and reads whatever's already rendered
  there. It never logs in, never fetches anything itself, and never sends the page's HTML
  anywhere — it only replies to the extension's own background script with parsed
  `{ticker, price, changePct, name}` rows. `name` (the company name) is best-effort: the
  heuristic fallback guesses it from whichever cell sits right after the ticker cell, but a
  real `nameSelector` set in Options (same "Test scrape" workflow as the other selectors)
  is far more reliable once you've seen the real page's layout.
- **`background.js`** (the MV3 service worker) does everything else:
  - **Collects** (asks the content script to re-scrape) every ~45–90 seconds (randomized,
    not a fixed period) whenever the market page is open in some tab. This is free/local —
    no network request beyond talking to the tab.
  - **Pushes** the latest scrape to Firebase only once at least the configured minimum
    number of minutes has passed since the last push, **plus a random extra delay on top**
    (so the real gap between pushes is randomized between 1x and 2x the floor — never a
    predictable period). Default floor is 2 minutes, adjustable in the popup. This keeps
    writes well under Firebase RTDB's rate limits and avoids a bot-like, perfectly periodic
    request pattern against both Firebase and the brokerage's own page.
  - Every ticker the scraper finds gets pushed — there's no per-ticker allow-list. A
    ticker's company name is pushed alongside its price whenever one was captured for that
    row (a missing/unreliable name never blocks the price push for the same ticker).
  - Talks to Firebase with plain `fetch()` calls (Identity Toolkit REST for auth, RTDB REST
    for reads/writes) — no Firebase SDK is bundled, since an MV3 service worker doesn't need
    it for this.
- **`popup.html`/`popup.js`**: sign in/out, the "minimum minutes between pushes" control,
  and live status (last scrape, last push, next push ETA).
- **`options.html`/`options.js`**: target URL + CSS selector overrides for the scraper, plus
  a "Test scrape" tool that runs against whatever's currently in the fields (even unsaved)
  so you can iterate against the real page without needing anyone else to see it.

## ⚠️ Required one-time setup: a Firebase Realtime Database rule change

This extension writes to `stockData/QSE/...`. That path's current security rules (set up
for FinanceRecorder itself) most likely don't allow writes from just any authenticated
user — only the project owner can check/change this, since it needs Firebase console
access this repo's own AI sessions don't have. Open **Firebase Console → Realtime
Database → Rules** for the `qse-app` project and make sure `stockData` allows a write from
any signed-in user, e.g.:

```json
{
  "rules": {
    "stockData": {
      "QSE": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "...": { "...": "leave every other existing rule (users/**, etc.) exactly as it is" }
  }
}
```

Don't replace your whole rules tree with just this snippet — merge it into whatever rules
already exist for `users/{uid}/...` etc. If you're not sure how those are currently
structured, export the current rules first (Rules tab → the JSON is right there) before
editing.

**Note:** the web app itself does not yet read `stockData/QSE/prices` or
`.../priceHistory` to resolve a stock's "current price" — today it only reads
`tickerNames`/`fundamentals` from this node. Wiring the app's own price resolution to
prefer this shared feed is a separate, follow-up change to the live app (real blast
radius: every QSE holding's displayed price, break-even, and P/L) and hasn't been made
here — ask for that as its own next step once you've confirmed real data is landing in
Firebase correctly. **`tickerNames` IS already read and merged in** (`webapp/src/lib/stockData/reader.ts`)
— any ticker/name you push here shows up in the app immediately, merged with (and
overriding on overlap) the bundled seed, with no extra wiring needed.

## Load the extension

1. `chrome://extensions` → enable **Developer mode** (top right).
2. **Load unpacked** → select this `thegroup-price-sync/` folder.
3. Open the market-watch page in a tab and stay signed in there as you normally would.
4. Click the extension icon → sign in (see below) → open **Options** and use **Test
   scrape** to check whether the auto-detect heuristic finds real rows, or fill in real CSS
   selectors and save.

## Signing in

Firebase RTDB rules need *some* authenticated user, but — since prices land in the shared
`stockData/QSE` node, not any one person's own workbook — it does **not** need to be your
main FinanceRecorder login. The popup's sign-in form has a **"Create a new account
instead"** checkbox that registers a brand-new, dedicated email/password account for this
purpose alone via Firebase's `accounts:signUp` endpoint, so your main password never has to
sit in this extension's local storage. Either works.

**Security note:** the popup stores a Firebase refresh token in `chrome.storage.local`
(this machine/profile only, never synced or sent anywhere but Firebase) so it doesn't ask
you to sign in every hour. That token can keep acting as whichever account you used
indefinitely until you click **Sign out**. Treat this browser profile as trusted, and
prefer the dedicated-account option above if you'd rather not put your main account's
credential material there at all.

## Tuning the scraper

The bundled heuristic (`content.js`) scans every `<table>` for a row containing one
ticker-like cell (`[A-Z][A-Z0-9]{1,5}`) followed by a plain numeric cell, and takes that as
the price; it also guesses the company name from whichever cell sits immediately after the
ticker cell, if that text isn't itself ticker-like or numeric. It's a reasonable starting
guess, but a real page's actual markup should be captured properly:

1. Open the market-watch page, right-click the price table → **Inspect**.
2. Find a CSS selector that matches every stock row (e.g. `table.market-watch tbody tr`)
   and, within a row, one each for the ticker cell, the price cell, and (if the table has
   one) the company-name cell.
3. Paste those into the Options page, click **Test scrape**, and check the JSON output —
   each row should show the right `ticker`/`price`/`name`.
4. Save once it looks right.

## A note on scraping etiquette

This only reads what's already rendered in a tab you're personally logged into — it
doesn't automate logging in, bypass any auth, or scrape at a rate designed to look like
anything other than a slow, occasional refresh. Even so, check The Group's own terms of
use for their market-data page before leaving this running long-term, and keep the push
floor at a sane value (2+ minutes) rather than cranking it down — this protects both
Firebase's write limits and the brokerage's own servers.
