# FinaceMaster

FinanceManager live link:
<https://ranamrameez.github.io/FinaceMaster/>

> **Always update this README's Done/Pending sections for the latest developments and
> state whenever a feature lands, changes, or gets deferred.** This is the standing
> backlog/status doc for the project — keep it in sync with reality, not just with
> `CLAUDE.md` (which is continuity notes for an AI session, not a substitute for this).
>
> **Also (2026-08-23): tested changes are auto-committed and pushed without asking first,
> and the modules in `MODULES_PLAN.md` are being built in suggested order without waiting
> for per-step confirmation** — both by explicit user instruction. See `USER_MANUAL.md` for
> end-user-facing docs (kept up to date alongside this file).

## Done

3. QSE numbers in calculation are 4 digits (2.155, 21.55) — prices now display at 4
   significant figures (`fmtPrice` in `webapp/src/lib/format.ts`).
4. Multiple pages treated as one website: React rewrite (`webapp/`) with centralized CSS,
   shared components, a single router (HashRouter), and one Firebase sync layer shared
   across pages instead of per-page copy-paste.
5. PSX: CGT now correctly split 15% (filer) / 30% (non-filer) per the Settings-configured
   filer status, computed in `psxFees.ts`'s `calcCGT` and shown in the UI (Position detail,
   Trade Calculator).
6. PSX: fees now account for same-day round trips — the smaller leg of a same-day buy/sell
   is netted against the other rather than charged in full (`sameDayChargedSide` in
   `psxFees.ts`), and the Transactions list shows a "(netted)" tag on the netted leg.
7. PSX: app auto-detects and displays same-day vs. next-day fee/CGT outcomes (see #6 above
   and the CGT display in #5), **plus a manual override checkbox** (2026-08-23) — each
   transaction row (add form and both edit forms, in Transactions and per-stock pages) has
   a "Same-day override" checkbox (`Transaction.manualSameDay`) that forces netted
   (levies-only) fee treatment even when the recorded date doesn't line up with a real
   same-day round trip (e.g. settlement-date entry). `isNettedLeg()` in `psxFees.ts` is the
   single source of truth combining the manual flag with auto-detection; the "(netted)" tag
   shows ", manual" when it came from the override.
9. Trade Planner (2026-08-23) — save multi-leg trade plans, edit them, and "Mark as done"
   a leg to log it straight into transaction history without retyping it. Built for PSX
   (`webapp/src/features/psx/pages/TradePlannerPage.tsx`, route `/psx/trade-planner`), but
   the underlying data model (`TradePlan`/`TradePlanLeg` in `types/workbook.ts`) and store
   actions (`addTradePlan`/`updateTradePlan`/`deleteTradePlan`/`executeTradePlanLeg` in the
   shared `createWorkbookStore.ts`) are exchange-agnostic — QSE gets a Trade Planner page
   for free later, it just doesn't have one yet (not needed until asked for). This also
   resolves the old item 2 ("save multiple selling plans in the db") — same feature.
10. Multiple transactions can be entered at once — both QSE's and PSX's Transactions pages
    have a multi-row entry form (`rows.map(...)` in each `TransactionsPage.tsx`), not just
    one row at a time.
8. PSX: FIFO lot matching (2026-08-23) — each buy is now tracked as its own lot instead of
   blending into one running weighted-average cost, so a sell consumes the oldest open lot
   first ("each buy has its own sell peer") and realized P/L, invested amount, and CGT are
   all lot-accurate. New pure engine at `webapp/src/lib/calc/fifoPositions.ts`
   (`computeFIFOPositions`), returning the same `Position[]` shape as the original
   `computePositions` so it drops into `cashSummary`/the UI unchanged. **Opt-in, not the
   default** — a new `costBasisMethod: 'average' | 'fifo'` field in PSX Settings → "Fees &
   amounts" (defaults to `'average'`, i.e. today's unchanged behavior) — because switching
   it recomputes a real user's entire historical P/L under the new method, which must never
   happen silently. When FIFO is on, `PositionDetail` shows an "Open lots" table (buy date/
   price/remaining shares/cost-per-share) per ticker. QSE is untouched — `computePositions`
   itself was never modified, only added-to.
11. PSX: per-transaction editable fee override (2026-08-23) — `Transaction.feeOverride`
    (shared type, also usable by QSE) lets a transaction's total fee be manually set to
    reconcile against the real account statement; when present it wins outright over both
    the normal fee formula and same-day netting (checked first thing in both
    `makeQSEFeeCalculator` and `makePSXFeeCalculator`). UI: a "Fee override" input in the
    add-row and both edit-row forms (Transactions page and per-stock page); the Fee column
    shows an "(override)" tag when active. This is a single total-fee override, not a fully
    itemized per-line breakdown editor (commission/SST/CDC/etc. individually) — simpler and
    safer for now; a fully itemized editor is a possible future refinement if ever needed.
15. First-time Terms/Disclaimer acceptance gate (2026-08-23) — a blocking one-time modal
    (`components/TermsGateModal.tsx`, backed by `store/termsStore.ts`, its own localStorage
    key like `appearanceStore`) shows condensed risk/liability/no-advice disclaimers to
    every first-time visitor (signed in or not, since the legal exposure applies to anyone
    reading the numbers) and requires an explicit checkbox + "Accept & continue" before
    anything else is usable — no close button, no click-outside dismiss. Mounted at the
    `App.tsx` root with `z-index: 1000`, deliberately higher than the shared `.modal-overlay`
    (100) and the floating Calculator button (500), so it can't be clicked through. Full
    legal text remains at `/legal` (`LegalPage.tsx`, pre-existing) via the sidebar link.
16. App name + copyright now visible in the UI (2026-08-23) — "FinanceRecorder" header at
    the top of the sidebar and a "© {year} FinanceRecorder" line at the bottom
    (`components/Sidebar.tsx`). The browser tab title was already "FinanceRecorder"
    (`webapp/index.html`), but nothing showed inside the app itself before this.
20. New-modules plan written (2026-08-23) — see **`MODULES_PLAN.md`** at the repo root:
    per-module data model sketches, v1 feature scope, and build-order suggestion for
    Funds/Banking/Cash/Rentals plus two modules added after reviewing a user-supplied
    reference prototype (see **`reference/finance-suite-prototype/`**): **EMI/Loans**
    (structured amortization schedules, interest or fixed-total/Sharia-compliant mode) and
    **Personal Loans** (informal, bidirectional debt tracking) — plus a cross-entity
    transfer design sketch (item 19). Also locked in from that review: every new module's
    every record type must ship with edit-in-place from day one (not add/delete-only),
    category fields must be free-form/user-definable (not a fixed enum), and currency
    should be tracked per-entity, not per-module, with aggregates grouped by currency
    rather than converted. **Update (2026-08-23): building of these modules has started**,
    per direct user instruction to proceed through the build order without per-module
    check-ins — see the entries below for what's actually shipped so far.
21. Edit capability added to Transfers, Adjustments, Dividends, and Watchlist (2026-08-23) —
    these had been add/delete-only in both QSE and PSX (a real gap matching the "every entry
    must be editable" decision above, spotted while reviewing the reference prototype's own
    lack of this). New `updateTransfer`/`updateAdjustment`/`updateDividend`/
    `updateWatchlistItem` actions in the shared `createWorkbookStore.ts`; Transfers/
    Adjustments/Dividends got the same inline edit-row UX as Transactions, Watchlist got
    always-editable Target/Current price inputs (ticker itself stays remove+re-add, since
    it's the item's key). Verified live: edited a transfer's fee and a watchlist target,
    confirmed both persisted correctly.
22. **Cash module built (2026-08-23)** — the first of the new modules, per `MODULES_PLAN.md`'s
    suggested build order. Add/edit/delete cash-in/cash-out entries with a free-form
    category (autocomplete over your own previously-used categories, never a fixed list),
    per-entry currency, running balance and category breakdown grouped by currency,
    export/import/clear data. Find it at **More → Cash** in the sidebar (a minimal
    placeholder nav spot until item 18's category-dropdown redesign). Required a real
    architecture addition, not just new UI: `store/createEntryStore.ts`, a smaller sibling
    to `createWorkbookStore` for modules that are just "settings + one array of entries"
    (Cash's shape doesn't fit the stock-exchange-specific `BaseWorkbook`), and
    `useWorkbookCloudSync`'s type constraint was relaxed to a minimal
    `{ workbook, setWorkbook }` interface so both factories' stores share the same cloud-sync
    safety logic — see `MODULES_PLAN.md` §1 for the full detail. Verified live: sign-in gate
    fires correctly on add, edit persists and recalculates balances/category totals
    correctly, multi-currency entries stay properly separated (no fake conversion), no
    console errors.
23. **Personal Loans module built (2026-08-23)** — second new module, per
    `MODULES_PLAN.md`'s build order. Informal loans tracked in either direction (money you
    lent out / money you owe), net position summary grouped by currency, per-loan repayment
    logging with full edit/delete support. Find it at **More → Personal Loans**. Has two
    related arrays (loans + repayments) so it's hand-written following the same store idiom
    rather than forced through `createEntryStore`. **A real bug was hit and fixed during this
    build**: a zustand selector that filtered an array *inside* the selector callback
    (`(s) => s.workbook.repayments.filter(...)`) caused a genuine infinite-render loop
    ("getSnapshot should be cached") — fixed by selecting the raw array and filtering in a
    `useMemo` instead. Documented in `MODULES_PLAN.md` §6 as a rule for any future module:
    select raw state, derive in `useMemo`, never inside the selector. Verified live in a
    fresh browser tab after the fix (the bug was initially hard to pin down because a
    long-lived dev tab with repeated hot-reloads showed stale errors even after the fix
    landed — a fresh tab/hard reload was needed to confirm).

## Pending

1. QSE: H1 EPS/fundamentals data is still hard-coded in `webapp/src/lib/stockData/qseSeed.ts`
   as a fallback. The intended shared `stockData/QSE` Firebase node (finance data belonging
   to no single user) exists as a concept the app already prefers when present, but it
   hasn't actually been seeded in Firebase yet — needs real seeding, ideally via the
   scheduled-refresh-job architecture described under item 13 below, not manual entry.
12. Ability to read account statement PDFs/Excel files to auto-populate trade history.
13. Find APIs to fetch symbols, logos, stock prices, historical data, and finance news —
    **architecture constraint locked in 2026-08-23**: these must never be called live from
    the app itself (free/cheap tiers rate-limit fast). Fetch on a schedule (cron/worker)
    into our own database and serve the app from that store, same pattern already used for
    QSE's `stockData/QSE` node (item 1 above) and PSX's bundled `psxSeed.ts`.
14. Include console-like/super-compact UI themes — a `density` appearance setting
    (comfortable, in `appearanceStore.ts`) exists already, but no dedicated console-style
    compact theme yet.
17. Charts should be dynamic — filterable (date range, ticker, category) and otherwise more
    interactive, not just static renders of whatever the page computes. Not started.
18. Sidebar navigation should become a proper category dropdown — "Stock Exchanges / Funds /
    Banking / Cash / Rentals" — with the selected category clearly highlighted, generalizing
    today's QSE/PSX-only `ExchangeSwitcher` chip pair (`components/Sidebar.tsx`). Only "Stock
    Exchanges" would be functional at first (leading to today's QSE/PSX pages); the other
    categories wait until their modules exist (see item 19 below and the locked sequencing
    decision under Done item 20).
19. Cross-entity transaction linking — e.g. a transfer FROM a Bank module TO a stock
    exchange's cash balance, or Cash to Bank, so money moving between modules is one linked
    record instead of two independent, easily-inconsistent entries. Depends on the Funds/
    Banking/Cash modules existing first (none of them are built yet — see the Migration Plan
    Overview below and item 20).

**Also locked in 2026-08-23**: no bank account API / open-banking integration for now (SBP/
QCB both require regulator licensing — a compliance process, not a coding task). When bank
transaction tracking is eventually built, the primary path is manual entry + statement
upload/parsing (same shape as item 12 above), with SMS/email alert parsing as an optional,
later, additive input source — not something to design the core architecture around.

-------- -----------

# Migration Plan Overview 

## Migration from plain HTML FinanceMaster app to React JS FinanceRecorder app

## Idea:

React and node based or more secure tech for a Fintech app. 
Primarily I'm focusing on Pakistan stock exchange and Qatar stock exchange in first phase. Also banks from the same countries. Although other than stock exchanges, other app features can be used globally. 
1. QSE & PSX stock tracking, calculations and trade planning
2. Feeding and tracking banking transactions including cards spendings.
3. Cash tracking
4. Expense tracking
5. Mutual funds tracking and performance analysis
Monitoring, Analysis and planning for all of these.
6. Phase 2 (financial news, Fintech apis integration).

Suggest me app name which isn't used online yet. In my mind *finance recorder*, finance tracker, finance guru, finance master.

## Preferred App Name: 

**FinanceRecorder**

## Plan

Include each and evrything from our FinanceMaster app.
Develop FinanceGuru app which will be React JS based. All shared components should be extracted developed separately. Then we can have Specialized components for each Stock Exchange. User can switch between Exchanges to view and modify his portfolio. For both PSX and QSE we have real trade data to verify our formulas and calculations.
