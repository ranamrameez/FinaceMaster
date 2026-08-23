# FinanceRecorder — User Manual

Live app: <https://ranamrameez.github.io/FinaceMaster/webapp/>

This is the end-user guide — how to actually use the app. For project status/backlog see
`README.md`; for developer/AI-continuity notes see `CLAUDE.md`; for the future-modules
design see `MODULES_PLAN.md`. **This manual is kept up to date alongside the app itself —
if a feature described here changes, this file changes with it.**

---

## 1. What this app does

FinanceRecorder tracks your investments and (eventually) broader personal finances across
multiple exchanges and account types. Right now it covers two stock exchanges — **QSE**
(Qatar Stock Exchange) and **PSX** (Pakistan Stock Exchange) — each with its own portfolio,
transactions, watchlist, analytics, and settings. More modules (Cash, Banking, Funds,
Rentals, EMI/Loans, Personal Loans) are planned; see `MODULES_PLAN.md` for what's coming.

**Before anything else**: on your first visit, you'll see a one-time disclaimer screen.
Read it and check the box to continue — it explains that all calculations here are
**estimates**, not guarantees, and you should always verify against your real broker
statement before making financial decisions. You can revisit the full text any time via
**Disclaimer & Privacy** at the bottom of the sidebar.

---

## 2. Browsing vs. saving

You can browse every page and use the Trade Calculator **without an account**. The moment
you try to *save* something (add a transaction, update a price, change a setting), you'll
be prompted to sign in (email/password, or Google). This is by design — there's no
"local-only" mode where data exists before it's tied to an account.

Your data is private to your account and stored securely (Google Firebase). It syncs
automatically between your devices once you're signed in on each of them.

---

## 3. Switching between QSE and PSX

The sidebar has a **Stocks** section at the top with a **QSE / PSX** switcher (two chips).
Click either one to jump to that exchange's Dashboard. Which exchange is "active" always
matches whichever page you're on — the switcher doesn't need to be clicked to navigate
within an exchange, only to hop between them.

Each exchange's pages, data, and settings are completely separate — QSE holdings don't mix
with PSX holdings, and each has its own fee model (see §7).

---

## 4. Dashboard

Your at-a-glance summary for the current exchange: net worth, cash balance, portfolio
value, realized/unrealized P/L, total fees, rewards, open positions, and portfolio ROI —
plus a Holdings preview, an allocation chart, a P/L-by-ticker chart, a realized-P/L-over-time
chart, and an Alerts panel (flags positions moving more than ±5%, or watchlist items near
their target price — shown once per session as a toast, then listed at the page bottom).

---

## 5. Portfolio

Two tabs:
- **Holdings** — every open position: shares held, average cost, current value, unrealized
  P/L, and (PSX only) an estimated CGT-if-sold-now figure.
- **History** — every closed position (fully sold tickers), with realized P/L.

Click any ticker to open its dedicated stock page (price chart, buy/sell history, and —
on PSX, if you've turned on FIFO cost basis in Settings — an **Open lots** table showing
each remaining buy lot separately).

---

## 6. Transactions

The Transactions page has several tabs:

### Add transaction(s)
Enter one or more BUY/SELL rows at once (date, ticker, action, shares, price) and save them
together. On PSX, each row also has:
- **Same-day override** checkbox — the app already auto-detects same-day buy/sell round
  trips and nets the smaller leg's fee down to government levies only (no double
  commission). Check this if your statement shows a same-day netting that the date you
  entered doesn't quite match (e.g. you logged the settlement date instead of the trade
  date).
- **Fee override** field — leave blank to use the computed fee, or type the exact fee from
  your account statement to override the estimate entirely (useful for reconciling against
  real broker charges).

### Transaction list
Every transaction, sortable and filterable/groupable by ticker, action, or month. Click
**Edit** on any row to fix a mistaken entry (date, ticker, shares, price, and on PSX the
same-day/fee-override fields too) — nothing here is add/delete-only. The Fee column shows
`(netted)`, `(netted, manual)`, or `(override)` tags to explain how that fee was calculated.

### Cash transfers
Log deposits/withdrawals into your trading account's cash balance. Editable and deletable.

### Rewards & adjustments
Any other cash-affecting event that isn't a trade or transfer — a broker reward, a
correction, etc. Editable and deletable.

### Cash ledger
A read-only, chronological view of every cash-affecting event (trades, transfers,
adjustments) with a running balance — like a bank statement for your trading account.

### Dividends
Log dividends received (by ticker, per-share rate, and/or a flat total), see your
dividends log with a running total, edit or delete any entry, and set an estimated annual
per-share rate for each currently-held ticker to see a projected yearly dividend income
table.

---

## 7. PSX-specific: fees, CGT, and cost basis

PSX has a more detailed fee model than QSE (commission, SST, PSX fee, NCCPL fee, SECP levy,
CDC, CVT — all configurable in Settings, see §9) plus capital gains tax. A few things worth
understanding:

- **Same-day netting**: if you buy and sell the same ticker on the same date, the smaller
  side only pays government levies, not full commission — this happens automatically.
- **CGT (capital gains tax)**: shown as an estimate on stock pages and the Trade Calculator,
  based on your Settings' Filer/Non-filer status and rates. It's an estimate for your
  awareness — it isn't deducted from any number automatically.
- **Cost basis method** (Settings → Fees & amounts): **Average cost** (default) blends
  every buy into one running average — a sell can't be tied to a specific lot. **FIFO**
  tracks each buy as its own lot and sells the oldest one first, giving lot-accurate
  realized P/L and CGT. Switching this recalculates your *entire* history under the new
  method immediately (nothing here is stored per-transaction) — it's not the default
  because that's a real change to your computed numbers, not a cosmetic one. Try it, compare,
  switch back if you don't like it.

---

## 8. Watchlist

Track tickers you don't currently hold (or hold and want to keep an eye on). Add a ticker
with a target price and optional current price; both Target and Current are editable
in-place any time (just click into the field and type). The Gap column shows how far the
current price is from your target. A ticker's name field itself isn't editable — if you
mistype a ticker, remove it and re-add it correctly.

---

## 9. Settings

- **Account** — your display name and avatar, sign-in status, cloud sync status, and
  (if the cloud looks completely empty for your account) an explicit "upload local data to
  cloud" button — this never happens automatically, to protect against accidentally
  overwriting real cloud data with an empty local session.
- **Data management** — export your entire workbook as a JSON file (a personal backup you
  control), import a previously-exported file, or clear all local data (irreversible —
  export a backup first if unsure).
- **Fees & amounts** (PSX) / general settings (QSE) — commission rates, government levies,
  CGT rates and filer status, cost-basis method, tick size, currency, and default deposit
  fee. Change these to match your actual broker's schedule.

---

## 10. Trade Calculator

A floating 🧮 button, available on every page. Model a hypothetical BUY, SELL, or (PSX
"Cycle" mode) a buy-then-planned-sell — see break-even price, current P/L, estimated fees,
and (PSX) estimated CGT — before you actually commit to a trade. You can log the modeled
trade straight from here once you're ready.

---

## 11. Trade Planner (PSX)

For planning multi-leg trades ahead of time, separate from the one-shot Trade Calculator:

1. **Save a plan** — give it a name, optional notes, and one or more legs (ticker, action,
   shares, price, date).
2. **Edit anytime** — rename the plan, edit its notes, or edit/remove any individual leg
   that hasn't been executed yet.
3. **Mark a leg done** once you've actually executed that trade — this logs it straight
   into your real Transaction history (with an estimated fee shown per leg beforehand) so
   you don't have to re-type it into the Transactions tab. The leg stays in the plan as a
   record, separate from the transaction it created.
4. **Delete a plan** any time — this only removes the plan, not any transactions already
   logged from marking legs done.

QSE doesn't have this page yet, but the same functionality is available underneath
(technically shared) if a QSE Trade Planner page ever gets built.

---

## 12. Analytics

Deeper charts across four category tabs (exact set depends on the exchange) — allocation,
performance, fees, and (QSE only, for now) fundamentals. See individual chart tooltips for
details on what each one shows.

---

## 13. Cash

The first non-stock-exchange module (find it under **More → Cash** in the sidebar for now,
until a proper category switcher replaces this). Tracks physical/informal cash — cash in
hand, gifts, small informal amounts — as a simple ledger, separate from any exchange.

- **Add an entry**: date, Cash in/Cash out, amount, currency, an optional free-text category
  (type anything — it's never a fixed list, and previously-used categories show up as
  autocomplete suggestions), and an optional note.
- **Every entry is editable and deletable** from the Ledger list.
- **Balances and category totals are shown per currency**, never blended into one number —
  if you've logged cash in both USD and PKR, you'll see two separate balance figures, since
  there's no reliable exchange rate to convert them with.
- **Settings tab**: pick a default currency (only pre-fills new entries — never converts
  existing ones), plus the same export/import/clear-all data management as other modules.

More modules (Banking, EMI/Loans, Funds, Personal Loans, Rentals) are planned — see
`MODULES_PLAN.md`.

---

## 14. A note on accuracy

Every number in this app is an **estimate** computed from settings you configure — it is
not a substitute for your actual broker/exchange statement, and it is not financial advice.
See **Disclaimer & Privacy** (linked at the bottom of the sidebar) for the full legal text.
If a number here ever disagrees with your official statement, trust the statement.
