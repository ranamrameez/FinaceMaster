# FinanceRecorder — User Manual

Live app: <https://ranamrameez.github.io/FinaceMaster/webapp/>

This is the end-user guide — how to actually use the app. For project status/backlog see
`README.md`; for developer/AI-continuity notes see `CLAUDE.md`; for the future-modules
design see `MODULES_PLAN.md`. **This manual is kept up to date alongside the app itself —
if a feature described here changes, this file changes with it.**

---

## 1. What this app does

FinanceRecorder tracks your investments and broader personal finances across multiple
exchanges and account types. It covers two stock exchanges — **QSE** (Qatar Stock Exchange)
and **PSX** (Pakistan Stock Exchange) — each with its own portfolio, transactions,
watchlist, analytics, and settings — plus six more modules: Cash, Personal Loans, Banking,
EMI/Loans, Funds, and Rentals (see §14-§21 below). See `MODULES_PLAN.md` for the design
notes behind each module and any future refinements.

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

## 3. Switching between modules, and between QSE and PSX

The sidebar's top control is a **category dropdown** — click it to see every module (Stock
Exchanges, Funds, Banking, Cash, Personal Loans, EMI/Loans, Rentals, Transfers), with the one
you're currently in checked. Picking a category jumps you to it; the dropdown always shows
what you're on, so you don't need to reopen it just to confirm where you are.

Inside **Stock Exchanges**, a second **QSE / PSX** switcher (two chips) appears underneath the
dropdown — click either one to jump to that exchange's Dashboard. Which exchange is "active"
always matches whichever page you're on, same as the category dropdown above it.

On a desktop-width screen, click the **«** button next to the "FinanceRecorder" title to
slide the sidebar off-screen and reclaim the space — a small **»** tab stays in the top-left
corner to bring it back. This choice is remembered, so it stays collapsed (or expanded) the
next time you load the app. On a narrow/mobile screen the sidebar instead works as a normal
off-canvas menu opened via the **☰ Menu** button, unaffected by this setting.

Each exchange's pages, data, and settings are completely separate — QSE holdings don't mix
with PSX holdings, and each has its own fee model (see §7).

The **✦ Appearance** button (sidebar) controls font, text size, color theme, density, light/
dark mode, and **Number display** — choose "shortened" (large stat-card numbers show as
"10k"/"1.23M", with the exact figure available as a hover tooltip) or "full" (every stat card
always shows the complete, un-abbreviated number). This is a global, app-wide preference, not
per-module — change it once and it applies everywhere.

---

## 4. Dashboard

Your at-a-glance summary for the current exchange: net worth, cash balance, portfolio
value, realized/unrealized P/L, total fees, rewards, open positions, and portfolio ROI —
plus a Holdings preview, an allocation chart, a P/L-by-ticker chart, a realized-P/L-over-time
chart, and an Alerts panel (flags positions moving more than ±5%, or watchlist items near
their target price — shown once per session as a toast, then listed at the page bottom).

Large money amounts on stat cards (here and on every other module's summary cards) display
abbreviated — e.g. "12.35M PKR" instead of "12,345,678.90 PKR" — for a cleaner look (switch
to full numbers in Appearance, see §3). Hover, or tap on a touchscreen, any abbreviated
number or other underlined-looking stat to see a popup with the exact figure or an
explanation.

The Holdings preview groups related numbers into one column each instead of a separate
column per fact: **Stock** (ticker + company name), **Cost** (avg cost, with break-even
underneath colored green/red against the current price), **Value** (current worth, with
invested and a ▲/▼ indicator underneath), and **P/L** (amount, with the percentage
underneath).

---

## 5. Portfolio

Two tabs:
- **Holdings** — every open position, grouped into scannable columns: **Stock** (ticker +
  name), Shares, **Cost** (avg cost with break-even underneath, colored against the current
  market price), Market Price (editable), **P/L** (amount + percentage), **Exit targets**
  (the price you'd need to hit a +1%/+2%/+5% profit, stacked in one cell), and Status.
- **History** — every closed position (fully sold tickers), with realized P/L.

Click any ticker to open its dedicated stock page (price chart, buy/sell history, and —
on PSX, if you've turned on FIFO cost basis in Settings — an **Open lots** table showing
each remaining buy lot separately). Its stat cards are grouped and color-coded the same way:
"Cost" carries avg cost + break-even; "Bought / Sold" and "Trade dates" each carry a pair of
related figures; if you've sold any of this ticker, "Sell price" shows both your average and
most recent sell price. In "Price range," **Median (fair value)** is a simple fair-value
estimate — the middle price across every price you've recorded for this ticker — useful as
a sanity check when deciding whether to buy more or sell, since the app has no live market
data of its own.

---

## 6. Transactions

The Transactions page has several tabs:

### Add transaction(s)
Enter one or more BUY/SELL rows at once (date, ticker, action, shares, price) and save them
together. On PSX, each row also has a **Fee mode** dropdown with three options:
- **Auto** — the fee is fully computed from your Settings. Same-day round trips (buy and sell
  the same ticker on the same date) are auto-detected: the larger side pays full commission,
  the smaller side is netted to government levies only (matches real PSX same-day
  square-off rules — one side only pays commission, not both).
- **Semi** — you decide whether *this* leg counts as the netted one via a "Netted" checkbox,
  but the amount is still computed from Settings. Use this when your statement shows a
  same-day netting that the date you entered doesn't quite match (e.g. you logged the
  settlement date instead of the trade date). **A new BUY dated today starts in Semi mode
  with "Netted" pre-checked** — a lone buy has nothing to net against yet if you haven't
  logged the matching sell, so the app assumes you're doing same-day (intraday) trading;
  switch to Auto if you're actually opening a position you plan to hold, not closing out
  today.
- **Manual** — type the exact fee from your account statement, bypassing computation
  entirely (useful for reconciling against real broker charges down to the last rupee).

Switching modes clears whatever the other mode was using, so there's no way for a leftover
checkbox and a leftover fee number to silently conflict with each other.

### Transaction list
Split into two collapsible sections — **Open positions** (tickers you're still holding) and
**Closed positions** (tickers you've fully exited) — so a stock you sold out of months ago
doesn't clutter the same view as what you're actively holding. Every transaction is sortable
and filterable/groupable by ticker, action, or month, same as before — the filter/sort just
applies before the split, so picking one ticker shows it in whichever section it belongs to.
Click **Edit** on any row to fix a mistaken entry (date, ticker, shares, price, and on PSX the
same-day/fee-override fields too) — nothing here is add/delete-only. The Fee column shows
`(netted)`, `(netted, manual)`, or `(override)` tags to explain how that fee was calculated.

### Cash transfers
Log deposits/withdrawals into your trading account's cash balance. Editable and deletable.
A **Balance** column shows the running net cash you've contributed so far (deposits net of
fee, minus withdrawals plus their fee) — always in true date order regardless of which column
you've sorted the table by. This is separate from the Cash ledger's balance below, which also
factors in trading activity.

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

A floating 🧮 button, available on Stock Exchanges pages (QSE and PSX). Model a hypothetical
BUY, SELL, or (PSX "Cycle" mode) a buy-then-planned-sell — see break-even price, current P/L,
estimated fees, and (PSX) estimated CGT — before you actually commit to a trade. You can log
the modeled trade straight from here once you're ready. It doesn't appear on other modules
(Cash, Banking, etc.) since a stock trade calculator wouldn't mean anything there.

Opening it from a specific stock's own page pre-selects that ticker automatically — you don't
need to re-pick it from the dropdown. Opening it from anywhere else (Dashboard, Portfolio,
Transactions) still defaults to your first held position.

---

## 11. Risk Analysis

Under Stock Exchanges' page nav (QSE and PSX each have their own, since they use different
fee models). Models **averaging down** into an existing open position — adding capital at
the current price to lower your average cost — and shows whether it's actually worth it:

- **Current position**: your invested amount, break-even price, how much recovery (%) is
  needed at the current price, and current net P/L.
- **Meaningful averaging points**: a table of "if you add this much capital" scenarios —
  new average cost, new break-even, recovery needed, and net P/L if you later sell at your
  target price. One row is marked **Selected** (closest to the capital you entered).
- **Diminishing returns**: once adding more capital stops meaningfully improving your
  break-even (less than a quarter percentage point per step), that row is flagged so you
  know where more capital stops being worth it.
- **Stress test**: shows what your P/L would look like after the selected averaging, if the
  price fell further (a fixed set of drops, plus your own chosen "stress" percentage).

**This is planning support, not a recovery guarantee** — averaging down doesn't guarantee a
stock recovers, and the calculator says so directly. Only shows tickers you currently hold
(there's nothing to "average into" without an existing position).

---

## 12. Trade Planner (PSX)

For planning multi-leg trades ahead of time, separate from the one-shot Trade Calculator:

1. **Save a plan** — give it a name, optional notes, an optional **default ticker** (most
   plans revolve around one stock — set it once and new legs auto-fill with it; you can
   still change any individual leg to a different ticker), and one or more legs (ticker,
   action, shares, price, date).
2. **Edit anytime** — rename the plan, edit its notes or default ticker, add a new leg to an
   already-saved plan ("+ Add leg" below the table — pre-fills the default ticker too), or
   edit/remove any individual leg that hasn't been executed yet. Click any column header
   (Date, Ticker, Action, Shares, Price, Amount, Status) to sort the legs table.
3. **Per-ticker plan analysis**: below each plan's legs, a table shows — for every ticker in
   the plan — how many shares are already executed vs. still planned (shown separately so
   they're never conflated), your average cost (blending this plan's own *pending* buy legs
   with any shares you already hold, so planning to sell existing stock works correctly even
   with no buy legs in the plan), a fee-aware break-even price, shares remaining once the
   plan executes, and planned profit/loss from the plan's pending sell legs. A "Total planned
   P/L" also shows in the summary line once any leg is a sell — this is the actual point of a
   *planner*: not just listing trades, but seeing whether the cycle as a whole is expected to
   be profitable.
4. **What if?**: right below the analysis table, type a hypothetical exit price per ticker to
   see what selling would actually net after fees — shown two ways: just what's left after
   this plan's own pending sells, and the full position as if those pending sells hadn't
   happened. A quick way to check whether your planned exit price is actually the best one,
   or a different price/quantity would net more — a sandbox for testing exit combinations
   before committing to one.
5. **Mark a leg done** once you've actually executed that trade — this logs it straight
   into your real Transaction history (with an estimated fee shown per leg beforehand) so
   you don't have to re-type it into the Transactions tab. Once executed, the plan row stays
   **synced** to that transaction — if you later edit its shares/price/date from the
   Transactions tab or a stock page, the plan row updates to match automatically, so you're
   never looking at stale data in the planner. A pending leg's estimated fee also correctly
   accounts for any other same-day buy/sell of the same ticker elsewhere in the same plan
   (PSX's same-day netting rule — the larger side pays commission, the smaller side pays
   government levies only), not just that one leg in isolation.
6. **Delete a plan** any time — this only removes the plan, not any transactions already
   logged from marking legs done.
7. **Collapse** a plan (button in its header) to shrink it down to just the name/summary line
   — handy once you have several plans and only want to focus on one. **Full screen** a plan
   to expand it to fill the whole page for distraction-free editing; click "Exit full screen"
   (or the dimmed backdrop) to return to the normal view.

QSE doesn't have this page yet, but the same functionality is available underneath
(technically shared) if a QSE Trade Planner page ever gets built.

---

## 13. Analytics

Deeper charts across four category tabs (exact set depends on the exchange) — allocation,
performance, fees, and (QSE only, for now) fundamentals. See individual chart tooltips for
details on what each one shows.

**Filtering**: a filter bar at the top lets you narrow the charts to specific tickers (click
one or more ticker chips, or "All" to reset) and/or a month range. Per-ticker charts (ROI%,
allocation, P/L by symbol, holding period, dividends by ticker) and monthly charts (trading
activity, dividends by month, fees by month) respect the filter. A handful of whole-portfolio
totals — realized vs unrealized P/L, cash vs stocks split, fees breakdown, deposits vs
invested, and the cumulative cash-balance line — always show your full history: narrowing
those to a ticker or date window wouldn't mean what it looks like it means (your *current*
holdings aren't a function of which window you're looking at).

---

## 14. Cash

The first non-stock-exchange module (pick **Cash** from the sidebar's category dropdown).
Tracks physical/informal cash — cash in hand, gifts, small informal amounts — as a simple
ledger, separate from any exchange.

- **Add an entry**: date, Cash in/Cash out, amount, currency, an optional free-text category
  (type anything — it's never a fixed list, and previously-used categories show up as
  autocomplete suggestions), and an optional note.
- **Every entry is editable and deletable** from the Ledger list.
- **Balances and category totals are shown per currency**, never blended into one number —
  if you've logged cash in both USD and PKR, you'll see two separate balance figures, since
  there's no reliable exchange rate to convert them with. If a currency has any upcoming
  (not-yet-marked-done) plans from the Planning tab below, the balance card shows a note
  with the count and net amount right there, so you don't have to open Planning to see it.
- **Analytics tab**: a category-breakdown chart, an income-vs-expense-by-month chart, and a
  balance-over-time chart. If you've logged entries in more than one currency, a currency
  picker at the top switches which currency's charts you're looking at.
- **Planning tab**: a "what if I spend on this" scenario planner, meant as a guardrail
  against overspending. Add a **plan** (an expected future cash in/out that hasn't happened
  yet) and see a **Real balance** (from your actual entries) alongside a **Planned balance**
  (Real plus every plan you haven't marked done yet) — a realistic look at where you'd end up
  if everything you've planned actually happens. Two checkboxes at the top let you choose
  which of the two balances you want to see (both are on by default). Edit or delete a plan
  any time while it's still pending; **"Mark as done"** turns it into a real Ledger entry
  while keeping the plan itself around (now shown as "Done") as a record of what you'd
  planned — it doesn't disappear or get merged into the real entry.
- **Import tab**: import a CSV export of cash entries — pick which column is Date and which
  is Amount (a positive amount is cash in, negative is cash out; check "Flip sign" if your
  export does the opposite), optionally map a Category column too, pick the currency for the
  whole imported batch, preview the first 5 rows, then import. Imported entries show
  "Import (filename)" in the ledger's Source column so you can tell them apart from entries
  you typed in by hand.
- **Settings tab**: pick a default currency (only pre-fills new entries — never converts
  existing ones), plus the same export/import/clear-all data management as other modules.

---

## 15. Personal Loans

Informal loans with another person — money you lent out, or money you owe — tracked in
**either direction** in one place. Pick **Personal Loans** from the category dropdown.

- **Add a loan**: person/lender name, direction (lent out / I owe), currency, principal
  amount, date, optional note.
- **Net position summary** at the top shows, per currency, whether you're net owed money or
  net owe money across all your personal loans combined.
- **Click a loan to open it**: see principal, outstanding balance, edit the loan itself
  (person, direction, currency, principal, date, note), or delete it (this also deletes its
  logged repayments).
- **Payoff planner**, inside a loan's detail view: enter a planned monthly repayment amount
  and see how many months it would take to clear what's left, and roughly when. This is a
  live "what if" estimate — nothing is saved, and there's no interest involved (an informal
  loan just gets paid down at whatever rate you type in).
- **Log repayments** against a loan any time — date + amount — and edit or delete any
  repayment later. Outstanding = principal minus all repayments logged so far. The repayments
  list has a **Remaining** column showing the loan's running balance after each repayment, in
  true date order regardless of how you've sorted the table.
- No interest or repayment-schedule automation here by design — if a "personal loan"
  actually has a real repayment schedule, it belongs in EMI/Loans (§18 below) instead.
- **Analytics tab** (back on the main Personal Loans page, alongside the loan list): an
  outstanding-by-loan chart (green for money lent out, red for money you owe) and a
  repayments-by-month chart. A currency picker appears if you have loans in more than one
  currency.
- A repayment created from the **Transfers** page (§22) is linked to a Bank or Cash entry —
  deleting it there also removes the matching Bank/Cash record; see §22 for details.
- **Import repayments (CSV)**: inside a loan's detail view, below its repayments table, import
  a CSV of past repayments — map which column is Date and which is Amount, preview the first
  5 rows, then import. Amounts are always treated as positive (a repayment doesn't have a
  direction to flip). Imported repayments show "Import (filename)" in the Source column.
- **Export repayments (CSV)**: below the repayments table, optionally set a from/to date
  range and click **Export CSV** to download that loan's repayment history (with the same
  running Remaining balance shown on screen) as a spreadsheet file.

---

## 16. Banking

Bank account balances and transaction history, entered manually or imported from a CSV
statement. Pick **Banking** from the category dropdown. No live bank connection (regulator
licensing is required for that, so it's manual entry or statement import only).

- **Accounts tab**: add one or more accounts (name, currency, opening balance). Each
  account has exactly one currency. Edit or delete any account (deleting an account also
  deletes its transactions). A "Total balance" summary at the top groups accounts by
  currency, and shows a note underneath if that currency has any upcoming (not-yet-marked-
  done) plans from the Planning tab. Click **Details** on any account for its current
  balance, upcoming plans, and 20 most recent transactions in one view, plus a "Download
  statement" section — pick an optional From/To date range and click **Export CSV** to
  download that account's transactions (with running balance) as a CSV file.
- **Transactions tab**: pick an account, then log transactions with a multi-row form (date,
  description, a signed amount — negative for spend/debit, positive for deposit/credit —
  and an optional free-form category with autocomplete over your own previous categories).
  The list shows a running balance and every entry is editable/deletable. A category
  breakdown card shows net spend/income per category.
- **Planning tab**: the same "what if I spend on this" scenario planner as Cash's (see §14)
  — pick an account, add a plan (expected date, description, a signed amount), and see a
  **Real** vs. **Planned** total balance for that account's currency, with the same two
  display checkboxes. "Mark as done" turns a plan into a real transaction on that account
  while keeping the plan around, now shown as "Done."
- **Import statement tab**: pick the target account, choose a CSV file exported from your
  bank, then map which column is Date/Description/Amount (every bank's export looks
  different, so this asks you rather than guessing) — check "Flip sign" if your bank
  exports spending as positive numbers. Preview the first 5 mapped rows, then import. This
  is intentionally a simple column-mapping tool, not a parser for every specific bank
  format.
- **Analytics tab**: pick an account (each chart is scoped to it, not a currency, since a
  bank account's history is naturally one account's own data) — a balance-over-time chart, a
  category breakdown of your spend (income categories aren't mixed in, since a doughnut of
  credit and debit together wouldn't mean anything), and income vs. spend by month. Below the
  charts, a **budget** tool: set a monthly spend target per category (type an amount, press
  Enter to save) and see this month's actual spend against it — over-budget shows in red. A
  category you've spent in but haven't set a target for still shows up with its actual spend
  and a blank target, so nothing gets hidden just because you haven't budgeted for it yet.
- **Settings tab**: same account/cloud-sync status and export/import/clear data management
  as other modules.

---

## 18. EMI / Loans

For a loan you're repaying on a fixed schedule — a mortgage, car financing, or similar. Pick
**EMI / Loans** from the category dropdown. Distinct from Banking (which just tracks account
transactions) and Personal Loans (informal, no schedule).

- **Add a loan**: name, lender, currency, principal, tenure (months), start date, and one
  of two repayment types:
  - **Interest rate (reducing balance)** — the standard EMI calculation: enter an annual
    interest rate.
  - **Fixed total to return (no-interest / Sharia)** — enter the total amount your lender
    says you'll pay back overall instead of a rate; the markup is spread evenly across the
    tenure with straight-line principal reduction, not compounding.
- **Open a loan** to see its full amortization schedule (the next 12 installments from
  today: installment, interest/markup, principal, remaining balance) plus summary stats —
  monthly installment, outstanding balance, paid so far, months remaining, lifetime
  interest/markup, and expected end date.
- **Edit or delete** a loan any time; editing recalculates the whole schedule immediately.
- **Link to bank**: pick one of your Banking accounts and click **Link to bank** to generate
  a planned entry (in that account's Planning tab) for every installment you haven't paid
  yet, dated on this loan's own schedule. Once linked, the button becomes **Re-link /
  regenerate plans** — use it after editing the loan's terms, or to switch which account
  pays it; this replaces only this loan's own not-yet-done planned installments, leaving
  anything you've already marked done untouched.
- Outstanding balance and paid-so-far assume **on-schedule payment** based on elapsed time
  since the start date — there's no tracking of individually missed or late payments in
  this version.
- **Amortization schedule chart**: a stacked bar chart on the loan's page showing how much
  of each month's payment goes to principal vs. interest/markup — principal grows and
  interest shrinks over time for an interest-rate loan; both stay flat for a fixed-total
  loan (no compounding).
- **What if: extra payment**: enter a fixed extra amount you'd pay on top of the normal
  installment every month to see how much sooner the loan would clear and how much
  interest/markup you'd save. This is a live, unsaved estimate — nothing is recorded until
  you actually change your real payments.
- **Export full schedule (CSV)**: below the Schedule table, click **Export full schedule
  CSV** to download every remaining installment (not just the next 12 shown on screen) as a
  spreadsheet file, with each installment's due date.

---

## 20. Funds

Mutual fund unit holdings and performance. Pick **Funds** from the category dropdown.
Structurally the closest of the new modules to QSE/PSX (buy/sell units at a NAV per unit is the same shape as buy/
sell shares at a price), so it shares the same underlying calculation engine.

- **Add a fund**: name, code, "invested via" platform, category (Equity/Debt/Hybrid/
  International/Other), currency, and optionally an initial investment (amount + NAV) to
  create the first transaction right away.
- **Fund list**: units held, current value, net profit (amount and %), and **XIRR** — a
  return measure that accounts for *when* each investment happened, not just the total, so
  it's more accurate than a flat percentage when you've invested at different times.
- **Open a fund** to see full stats (units, average NAV cost, invested, current value, net
  profit, XIRR), update its current NAV (like a stock's market price), and log or edit/
  delete Invest/Withdraw transactions (units + NAV per unit).
- Edit or delete the fund itself any time (deleting also removes its transactions).
- **Analytics tab**: pick a fund (and a currency, if you hold funds in more than one) to see
  its NAV over time, and a "Contribution vs. value" chart comparing what you've put in against
  what the position is actually worth at each point — useful for spotting when a fund
  genuinely pulled ahead of (or fell behind) your own money. There's also an "Allocation by
  category" chart showing how your total holdings split across fund categories. If you've
  never manually updated a fund's NAV, its NAV-over-time chart stays empty until you do — but
  the Contribution vs. value chart still works, using the price from your buy/sell
  transactions themselves.

---

## 21. Rentals

Rental property income and expenses. Pick **Rentals** from the category dropdown. Not
discrete buy/sell trades like the other modules — recurring rent received and costs (maintenance, property
tax, management fees) against one or more properties.

- **Properties tab**: add a property (name, currency, optional purchase price for future
  reference). Edit or delete any property (deleting also removes its income/expense
  entries). A net-income summary at the top groups properties by currency.
- **Details**: click **Details** on any property to record lease and tenant info (monthly
  rent, the day of the month rent is due, lease start/end dates, whether utilities are
  included, tenant name/contact) and security deposit info (amount, type — cash, cheque,
  bank transfer, other — date, and whether it's been returned). Fill in monthly rent, a
  cycle day, and a lease start date, then click **Generate projected rent** to create a
  projected income plan for every upcoming rent cycle (through the lease end date, or 12
  months ahead for an open-ended lease) — each shows in the same view with **Mark done**
  (logs it to the Income & expenses tab as a real entry) or **Remove**. Click **Generate
  projected rent** again any time (after editing lease terms, say) to regenerate — this
  replaces only this property's own not-yet-done projected plans, leaving anything already
  marked done untouched. Only rent income is auto-planned, not expenses (those are too
  irregular to project reliably) — log expenses manually in the Income & expenses tab.
- **Income & expenses tab**: pick a property, then log rent income or an expense (with a
  free-form, autocompleted category for expenses — "Maintenance", "Property tax", etc.).
  See a category breakdown and a monthly income/expense/net rollup table, plus the full
  entry list with edit/delete.
- No property valuation tracking or mortgage/loan tracking in this version — a property's
  mortgage, if you have one, belongs in EMI/Loans (§18) instead.
- **Analytics tab**: pick a currency (if you hold properties in more than one) to see a
  "Net income by property" chart comparing all your properties side by side — profitable
  ones in green, properties running at a loss in red. Pick a property to see its category
  breakdown (how much of its income/expense came from where) and its monthly income vs.
  expense trend as charts, alongside the same tables already available in the Income &
  expenses tab.
- **Import tab**: import a CSV of income/expense entries for one selected property — map
  Date/Amount/an optional Category column; a positive amount is rent income, negative is an
  expense (check "Flip sign" if your export does the opposite). Imported entries show
  "Import (filename)" in the entry list's Source column.
- **Settings tab**: same account/cloud-sync status and export/import/clear data management
  as other modules.

This completes the six modules planned in `MODULES_PLAN.md` — Cash, Personal Loans,
Banking, EMI/Loans, Funds, and Rentals are all built alongside the original QSE/PSX stock
exchange modules.

---

## 22. Transfers (linking money between modules)

Pick **Transfers** from the category dropdown. Normally, moving money between two modules
— say, withdrawing cash from your bank account — means entering it twice: a withdrawal in
Banking and a cash-in entry in Cash. Do that and the two records have no idea they're
related; edit or delete one later and the other silently goes stale. The Transfers page
fixes that for the most common moves by creating **one linked transfer** that writes a real
record on both sides at once, and keeps them in sync afterward.

**Supported so far**: Cash ↔ Banking, Banking ↔ your QSE or PSX cash balance (a deposit or
withdrawal), Banking/Cash ↔ a specific Rentals property (rent received, or an expense paid),
and Banking/Cash ↔ a specific Personal Loan (a repayment logged against that loan). Other
pairings (e.g. Cash directly to a stock exchange, or anything involving Funds/EMI) aren't
wired up yet — the form tells you if a pairing isn't supported instead of silently doing
something wrong.

- **Create a link**: choose the **From** and **To** side (for Banking, also pick which
  account; for Rentals, pick which property; for Personal Loans, pick which loan), an
  amount, a date, and an optional note, then **Create link**. This adds a matching entry to
  both modules' own ledgers — you'll see it appear in Cash's ledger, Banking's transaction
  list, a property's income/expenses, or a loan's repayment list, exactly like anything else
  you'd entered by hand there. A Personal Loans repayment created this way is always a
  positive amount against the chosen loan, regardless of which side of the link it's on.
- **Different currencies**: no live conversion happens automatically — but if the two sides
  use different currencies, check **"Different amount on the other side"** and enter the
  real converted amount yourself (from your bank's rate, a cash exchange receipt, etc.).
  Leave it unchecked and the same number is used on both sides as-is, which is only correct
  when both sides share a currency (the form warns you if they don't).
- **Editing or deleting a link** (in the "Linked transfers" list at the bottom of the page)
  updates or removes **both** sides' records together — you don't need to (and shouldn't)
  go edit or delete the two records separately in their own modules.

---

## 23. Net Worth

Pick **Net Worth** from the category dropdown — a single page summarizing everything you've
recorded across every module. Each currency you use gets its own collapsible section (click
its header to expand/collapse) showing your real, unconverted **Assets**, **Liabilities**,
and **Net** total in that currency — Cash and Banking balances, your QSE/PSX portfolio value
plus cash, Funds' current market value, and Personal Loans' net position all count as assets
(or a liability, if you owe more than you're owed); EMI/Loans' outstanding balance always
counts as a liability. **Rental income is shown separately below, not included in the total**
— property values aren't tracked in this app, and the rent you've collected already landed in
whichever Cash/Bank account you deposited it to, so adding it again here would count it twice.

**One combined total, converted**: pick a currency in "Show total in" at the top, and every
section with a known exchange rate gets converted and added into one grand total. Rates come
from a free exchange-rate service, refreshed automatically at most once a day (never on every
page load) and cached — click **Refresh rates** to force an update. If the automatic fetch
ever fails (no internet, the service being unreachable), or a currency you use simply isn't
covered, just enter the rate yourself under "Manual rate: 1 USD =" — the page works exactly
the same either way, and it never blocks you from seeing your real per-currency totals even
with no rate at all (only the one converted grand-total line depends on having a rate).

---

## 24. A note on accuracy

Every number in this app is an **estimate** computed from settings you configure — it is
not a substitute for your actual broker/exchange statement, and it is not financial advice.
See **Disclaimer & Privacy** (linked at the bottom of the sidebar) for the full legal text.
If a number here ever disagrees with your official statement, trust the statement.
