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
24. **Banking module built (2026-08-23)** — third new module, per `MODULES_PLAN.md`'s build
    order. Multiple bank accounts (one currency each), manual transaction entry with running
    balance and free-form category breakdown, and **CSV statement import**: pick a file,
    map which detected column is Date/Description/Amount (a "flip sign" toggle covers banks
    that export spending as positive numbers), preview the first 5 mapped rows, then import.
    Find it at **More → Banking**. New `lib/csv.ts` (a small dependency-free CSV parser —
    quoted fields, escaped quotes, CRLF) and `lib/calc/bankModule.ts` (running balance,
    per-currency totals, category breakdown), both tested. Hand-written store again (a third
    distinct shape: accounts nested under settings, transactions top-level) following the
    same idiom as Cash/Personal Loans. Verified live in the browser: sign-in gate on add and
    on import, CSV column-mapping and preview work correctly against a synthetic statement,
    account/transaction edits recalculate balances correctly, no console errors.
25. **EMI/Loans module built (2026-08-23)** — fourth new module, per `MODULES_PLAN.md`'s
    build order. A loan repaid on a fixed schedule (mortgage, car financing, etc.) with an
    auto-calculated amortization schedule, either **interest rate (reducing balance)** or
    **fixed-total-to-return (no-interest/Sharia)** mode — both formulas ported from the
    reference prototype and hand-traced in tests. Find it at **More → EMI / Loans**. Only
    one array (no repayments log — it's a computed schedule), so it reuses `createEntryStore`
    (the same factory Cash uses) by naming the data model's array `entries` instead of
    `loans`. Verified live in a fresh browser tab: sign-in gate on add, schedule and summary
    stats matched hand-calculated expectations for both a standard mortgage and a
    no-interest loan, edit recalculates the whole schedule immediately, delete confirms and
    removes correctly — no bugs this time (checked every selector against the rule learned
    from the Personal Loans bug before shipping).
26. **Funds module built (2026-08-23)** — fifth new module, per `MODULES_PLAN.md`'s build
    order. Mutual fund unit holdings: add a fund (name, code, platform, category, currency),
    buy/sell units at a NAV per unit, update current NAV, and see units held, invested,
    current value, net profit, and **XIRR** (a proper time-weighted return, ported from the
    reference prototype's Newton-Raphson + bisection algorithm — not just a flat percentage).
    Find it at **More → Funds**. Unlike every other new module, this one genuinely reuses
    the *full* `createWorkbookStore` factory (the same one QSE/PSX use) — a fund's `id` plays
    the role of `ticker` in `Transaction` records, so `computePositions`/`cashSummary`/
    `marketPrices`/`priceHistory` all work with zero changes to any shared calc file. New
    `lib/calc/xirr.ts`, tested against an exact-10%-return hand-traced case. Verified live in
    a fresh browser tab against the reference prototype's own worked example (two buys
    totaling $7000, NAV rising to $214): position rollup, value, P/L%, and XIRR all matched;
    NAV update and transaction edits recalculate everything live; sign-in gate fires on both
    fund-add and NAV-update; no console errors.
27. **Rentals module built (2026-08-23) — sixth and final planned new module.** Rental
    property income/expenses (not buy/sell trades): properties (name/currency/purchase
    price), rent income and categorized expenses per property, net income by currency,
    category breakdown, monthly rollup. Find it at **More → Rentals**. Same shape as
    Banking (properties nested under settings, entries top-level) — hand-written store
    following that same idiom. Verified live: net income/category/monthly-rollup all
    correct against hand-traced numbers, edits recalculate live, sign-in gates fire
    correctly, no console errors. **All six modules from `MODULES_PLAN.md` are now built**:
    Cash, Personal Loans, Banking, EMI/Loans, Funds, Rentals.
28. **Sidebar category dropdown (2026-08-23), README item 18.** Replaced the flat "Stocks"
    heading + "More" link list with one dropdown (`components/CategoryNav.tsx`) spanning
    every module — Stock Exchanges, Funds, Banking, Cash, Personal Loans, EMI/Loans, Rentals
    — with the active category highlighted (checkmark) and derived from the current route
    (`categoryForPath`), same pattern as the existing QSE/PSX `ExchangeSwitcher`. Picking
    "Stock Exchanges" still shows the QSE/PSX chip switcher and that exchange's full page nav
    underneath, since it's the only category with more than one page; every other category
    navigates straight to its single module page. Old "Find it at More → X" phrasing in
    earlier Done entries above is now just "the sidebar" — the flat More list is gone.
    Verified with a scripted Playwright pass (no manual browser available in this session):
    dropdown opens/closes, navigates to each category, highlights the active one correctly,
    and switching back to Stock Exchanges restores the exchange chips + nav; `npm run build`
    and `npm run test` both clean, no console errors.
29. **Cross-entity transaction linking (2026-08-23), README item 19 / MODULES_PLAN.md §7 —
    v1 scope: Cash↔Bank and Bank↔QSE/PSX cash balances.** New "Transfers" category/page
    (`features/transfers/pages/TransferLinksPage.tsx`, `components/CategoryNav.tsx`) lets a
    money movement between two modules be entered once and creates a real, linked record on
    both sides — editing or deleting the link later updates or removes both. Real prerequisite
    found and fixed first: `Transfer` (QSE/PSX) and `CashEntry` had no stable `id` at all,
    only array-index addressing (`updateTransfer(index, ...)`) — exactly the two record types
    the v1 scope needs to reference. Added `id: string` to both types; `createWorkbookStore.ts`
    and `createEntryStore.ts` now normalize missing ids on every path data enters a store
    (local load *and* `setWorkbook`, which also covers the Firebase pull in
    `useWorkbookCloudSync` — real user data written before today has no `id` in storage and
    JSON parsing doesn't enforce the TS type) so old data keeps working. `updateTransfer`/
    `deleteTransfer` and Cash/EMI's shared `createEntryStore`'s `updateEntry`/`deleteEntry`
    switched from index- to id-based addressing; `BankTransaction`/`EMILoan` already had ids
    so neither module's data model changed. QSE/PSX `Transaction`/`Adjustment`/`Dividend`
    were deliberately left index-based — out of scope, since linking only ever touches
    Transfers, not trades. New pure `lib/interEntityLink.ts` (`buildLinkedRecords`,
    `isSupportedLinkPair`) computes the two side records + the link record from user input
    with no store access, reused as-is for both create and edit; tested in
    `lib/__tests__/interEntityLink.test.ts` (sign conventions per module, both directions,
    missing-account error, edit reusing the same ids). The link records themselves live in a
    new `interEntityTransfersStore.ts` (reuses `createEntryStore`) with its own Firebase path
    (`users/{uid}/interEntityTransfers`). No currency conversion (no live FX-rate source, per
    the cross-cutting decision) — the form shows each side's resolved currency and warns on a
    mismatch rather than blocking it. **Verified live in the browser** (no real Firebase test
    account used, to avoid writing to the production project outside the user's own account —
    see this file's Data safety / cloud-sync-safety notes): the Transfers page renders with no
    console errors, the unsupported-pair warning fires correctly for an out-of-scope pairing
    (e.g. Cash→QSE), the currency-mismatch warning fires correctly (USD vs QAR), the
    missing-bank-account guard fires correctly, and `npm run build` / `npm run test` (84
    tests, 8 new) are both clean. The actual signed-in create/edit/delete round-trip through
    real Cash/Bank/QSE/PSX stores was **not** exercised end-to-end in the browser this
    session — only via the pure-function unit tests above — since doing so would need either
    the user's real signed-in session or a throwaway Firebase Auth account against the same
    production project; a future session with the user present should click through one real
    linked transfer (create, edit its amount, delete it) and confirm both sides update.
30. **Doc correction: console-style compact theme (item 14) was already built, just never
    marked Done.** `html[data-density="console"]` rules in `theme.css` (tighter card/table/
    button padding, smaller monospace-leaning type) and the "Console (super compact)" option
    in `AppearancePanel.tsx`'s density selector have existed since the original React rewrite
    commit — this was a stale Pending entry, not missing functionality. Re-verified live in
    the browser (2026-08-23): switching density to Console visibly shrinks stat cards, page
    titles, and the sidebar with no console errors. Moved to Done; no code changed.
31. **Dynamic/filterable Analytics charts (2026-08-23), README item 17 — ticker + month-range
    filters, QSE and PSX both.** New `ChartFilterBar` (`components/ChartFilterBar.tsx`) at the
    top of both Analytics pages: toggle-chip ticker selection ("All" or any combination) plus
    a from/to month-range picker. Deliberately **doesn't** re-derive positions/cost-basis/P&L
    for a filtered window — filtering "current holdings" to a date range would misrepresent
    them (a stock bought two years ago and still held would show as "no position" under a
    last-3-months filter). Instead `lib/calc/chartFilters.ts`'s pure helpers
    (`filterRowsByTicker`, `filterTuplesByTicker`, `filterMonthlySeries`,
    `filterMonthlyDualSeries` — tested in `chartFilters.test.ts`, 11 tests) post-process the
    *already-computed* per-ticker rows and per-month series feeding each chart: ticker
    filtering narrows ROI%/allocation/P&L-by-symbol/holding-period/dividends-by-ticker to the
    selected tickers, month filtering narrows monthly-activity/dividends-by-month/fees-by-month
    to the selected window. Whole-portfolio single-number charts (realized vs unrealized P/L,
    cash vs stocks split, fees breakdown, deposits vs invested, and the cumulative cash-balance
    line chart) are left as global totals on purpose — the filter bar says so directly, and
    trying to filter a *cumulative running balance* to a sub-range doesn't have a sensible
    starting point anyway. **Category filtering (also named in this item) doesn't apply here**
    — QSE/PSX trades have no category field; that dimension belongs to Cash/Bank/Rentals, which
    don't have Analytics/chart pages yet. Verified live in the browser with a seeded two-ticker,
    three-month workbook: ticker chips correctly narrow every per-ticker chart and the
    Fundamentals table; the month-range picker correctly narrows monthly charts (confirmed
    "Monthly trading activity" and "Dividend income by month" both collapsed to just the
    selected month) while "Dividend income by ticker" — a lifetime-per-ticker total, not
    month-indexed — correctly stayed unaffected by the month filter; zero console errors.
    `npm run build` / `npm run test` (95 tests, 11 new) both clean.
32. **Calculator button made module-aware (2026-08-23), README item 22.** The floating
    Calculator button (`components/CalculatorLauncher.tsx`) used to render unconditionally on
    every page and default to the QSE stock Trade Calculator anywhere that wasn't `/psx/*` —
    including Cash/Bank/EMI/etc, where a stock calculator makes no sense. Now hidden entirely
    outside Stock Exchanges routes (`categoryForPath(...) === 'stocks'`) until each module has
    its own relevant calculator (see Pending item 22's remainder, and item 23). Verified live:
    the button shows on Dashboard/Analytics/Risk Analysis, disappears on Cash, no console
    errors.
33. **Native Risk Calculator (2026-08-23), README item 20.** Replaces the sidebar's link-out
    to the legacy `Risk_Analysis_Calculator.html` with a real React page at `/risk-analysis`
    (QSE) and `/psx/risk-analysis` (PSX) — an averaging-down planner for an existing open
    position: current break-even/recovery-needed/net-P&L, a scenario table of "add this much
    capital → new average/break-even/net-P&L-at-target" across a capital ladder, a
    diminishing-returns signal, and a stress test on the resulting position at several price
    drops. New `lib/calc/riskAnalysis.ts` (pure, tested — 9 tests) ports the legacy page's
    logic with two deliberate fixes rather than a blind copy: (1) reuses the app's real
    iterative `breakEvenPrice` solver instead of the legacy's closed-form formula that assumed
    a flat % fee — this makes the calculator correct for PSX's tiered/same-day-netted fee
    model too, not just QSE's flat percentage; (2) includes the buy-side fee in a hypothetical
    new purchase's cost basis (the legacy version omitted it, understating the resulting
    break-even). Also dropped: the legacy page's hardcoded "MPHC/IQCD = severe risk" headline
    special-case — that was leftover from one person's real portfolio holdings, not a
    generalizable rule, and porting it into shared app code would have baked someone's
    specific positions into a universal calculator. New shared `components/RiskCalculator.tsx`
    (one implementation, QSE and PSX each pass their own rows/fee-calculator/settings — same
    pattern as `useChartData`/`ChartFilterBar`), with thin per-exchange page wrappers. The
    legacy `Risk_Analysis_Calculator.html` file itself is left in place for now — deleting it
    needs explicit approval per this file's existing "don't delete legacy apps" rule, not
    assumed as part of this change. Verified live in the browser with a seeded underwater
    position (bought at 12, market price 9): break-even/recovery/scenario-table/stress-test
    numbers all matched hand-expectations, the empty state (no open positions) renders
    correctly, PSX's version loads with its own fee model, zero console errors. `npm run
    build` / `npm run test` (104 tests, 9 new) both clean.
34. **Cross-entity linking: real multi-currency amounts + Rentals added (2026-08-23),
    README item 21.** `InterEntityTransferInput`'s single shared `amount` field is now
    `fromAmount`/`toAmount` — two independent numbers, one per side's own currency. No live
    FX-rate lookup (unchanged locked decision): a genuinely cross-currency transfer (e.g. a
    USD bank account to PKR cash) needs the user to enter both amounts from whatever real
    conversion actually happened. The create form defaults to one shared amount (the common
    same-currency case) and reveals a second "Amount received" field only when "Different
    amount on the other side" is checked; the edit row and the linked-transfers table always
    show both amounts as separate columns for transparency. Also **added Rentals as a fifth
    linkable module** (Bank/Cash&harr;a specific property — a rent payment in becomes
    `RENT_INCOME`, an expense paid out becomes `EXPENSE`) after investigating it per this
    item's own todo: `RentalEntry` already used stable-id addressing (`updateEntry(id, ...)`),
    so — unlike Personal Loans (still `(loanId, index)`-addressed, needs the same retrofit
    `Transfer`/`CashEntry` already went through) or EMI (no repayment ledger to link into at
    all) — no data-model retrofit was needed, making it a same-day addition rather than a
    separate future pass. Verified live in the browser: selecting a cross-currency pair shows
    the correct warning and reveals the second amount field; selecting Rentals as either side
    shows a property picker with the correct currency resolved from that property; the
    Cash→Rentals path reaches the sign-in gate cleanly with no errors. `npm run build` /
    `npm run test` (108 tests, 3 new) both clean. **Still open**: Personal Loans (needs the id
    retrofit) and Funds (needs its hidden `Transfer` field exposed in the UI first) remain
    unlinked; EMI has no repayment ledger at all to link into (a data-model question, not an
    oversight).
35. **Cross-entity linking: cascade deletes + create/update failure handling (2026-08-23) —
    code-review fix on PR #2.** A real reviewer (Sourcery) flagged two gaps in the v1 linking
    feature: (1) creating a link wrote to three separate stores with no rollback if a later
    write failed, risking a one-sided orphan reported as success; (2) deleting a linked record
    directly from its *native* module (Cash's ledger, Bank's transactions, QSE/PSX transfers,
    Rentals entries) — instead of from the Transfers page — just removed that one row, leaving
    the link pointing at a missing id and the other side still present. Both fixed. New
    `lib/linkCascade.ts` centralizes the store-dispatch switch statements (moved out of
    `TransferLinksPage.tsx`) plus: `createLinkedTransfer` (rolls back the first side if the
    second write throws — honest about this being defense-in-depth, not a real database
    transaction, since a client-only app with per-store localStorage + independently-debounced
    Firebase pushes can't be made genuinely atomic), `updateLinkedTransfer` (reports a failure
    honestly rather than claiming a rollback it can't actually do for edits), `deleteLinkCascade`
    (removes both sides + the link record together), `findLinkForRecord`, and
    `confirmAndDeleteLinkable` — every native delete button across all 5 linkable modules now
    calls this instead of deleting directly, so removing either side of a link from *anywhere*
    cascades identically to deleting it from the Transfers page. Known remaining gap, stated
    explicitly rather than silently left: *editing* (not deleting) a linked record's amount/date
    directly in its native module still doesn't propagate to the other side — full correctness
    there would need every edit form to know it's touching a linked record, a larger UI change
    not attempted here. New tests in `lib/__tests__/linkCascade.test.ts` (5 tests) cover
    create/rollback/find/update/cascade-delete against real store instances (not mocks).
    `npm run build` / `npm run test` (113 tests, 5 new) both clean; verified live that all 5
    modules' pages still render with zero console errors after the wiring changes (the actual
    authenticated delete-cascade click-through needs a real signed-in session, same caveat as
    the rest of this linking feature).
36. **Critical: signing out didn't clear local data (2026-08-23), user-reported.** Every
    module's Zustand store persists to its own localStorage key and only overwrites itself on
    an explicit local write or a cloud pull — `signOutUser()` only called Firebase's own
    `signOut()`, so QSE/PSX/Cash/Bank/Personal Loans/EMI/Funds/Rentals/linked-transfers data
    all stayed sitting in memory and in localStorage after logging out. The next person to use
    the browser (or the same person signing into a *different* account) would see the previous
    account's data — and could hit the existing "cloud looks empty, upload local data?" prompt
    and push the previous account's data into their own new cloud path. Fixed centrally in
    `lib/firebase/useAuthState.ts` (the single shared auth listener every module's sync already
    reads from) rather than only at the explicit "sign out" button: a new `resetAllLocalWorkbooks()`
    (`lib/resetLocalData.ts`) clears all 9 per-account stores back to empty (in memory *and*
    in localStorage) whenever `onAuthStateChanged` reports a transition away from a *previously
    known* signed-in uid — sign-out, or switching accounts. Deliberately does **not** fire on
    the very first callback of a page load (a returning signed-in user's local data legitimately
    belongs to them) and deliberately does **not** touch `appearanceStore`/`termsStore` (global
    browser preferences, not per-account data, per this app's existing design rule). New test
    `lib/__tests__/resetLocalData.test.ts` seeds every store and confirms a full reset, including
    that the emptied state is actually persisted to localStorage (not just in-memory) so a reload
    immediately after logout can't bring the old data back.
37. **Google logo on the "Sign in with Google" button (2026-08-23), user-reported.** Was a
    plain blue-circle emoji (🔵) placeholder. New `GoogleIcon` in `components/icons.tsx` — the
    real 4-color Google "G" mark (fixed brand colors, the one deliberate exception to this
    file's otherwise-`currentColor` stroke icons) — wired into `SignInModal.tsx`.
38. **Investigated but could not reproduce: "only a toast shows instead of the sign-in popup"
    (2026-08-23), user-reported.** Tested both primary sign-in entry points locally — the
    sidebar's "Not signed in — tap to sign in" button, and a gated write action (adding a Cash
    entry while signed out) — and both correctly open the real `SignInModalHost` popup, not a
    toast, with zero console errors. Couldn't find a code path anywhere that shows a toast in
    place of opening the modal. This may be specific to the live deployed site in a way this
    session's local dev server didn't reproduce, or may already be stale (fixed by something
    else today) — needs a specific page/button from the user to chase further if it recurs.
39. **Personal Loans added as a sixth linkable module (2026-08-23), README item 21's first
    part.** `PersonalLoanRepayment` got the same stable-id retrofit already done for `Transfer`
    and `CashEntry`: added `id: string`, a `ensureRepaymentIds()` normalizer in
    `personalLoansWorkbookStore.ts` (applied on local load and on every `setWorkbook`, so real
    repayments saved before today keep working without a manual migration step), and switched
    `updateRepayment`/`deleteRepayment` from `(loanId, index)` compound addressing to plain
    `(id)` — `PersonalLoansPage.tsx`'s repayment table updated to match. With a stable id in
    place, Personal Loans slots into the existing linking architecture the same way Rentals did:
    `buildSideRecord` in `lib/interEntityLink.ts` gained a `'personalLoans'` case producing a
    `PersonalLoanRepayment` against the picked loan — deliberately ignoring the link's
    `direction` (a repayment's amount is always positive regardless of which way the debt runs
    or which side of the link it's on, unlike every other module's side record), and
    `isSupportedLinkPair` now allows Bank&harr;Personal Loans and Cash&harr;Personal Loans.
    `lib/linkCascade.ts`'s three dispatch switches and `TransferLinksPage.tsx`'s `SideFields`/
    `moduleLabel`/currency-resolution all got a `personalLoans` case, following the exact same
    pattern as the Rentals property picker (a "Loan" `<select>` keyed by `PersonalLoan.id`,
    showing the person's name + currency). The repayment delete button in
    `PersonalLoansPage.tsx` now goes through `confirmAndDeleteLinkable` like every other
    linkable module, so deleting a linked repayment there cascades to the other side instead of
    orphaning the link. New tests: `lib/__tests__/interEntityLink.test.ts` (Bank→Personal Loans,
    Personal Loans→Cash, missing-ref throw) and `lib/__tests__/linkCascade.test.ts` (create +
    cascade-delete against real store instances). Verified live in the browser with seeded
    localStorage (a bank account + a PKR personal loan, no sign-in needed since this only
    exercises the form's local state): the "Personal Loans" module option appears in both side
    pickers, selecting it reveals a "Loan" picker listing the seeded loan by name and currency,
    and the Cash(USD)/loan(PKR) pairing correctly triggers the existing currency-mismatch
    warning — zero console errors. `npm run build` / `npm run test` (119 tests, 6 new) both
    clean. **Still open** (README item 21's remainder): Funds (needs its hidden `Transfer`
    field exposed in the UI first) remains unlinked; EMI has no repayment ledger at all to link
    into (a data-model question, not an oversight).
40. **Cash gained CSV import (2026-08-23), README item 25's first part (browser-only CSV/JSON
    scope).** Extends the exact "map these columns" pattern already proven in Banking's
    statement import (`lib/csv.ts` + `BankPage.tsx`'s `ImportTab`) to Cash's new `ImportTab` in
    `CashPage.tsx`. Cash entries don't have Bank's single signed `amount` field, so the mapped
    Amount column's sign (after an optional "Flip sign" checkbox) decides IN vs OUT and the
    stored `amount` is always the absolute value; Date and Amount are required, Category is
    optional. A single Currency picker applies to the whole imported batch (Cash entries are
    per-entry-currency, but a CSV export is realistically all one currency). `CashEntry.source`
    widened from `'manual'`-only to `'manual' | 'statement-import'`, plus a new
    `statementRef?: string` (mirrors `BankTransaction`) — the entry list's new "Source" column
    shows "Import (filename.csv)" vs "Manual", matching Banking's existing convention. New
    generic `addEntries()` bulk-add action on `createEntryStore.ts` (mirrors
    `bankWorkbookStore.ts`'s `addTransactions`) avoids re-persisting to localStorage once per
    imported row. Verified live via Playwright with a real 3-row synthetic CSV file upload (not
    just seeded localStorage): the preview correctly shows "Cash in"/"Cash out" derived from
    sign, category mapping applies live, and clicking Import correctly hits the sign-in gate
    (not tested past that point — same real-Firebase-project caveat as the rest of this app's
    write-path verification) — zero console errors. `npm run build` / `npm run test` (119
    tests, unchanged — this feature's logic lives in the page component, same as Banking's
    import, not a separately unit-tested pure function) both clean. **Still open**: Personal
    Loans repayments and Rentals entries (also named in item 25) don't have CSV import yet;
    PDF/image import still needs the separate Python backend (locked decision, real infra).
41. **CSV import extended to Rentals and Personal Loans (2026-08-23) — completes README item
    25's browser-only CSV/JSON scope.** Same pattern as Cash's `ImportTab` (Done item 40).
    **Rentals**: `RentalEntry` gained optional `source`/`statementRef` fields; a new "Import"
    tab in `RentalsPage.tsx` maps Date/Amount/Category columns for one selected property, with
    the Amount column's sign (plus an optional "Flip sign" checkbox) deciding RENT_INCOME vs
    EXPENSE, same convention as Cash. **Personal Loans**: `PersonalLoanRepayment` gained the
    same optional `source`/`statementRef` fields; a new "Import repayments (CSV)" section
    inside each loan's detail view (`LoanDetail` in `PersonalLoansPage.tsx`, below the existing
    repayments table) maps just Date + Amount — no sign/flip needed here, since a repayment is
    always a positive amount regardless of which way the loan runs (same reasoning as this
    module's linking-side-record logic from Done item 39). Both modules' entry lists gained a
    "Source" column (Manual vs. "Import (filename)"), matching Banking/Cash's existing
    convention. New generic `addEntries()` on `rentalsWorkbookStore.ts` and `addRepayments()`
    on `personalLoansWorkbookStore.ts` (both hand-written stores, so each needed its own bulk
    action — `createEntryStore.ts`'s shared `addEntries()` from Done item 40 doesn't apply to
    either since neither module uses that factory). Verified live via Playwright with two real
    synthetic CSV file uploads: Rentals' preview correctly derives Rent income/Expense from
    sign, and Personal Loans' preview correctly shows the mapped repayment amounts inside a
    loan's detail view — both correctly hit the sign-in gate on Import, zero console errors.
    `npm run build` / `npm run test` (119 tests, unchanged) both clean. **README item 25 is now
    fully done for its browser-only CSV/JSON half** — only PDF/image import (needs the separate
    Python backend, a locked but not-yet-started decision) remains.
42. **Follow-up code-review fix on PR #2 (2026-08-23), spotted by Sourcery in a second review
    pass the user flagged after the PR had already merged.** `createLinkedTransfer`'s rollback
    (Done item 35) only tracked the `from` side's module, so if the *link-store* write
    (`useInterEntityTransfersStore`'s `addEntry`) threw after **both** side records had already
    been written successfully, the catch block rolled back `from` but left `to` (e.g. the bank
    transaction) as an orphaned, unlinked record — a real gap in what was already meant to be a
    rollback fix. Fixed in `lib/linkCascade.ts` by tracking every side actually written (a
    `written: {module, id}[]` array, pushed to right after each successful `dispatchAdd`) and
    rolling back all of them, in every failure branch including the final link-store write —
    not just the first side. New regression test in `lib/__tests__/linkCascade.test.ts` uses
    `vi.spyOn` to make the link-store's `addEntry` throw *after* both side writes have already
    succeeded, and confirms both the Cash and Bank records get rolled back (the old code would
    have left the Bank transaction behind). `npm run build` / `npm run test` (120 tests, 1 new)
    both clean.
43. **New "Planning" scenario planner for Cash and Banking (2026-08-23), user-requested — a
    guardrail against overspending.** The user's own framing: "a mental deception to stop the
    user from overspending... give a realistic idea about what happens if he spends on
    something." New `PlannedCashEntry`/`PlannedBankTransaction` types (`types/plannedCash.ts`,
    `types/plannedBank.ts`) follow the same "separate plan, mark as done converts it into a
    real entry" pattern already proven by the QSE/PSX Trade Planner (`TradePlan`/
    `TradePlanLeg`) — a plan stays around after being marked done, flagged `executed`,
    independent of the real `CashEntry`/`BankTransaction` it created (never deleted or mutated
    into it). Both plan types fit `createEntryStore`'s generic shape directly (`{settings,
    entries}` with an `id`-addressed array), so `plannedCashWorkbookStore.ts`/
    `plannedBankWorkbookStore.ts` are two-line factory calls — deliberately kept as **separate
    stores** from the main Cash/Bank workbooks (own localStorage keys, own Firebase paths
    `users/{uid}/plannedCash`/`plannedBank`) rather than a second array bolted onto
    `CashWorkbook`/`BankWorkbook`, so this new feature carries zero migration risk to existing
    real user data. New pure `lib/calc/plannedBalance.ts` (`plannedCashProjection`/
    `plannedBankProjection`, both tested — 8 hand-traced cases in
    `plannedBalance.test.ts`) computes **Real** (actual entries only) vs. **Planned** (real +
    every not-yet-executed plan) balance per currency; executed plans are excluded from the
    delta since they already created a real entry counted in "Real". New "Planning" tab on
    both `CashPage.tsx` and `BankPage.tsx`: a balance-projection summary card with **two
    checkboxes the user controls directly** ("Real balance" / "Planned balance," both default
    on) — per the user's explicit ask to let them choose what they want to see rather than the
    app deciding for them — plus an add-plan form and a plan list with Edit/Delete/"Mark as
    done" per row. Each module's own "Account" cloud-sync section (with the standard
    never-auto-upload-on-empty-cloud safety button) is repeated inside the Planning tab for the
    new plan stores, matching the same cloud-sync-safety pattern used everywhere else in this
    app. Verified live via Playwright with seeded localStorage (both a real entry and a
    not-yet-executed plan): the projection summary showed the correct Real (1000)/Planned (700)
    numbers for Cash and Real (500)/Planned (300) for Banking, unchecking "Planned balance"
    correctly hid that line, and "Mark as done" correctly hit the sign-in gate (not tested past
    that point — same real-Firebase-project caveat as the rest of this app's write-path
    verification) — zero console errors. `npm run build` / `npm run test` (128 tests, 8 new)
    both clean. **Deliberately not done in v1** (kept small on purpose, can be revisited if
    asked for): Personal Loans/Rentals/EMI/Funds don't get a Planning tab yet; a plan can't be
    linked into the cross-entity Transfers system; there's no reminder/notification for a
    plan's expected date arriving.
44. **Cash Analytics tab (2026-08-23), README item 23's first module — per-module Analytics
    &amp; Planning.** Three charts as sketched in `MODULES_PLAN.md` §11: a category-breakdown
    doughnut, an income-vs-expense-by-month bar chart, and a balance-over-time line chart —
    all built on already-computed data (`cashByCategory`, `cashRunningLedger`) plus one new
    pure function, `cashMonthlyFlow()` in `lib/calc/cashModule.ts` (3 new hand-traced tests).
    Since a Cash workbook can hold entries in more than one currency (never converted, per
    this app's cross-cutting rule), a currency picker selects which currency's charts to show
    — only rendered when more than one currency is actually present, mirroring how QSE/PSX
    don't need this (one currency per exchange). Reuses `features/qse/components/ChartCard`
    cross-module (PSX's `AnalyticsPage.tsx` already does the same — not a new pattern) rather
    than duplicating it a third time. New "Analytics" tab added to `CashPage.tsx` alongside
    Ledger/Planning/Import/Settings. Verified live in the browser with seeded multi-currency
    data: all three charts rendered (confirmed via `<canvas>` element count), the currency
    picker correctly switched the charts' data when toggled between USD and PKR, zero console
    errors. `npm run build` / `npm run test` (131 tests, 3 new) both clean. **Next up per
    MODULES_PLAN.md §11's suggested build order**: Personal Loans, then Banking, EMI/Loans,
    Funds, Rentals — this is "several modules' worth of work," so treat each as its own pass.
45. **Personal Loans Analytics tab (2026-08-23), README item 23's second module.** The three
    pieces sketched in `MODULES_PLAN.md` §11: an outstanding-by-loan bar chart (color-coded
    green/red by direction — money lent out vs. money owed — and kept **per loan**, not
    netted per person, since netting two loans with the same person but opposite directions
    into one bar would hide which is which), a repayments-by-month bar chart, and a "payoff
    planner." Two new pure functions in `lib/calc/personalLoansModule.ts`:
    `outstandingByLoan()` and `repaymentsByMonth()` (both tested), plus `projectPayoff()` for
    the planner — a simple linear "months to clear the remaining balance at a given monthly
    rate" projection (no interest/compounding concept for an informal debt, unlike EMI/Loans;
    returns `null` rather than an infinite/NaN result when the rate can't ever clear the
    balance). New "Analytics" tab (with the same per-currency picker pattern as Cash's, shown
    only when more than one currency is actually present) added alongside the existing loan
    list, now both under a `Tabs` wrapper. The payoff planner itself lives inside a loan's own
    detail view instead of the Analytics tab, since it needs one specific loan's current
    outstanding balance to project from — it's a live, unsaved "what if" calculator, not a
    persisted plan. Verified live in the browser: both charts rendered (confirmed via
    `<canvas>` count), and the payoff planner's math checked out by hand (a loan with 700
    outstanding at a 100/month input correctly projected "7 months") — zero console errors.
    `npm run build` / `npm run test` (138 tests, 7 new) both clean. **Next up**: Banking,
    EMI/Loans, Funds, Rentals.
46. **Critical: Personal Loans cloud sync error, user-reported (2026-08-23) — root cause
    was systemic, not Personal-Loans-specific.** Firebase Realtime Database's `set()`
    validates its argument tree synchronously and throws (before even returning a promise a
    `.catch()` could see) if it contains a literal `undefined` anywhere. Several add-forms
    across modules write `field: x?.trim() || undefined` for an empty optional field —
    `PersonalLoansPage.tsx`'s `AddLoanForm` does this for `note`, and the same pattern exists
    in Bank/Cash/Rentals/PSX Trade Planner/Transfers. A loan (or entry) saved without that
    optional field carried a literal `undefined` in the store, which crashed the push the
    moment `useWorkbookCloudSync.ts`'s debounced sync tried to write it — reproducing exactly
    as "personal loan data facing error while cloud sync," but only because that's the form
    the user happened to test without filling in every optional field. Fixed at the root
    rather than patching each call site: new `stripUndefinedDeep()` in
    `useWorkbookCloudSync.ts` round-trips the payload through `JSON.parse(JSON.stringify(...))`
    before every `set()` call (both the debounced auto-push and the explicit
    `uploadLocalToCloud()`), which drops `undefined` object properties entirely (and turns an
    `undefined` array element into `null`, which Firebase does accept) — fixing this for
    every module that goes through the shared sync hook, not just Personal Loans, without
    needing to hunt down and rewrite every `|| undefined` call site individually. Also wrapped
    the debounced push in a try/catch as defense-in-depth, since `set()`'s synchronous throw
    (for any future edge case `stripUndefinedDeep` doesn't catch) would otherwise become an
    uncaught exception instead of a logged warning. New test
    `lib/firebase/__tests__/useWorkbookCloudSync.test.ts` (3 tests) exercises the exact
    reported scenario (a loan with `note: undefined`) plus nested/array cases and confirms
    ordinary falsy values (`0`, `null`, `false`) survive untouched. `npm run build` /
    `npm run test` (141 tests, 3 new) both clean.
47. **Sorting and direct edit added across a batch of tables that lacked them (2026-08-23,
    user-reported: "many tables not sorting... records don't have edit buttons").** Audited
    every module's tables for the existing `useSortableRows` header pattern and for whether a
    record can be edited at all. Found and fixed real gaps: **sorting** added to Personal
    Loans' loan list and repayments table, EMI's loan list, Bank's accounts list, Rentals'
    properties list, the Transfers page's linked-transfers list (previously a fixed
    date-descending sort, now user-toggleable), and QSE/PSX's per-stock transaction tables.
    **Direct edit** added to Personal Loans' and EMI's loan list rows — both previously only
    had an "Open" button that navigated to the detail view, where Edit already existed one
    click further in; each list row now also has an "Edit" button that opens the detail view
    already in edit mode (`LoanDetail`'s `startInEditMode` prop), cutting the click needed to
    fix a typo in a loan's name or amount. **Not a gap, verified while auditing**: every other
    module's master/leaf records (Cash entries, Bank transactions/accounts, Rentals
    properties/entries, Funds/EMI's own detail-view edit, Personal Loans repayments,
    Transfers) already had edit — the "no edit buttons" impression was specifically these two
    list views' extra click, not a missing capability. Verified live via Playwright: header
    click toggles sort direction correctly on both a Personal Loans and a Bank table, and the
    new Edit button opens the loan detail directly showing the Save/Cancel edit form — zero
    console errors. `npm run build` / `npm run test` (141 tests, unchanged — this is UI
    wiring around already-tested calc functions, not new calc logic) both clean.
48. **Overall summary stats added to EMI/Loans and Funds landing pages (2026-08-23,
    user-reported: "all modules must have summary stats... currently no accumulative data for
    quick sight").** Audited every module's landing view — Cash/Banking/Personal Loans/
    Rentals already show an at-a-glance summary card (balance/net-position/total-balance/
    net-income) on their first tab; QSE/PSX have a full Dashboard page. EMI/Loans and Funds
    were the two real gaps — both only showed stat cards inside a per-loan/per-fund detail
    view, nothing accumulative before opening one. New `totalsByCurrency()` in
    `lib/calc/emiModule.ts` (tested) sums monthly-installment/outstanding/paid-so-far across
    every loan, grouped by currency; a new `OverallSummary` card renders it above EMI's loan
    list. Funds' equivalent aggregates invested/current-value/net-profit across every fund
    (computed inline in `FundsPage.tsx` from the same already-computed
    `positions`/`getMarketPrice` values `FundList` itself uses — no new pure function, since
    it's a straightforward sum of values already derived elsewhere, not new calc logic worth
    its own testable module) — deliberately doesn't attempt an aggregate XIRR, since summing
    or averaging XIRR across funds bought at different times isn't a meaningful number.
    Verified live in the browser with seeded data for each module: both landing pages show
    the new summary card with correct totals, zero console errors. `npm run build` /
    `npm run test` (143 tests, 2 new) both clean.
49. **Currency pickers now remember the last one you picked (2026-08-23, user-requested:
    "Remember last used currency").** New `hooks/useLastCurrency.ts` (3 tests using
    `@testing-library/react`'s `renderHook`) — a tiny `useState` + `localStorage` wrapper,
    keyed per add-form (`'cash'`, `'bank-account'`, `'personalLoans'`, `'emi'`, `'funds'`,
    `'rentals'`) so each module's own last choice is independent. Wired into every add-form
    that has a currency picker: Cash's ledger entry form and its Planning add-plan form (share
    the `'cash'` key — picking PKR in one pre-fills PKR in the other, since they're both "what
    currency is this Cash amount in"), Bank's add-account form, Personal Loans' add-loan form,
    EMI's add-loan form, Rentals' add-property form, and Funds' add-fund form. Falls back to
    the module's configured default currency (or `'USD'` for Bank/Rentals/Funds, which have no
    module-level default currency setting) when nothing's been remembered yet. Deliberately
    left untouched: edit-row currency selects (EMI/Funds/Rentals/Personal Loans/Bank all have
    one) — editing an *existing* record's currency isn't "what currency should a new record
    default to," so there's nothing to remember there. Verified live via Playwright: picking
    PKR in Cash's form persists to `localStorage`, and a full page reload correctly shows PKR
    pre-selected in that same form — zero console errors. `npm run build` / `npm run test`
    (146 tests, 3 new) both clean.
50. **Cluttered chart datalabels fixed across every chart in the app (2026-08-23, user-
    reported: "charts look ugly with cluttered x,y scale labels").** The real cause wasn't the
    axis tick labels themselves — it was `chartjs-plugin-datalabels`' per-bar/per-point value
    labels. `display: 'auto'` only hides labels that directly overlap *each other*; with many
    bars/points crammed into one card-sized chart (e.g. 18 months of data), each label could
    render without technically overlapping its immediate neighbor while the whole row still
    read as an unreadable wall of numbers sitting on top of (and visually hiding) the axis
    ticks underneath — confirmed with a real Playwright screenshot showing exactly this on
    Cash's new "Income vs. expense by month" and "Balance over time" charts (see Done item 44)
    with 18 months of seeded data. Fixed centrally in `lib/chartLabels.ts`'s `dlBase()` —
    shared by every `dl*` helper (`dlBarV`/`dlBarH`/`dlLine`/`dlDoughnut`/`dlStack`), so this
    fixes every chart in the app, not just Cash's — by changing `display` from the static
    `'auto'` to a function that checks `context.dataset.data.length`: past 10 points in a
    dataset, per-point labels stop being useful anyway (there's no room to read them, and the
    axis + tooltip-on-hover already communicate the same values), so labels are hidden
    entirely rather than rendered illegibly; at or under 10 points, the original `'auto'`
    behavior is unchanged. Verified with a before/after screenshot comparison (not just a
    described intent) using seeded 18-month Cash data: before, the bar/line charts showed
    overlapping "536.00 USD"/"515.00 USD"-style label clusters obscuring the y-axis numbers;
    after, both charts show clean axis-only labels, while the 2-category doughnut chart (well
    under the 10-point threshold) still correctly shows its per-slice value labels — confirming
    the fix only hides labels where they'd actually be clutter, not universally. `npm run
    build` / `npm run test` (146 tests, unchanged — a display-threshold tweak isn't separately
    unit-tested, verified visually instead) both clean.
51. **Critical: Trade Calculator's "Amount" field rejected typed input, user-reported from a
    real phone ("big problem").** Root cause: the Amount field (a reverse-entry convenience —
    type a $ amount, back-derive shares) had its displayed `value` fully derived from
    `(newShares * buyPrice).toFixed(2)` on every render, recomputed from whatever was just
    typed. Typing "150" digit by digit: after the first "1", the field re-rendered showing
    "1.00" (forced to exactly 2 decimals) with the cursor at the end; the next keystroke landed
    *after* the decimal point instead of building up a bigger whole number, and the round-trip
    through division-then-remultiplication snapped the display right back to a similar 2-decimal
    value every time — the field was effectively unable to accept more than one digit, worse on
    phones where there's no easy way to reposition the cursor to work around it. Fixed in both
    `features/qse/components/TradeCalculator.tsx` and the identical PSX copy by giving the
    Amount field its own local text state (`amountInput`) that holds exactly what the user
    typed, never reformatted mid-typing — only the "Buy price"/"New shares" fields and the
    "Use" button (all separate inputs) resync it to a freshly formatted value, since those
    changes don't fight the user's own typing. Verified live via Playwright in an emulated
    mobile viewport (390×844, `isMobile`/`hasTouch`), typing "150" one keystroke at a time with
    a real per-character delay (not `.fill()`, which wouldn't have caught this): the Amount
    field correctly held "150" and derived 50 shares at a 3/share buy price — reproduced the
    exact reported failure before the fix and confirmed it fixed after. Also verified editing
    "New shares" directly correctly syncs the Amount field to match. `npm run build` /
    `npm run test` (146 tests, unchanged — a controlled-input state bug, not new calc logic)
    both clean.
52. **Trade Planner crash when deleting all legs in a plan, user-reported, root-caused to a
    real Firebase RTDB gotcha, not a Trade Planner-specific bug.** Firebase Realtime Database
    silently strips any empty array/object value from the tree it stores, at *any* nesting
    depth — not just the top level (already handled everywhere by the existing
    `{...createEmpty(), ...cloudData}` merge). Removing a plan's last leg sets `legs: []`;
    that gets pushed to the cloud by the debounced sync, RTDB drops the now-empty `legs` key
    entirely, and the next pulled snapshot's plan object has *no* `legs` key at all — every
    `plan.legs.map/.filter/.reduce` call in `PlanCard` (`features/psx/pages/
    TradePlannerPage.tsx`) then threw `Cannot read properties of undefined`, crashing the
    whole page (caught by the error boundary as "Something went wrong"). Reproduced exactly
    via Playwright by seeding a plan object with the `legs` key omitted (simulating the
    post-round-trip shape) — confirmed the crash, then confirmed it gone after the fix.
    Fixed in the one shared `normalize()` function in `store/createWorkbookStore.ts` (same
    function that already retrofits missing `Transfer` ids) — restores `legs: []` on any
    trade plan missing that key, applied on every path data enters the store (local load and
    `setWorkbook`, which covers the Firebase pull), so it protects QSE's `tradePlans` field
    too even though only PSX has a Trade Planner page today. Audited every other workbook type
    for the same nested-array vulnerability (an array field nested inside another array-of-
    objects field) — `TradePlan.legs` is the only one in the whole codebase; every other
    module's arrays sit directly on the workbook root, already covered by the existing
    top-level default-merge. New regression tests in `store/__tests__/
    createWorkbookStore.test.ts` (4 tests) cover a plan missing `legs` on load, on
    `setWorkbook`, and a plan with real legs staying untouched. `npm run build` /
    `npm run test` (150 tests, 4 new) both clean.
53. **Chip/checkbox-chip selected-state indicator fixed app-wide, user-reported ("checkbox
    chips doesn't indicate selected option well making the UI confusing").** Root cause was
    two-layered. First, even under the default theme, `.chip.active`'s old style
    (`background:var(--accent-soft)`, a very light tint) sat so close in lightness to the
    inactive chip's own background/border that the two were hard to tell apart at a glance.
    Second, and more seriously, **every non-default color theme (ocean/forest/violet/sunset/
    all seven `material-*` themes — everything except the default "wine" theme) had a
    higher-specificity per-theme `.chip` rule that unconditionally overrode `.chip.active`'s
    background/color, regardless of whether a chip was active** — under any of those themes,
    active and inactive chips rendered *completely* identically. Confirmed via Playwright
    screenshots of the PSX Analytics ticker-filter chips and exchange-switcher chips under
    wine, `material-blue`, and `ocean` before and after. Fixed by (1) rewriting the base
    `.chip.active` rule to a solid, strongly-contrasting fill (the same `color-mix(in srgb,
    var(--accent) 65%, #000)` + white text treatment the app's primary `.btn` already uses,
    rather than the subtle accent-soft tint), and (2) adding `:not(.active)` to every
    per-theme `.chip` override selector in `theme.css` (the two `:not([data-color="wine"])
    .chip` blocks, the `material-*` block, and the explicit material light/dark block) so
    none of them can clobber the active style anymore. Also added a small checkmark
    (`CheckIcon`) to `ChartFilterBar`'s ticker chips specifically — a genuine multi-select
    "checkbox" control, unlike the single-select exchange-switcher/tab-bar chips that read
    fine from the fill alone — for an extra, color-independent confirmation signal. Verified
    with real before/after screenshots across all three themes tested. `npm run build` /
    `npm run test` (150 tests, unchanged — a CSS/visual fix) both clean.
54. **Mobile CSS pass: inputs/selects no longer cramped/cut off, form-row inputs consistently
    bottom-aligned, stat-card numbers no longer overflow — all three user-reported.** Root
    cause of the cramped-inputs report, confirmed via `getBoundingClientRect`/
    `getComputedStyle` inspection in Playwright (not guessed): `.row > *{flex:1}` uses
    `flex-basis:0%`, which makes a `.row`'s explicit per-field `width` props (e.g. the Trade
    Calculator's Buy price/New shares/Amount/Target avg cost row, each with its own
    `width={90|100}`) irrelevant — the row divides its *actual* width evenly among however
    many fields it holds instead. On a 390px phone with 4 fields in that one row, each field
    measured **74px** regardless of its requested width. Root cause of the misaligned-inputs
    report, from the same inspection: those 4 fields, having very different label lengths (1
    line vs. up to 3 wrapped lines for "Target avg cost (optional)"), were all stretched to a
    common height by `.row`'s default `align-items: stretch`, but `Field` packed its
    label+input at the *top* of that stretched box — leaving unused space *below* the input
    — so a short-label field's input measured 18-36px higher than a long-label field's input
    in the exact same row. **Fixes**: (1) `Field` (`components/ui/Field.tsx`) now sets
    `justifyContent: 'flex-end'`, anchoring every field's label+input block to the *bottom*
    of its stretched box — re-measured after the fix: every input in a row now shares the
    exact same bottom Y-coordinate, regardless of its own label's line count. (2) a new
    `max-width:640px` block in `theme.css` sets `.row{flex-wrap:wrap}` and
    `.row > *{min-width:140px}`, so a 4-field row now wraps to 2-per-line at 156px each
    instead of squeezing to 74px — re-verified via the same inspection technique. Also bumped
    input/select font-size to 16px on mobile (prevents iOS Safari's auto-zoom-on-focus below
    that size, which reads as "the input behaves oddly" even though nothing was actually
    broken) and padding for a larger touch target. (3) `.stat-card .value` gets
    `overflow-wrap:anywhere` and a smaller mobile font-size; verified with a seeded 8-figure
    PKR deposit total (`12,345,678.90 PKR`) — the number now wraps to a second line inside
    the card instead of overflowing it, confirmed via a `scrollWidth > clientWidth` check
    (zero overflowing stat values) plus a visual screenshot. `npm run build` / `npm run test`
    (150 tests, unchanged — a CSS/layout fix, verified visually and via computed-style
    inspection rather than unit tests) both clean.
55. **Chart value labels clipping at the chart's edge fixed globally, user-reported (distinct
    from the datalabels-clutter fix, Done item 50 — that one hides labels past a point-count
    threshold; this one is about labels that *do* render running out of room).** Root cause:
    `chartjs-plugin-datalabels` draws a bar/line's value label just outside the bar/point
    (`dlBarV`: above; `dlBarH`: to the right/left; `dlLine`: above), but Chart.js's own
    auto-ranged scale has no idea an external plugin is about to draw text past the data's
    own max/min — so the tallest bar (or rightmost horizontal bar, or highest line point)
    routinely had its label clipped right at the canvas edge, with zero headroom reserved.
    Fixed with two Chart.js global defaults in `lib/chartSetup.ts` (set once, applying to
    every chart on every page, rather than touching each of the 8 chart-bearing files
    individually): `ChartJS.defaults.scales.linear.grace = '10%'` pads a linear scale's
    auto-computed range 10% past the actual data extent, and
    `ChartJS.defaults.layout.padding = {top:20, right:16, bottom:4, left:4}` reserves canvas
    space around the plot area. Verified by comparing before/after screenshots of Cash's
    "Income vs. expense by month" chart with identical seeded data: before, the y-axis
    topped out exactly at the tallest bar's value (4,000, no headroom); after, the same data
    auto-ranges to 6,000, giving every value label real room above its bar. `npm run build` /
    `npm run test` (150 tests, unchanged — a chart-defaults change, verified visually) both
    clean.
56. **Stat-card numbers abbreviated for a cleaner look, with the exact/unrounded number
    available as a hover tooltip — two related user-reported items done together.** New
    `lib/format.ts` helpers: `fmtCompact(n)` abbreviates a magnitude (1,234,567 → "1.23M";
    below 1,000, identical to the existing `fmt`, since abbreviating "842" isn't useful) and
    `fmtMoneyCompact(n, currency)` appends the currency code. New `MoneyValue` component in
    `components/Card.tsx`: renders the compact form as the visible text and the full-precision
    `fmtMoney` string as a native `title` attribute (hover tooltip) — one place for the
    "round for display, keep the real number a hover away" pattern instead of repeating it at
    every call site. QSE/PSX Dashboards' `StatCard` usages (which pre-format their own
    `value` string) were switched to pass `fmtMoneyCompact` as the display value and
    `fmtMoney` as a new `title` prop on `StatCard` itself. Every other module's hand-rolled
    `.stat-card` markup (Cash's balance card, Bank's total-balance card, Personal Loans' net-
    position and per-loan principal/outstanding cards, EMI's per-loan and overall-summary
    cards, Funds' per-currency and per-fund cards, Rentals' net-income card — nine call sites
    across six files) now renders through the shared `MoneyValue` component instead of a
    hand-written `fmtMoney` call. New tests: `lib/__tests__/format.test.ts` (6 tests) cover
    the abbreviation thresholds, sign preservation, and the null/NaN em-dash case. Verified
    live: a seeded 8-figure PKR deposit (`12,345,678.90`) now displays as `12.35M PKR` on the
    PSX Dashboard, with the full `12,345,678.90 PKR` string confirmed present in the
    rendered `title` attribute. `npm run build` / `npm run test` (156 tests, 6 new) both
    clean. Not touched: the Cash/Bank Planning tabs' "Real: X / Planned: X" projection cards
    (a different, prefixed display shape, not a plain `.value` div) and every non-money stat
    (share counts, percentages, XIRR) — none of those need abbreviating.
57. **Module stat sections now surface upcoming/in-process planned payments, user-reported —
    ties into the existing Planning feature (Done item 43) for Cash and Banking, the only two
    modules that have one.** Cash's `BalancesSummary` and Bank's `TotalBalances` (both render
    right on each module's default/landing tab, not buried inside the Planning tab) now read
    the not-yet-executed entries from `usePlannedCashWorkbookStore`/`usePlannedBankWorkbookStore`
    directly and add a `sub` line under each currency's Balance stat card — e.g. "2 upcoming
    plans (net -250 USD)" — only rendered when that currency actually has a pending plan, so a
    module with no plans looks exactly as before. Bank's version maps each plan's `accountId`
    to its account's currency the same way `plannedBankProjection` already does, since a
    planned bank transaction doesn't carry a currency of its own. Verified live with seeded
    pending plans on both modules: Cash showed "1k USD" + "2 upcoming plans (net -250 USD)";
    Bank showed "500 USD" + "1 upcoming plan (net -300 USD)" — both without navigating into
    the Planning tab. `npm run build` / `npm run test` (156 tests, unchanged — reuses the
    already-tested `plannedCashProjection`/`plannedBankProjection` logic, no new calc code)
    both clean. EMI/Personal Loans/Rentals/Funds have no Planning feature yet (Done item 43
    only shipped it for Cash/Banking), so there's nothing to surface there.
58. **Account detail drill-down + statement export, v1 shipped for Banking — the first module
    of the cross-module item requested in old Pending item 36; the pattern, not the full
    rollout, is what's new here.** Each account row in the Accounts tab gets a "Details"
    button (`AccountsList` in `features/bank/pages/BankPage.tsx`) opening a new
    `AccountDetailModal`: the account's current balance, its upcoming (not-yet-executed)
    planned transactions from the Planning feature, its 20 most recent real transactions with
    a running balance (reusing the already-existing `accountRunningLedger`), and a "Download
    statement" section — an optional From/To date range plus an "Export CSV" button. New
    `toCSV()` in `lib/csv.ts` (the inverse of the existing `parseCSV()` used for statement
    import — quotes a field only when it needs it, escapes embedded quotes, RFC4180-ish) is
    module-agnostic on purpose, so the same helper can back a statement export for any other
    module's own detail view later rather than each one reinventing CSV serialization. Tests:
    `lib/__tests__/csv.test.ts` gained 4 new `toCSV` cases (simple join, comma-quoting, embedded
    quote escaping, and a round-trip through `parseCSV`). Verified live via a real Playwright
    download: seeded a 2-transaction account, opened Details, clicked Export CSV, and read the
    actual downloaded file's content — `Date,Description,Category,Amount,Balance` header plus
    both rows with a correct running balance, filename `Checking_statement.csv`. `npm run
    build` / `npm run test` (160 tests, 4 new) both clean. **Not done**: the same drill-down for
    QSE/PSX positions, Personal Loans, EMI, Funds, and Rentals — each module's "primary record"
    and what a "statement" means for it differs enough (a stock position's statement is really
    its transaction history; a loan's is its repayment history) that each deserves its own pass
    rather than a blind copy-paste, tracked as the new Pending item below.
59. **EMI-to-Bank linking with recurring planned installments, plus the missing "Expected end
    date" stat — README item 37.** A loan's detail view (`LoanDetail` in
    `features/emi/pages/EMIPage.tsx`) gets a new "Link to bank" card: pick one of your Banking
    accounts and click **Link to bank** to generate a `PlannedBankTransaction` (via the
    existing Planning feature) for *every remaining, not-yet-paid installment* — dated on the
    loan's own amortization schedule (new `installmentDueDate()`/`expectedEndDate()` in
    `lib/calc/emiModule.ts`, both `startDate` plus N months), amount negative (an outgoing
    payment), description `"EMI: {loan name} (#N/total)"`. `EMILoan` gained
    `linkedBankAccountId?` and `PlannedBankTransaction` gained `sourceEmiLoanId?` — once
    linked, the card shows "Linked to {account}" and the button becomes **Re-link / regenerate
    plans**, which (after a confirm dialog) deletes only *this loan's own, still-pending*
    generated plans before creating fresh ones — already-completed ("Mark as done") plans are
    left alone, and re-linking never touches another loan's plans. Also added the "Expected
    end date" stat card next to "Months remaining" using the same new `expectedEndDate()`.
    New tests: `lib/calc/__tests__/emiModule.test.ts` gained 2 cases for the new date
    functions. Verified live: seeded a loan + a bank account, opened the loan, confirmed the
    "Expected end date" stat renders correctly and the "Link to bank" card shows the account
    picker; clicking **Link to bank** correctly hit the sign-in gate with the right message
    (same verification depth used elsewhere in this project for sign-in-gated writes — a real
    authenticated round-trip needs a human with a real account, not a throwaway test account
    against the production Firebase project). `npm run build` / `npm run test` (162 tests, 2
    new) both clean. **Deliberately not built**: a calendar view of upcoming payments (the
    README item's own wording said "maybe" — treated as a nice-to-have, not a requirement, and
    left for a future pass since a plain sorted list already exists in Bank's Planning tab).
60. **Rentals auto-planning from lease info + security deposit/tenant tracking — README item
    38.** `Property` gained optional lease/tenant/deposit fields (`monthlyRent`,
    `cycleStartDay`, `leaseStartDate`, `leaseEndDate`, `utilitiesIncluded`, `tenantName`,
    `tenantContact`, `securityDeposit`, `securityDepositType`, `securityDepositDate`,
    `securityDepositReturned`) — all optional, so every existing property keeps working
    unchanged. New "Details" button per property (`PropertyDetailModal` in
    `features/rentals/pages/RentalsPage.tsx`, same drill-down pattern as Bank's account
    Details from Done item 58) edits these fields and has a **Generate projected rent**
    button. New pure function `generateLeaseRentPlans()` in `lib/calc/rentalPlanning.ts`
    computes one projected RENT_INCOME plan per rent cycle — starting from whichever is later
    of the lease start and today (no point projecting rent already in the past), capped at the
    lease's own end date or a 12-month horizon for an open-ended lease. Plans are real
    Planning-feature records (new `types/plannedRentals.ts`, `plannedRentalsWorkbookStore.ts`
    reusing `createEntryStore`, own Firebase path `plannedRentals`) shown in the same modal
    with Mark-done/Remove, mirroring Cash/Bank/EMI's plan-list pattern. **Regeneration needed
    the same design thought as EMI's re-linking (Done item 59)**: `PlannedRentalEntry` gained
    `sourceLeasePropertyId?` so clicking "Generate projected rent" again replaces only that
    property's own still-pending generated plans (after a confirm dialog), never touching
    plans already marked done or another property's plans. New tests:
    `lib/calc/__tests__/rentalPlanning.test.ts` (5 cases — incomplete lease info returns
    nothing, a bounded lease generates exactly the right cycles, an open-ended lease caps at
    12 months, a cycle day past a short month clamps to that month's last day, and starting
    from "today" mid-lease skips already-past cycles). Verified live: filled in lease details
    in the modal, confirmed the sign-in gate correctly fires on "Generate projected rent"
    (same verification depth as every other sign-in-gated write in this project). `npm run
    build` / `npm run test` (167 tests, 5 new) both clean. **Scope decisions made explicitly,
    not silently**: only rent INCOME auto-plans (not expenses) — the user's own follow-up
    context said utility bills are a lump "included or not" flag for now, not itemized
    recurring costs, and other rental expenses (maintenance, tax) are too irregular to
    auto-plan safely; and there's no Real-vs-Planned net-income projection UI like Cash/Bank's
    Planning tab (`PlannedRentalSettings` is currently empty) since Rentals' "net income"
    isn't a single running balance the same way — just a plan list for v1.
61. **Critical, user-flagged urgent: PSX Trade Planner couldn't add a new leg to an
    already-saved plan.** `PlanCard` (the saved-plan view) already supported editing and
    removing an existing leg, but had no way to append a new one — the only way to add a leg
    was via `NewPlanForm`, which creates a brand-new plan from scratch. Fixed by adding an
    "+ Add leg" button under each saved plan's table, opening an inline form row (same
    fields as `NewPlanForm`'s own leg row: date/ticker/action/shares/price, with the PSX
    ticker datalist) that appends the new leg via the existing `updateTradePlan` action on
    **Add**, or discards it on **Cancel**. Requires ticker+shares+price all filled before
    accepting, same validation bar as a new plan's legs. Verified live via Playwright: seeded
    a saved single-leg plan, clicked "Add leg," filled in a second ticker, clicked "Add," and
    confirmed via a fresh `localStorage` read that the plan now had both legs persisted
    correctly (not just visually). `npm run build` / `npm run test` (167 tests, unchanged — UI
    wiring onto an already-tested store action, no new calc logic) both clean.
62. **PSX Trade Planner now shows per-ticker average cost, break-even, and planned P/L —
    user-flagged priority ("purpose of trade planner is to find the buy avg, break-even, PL
    per each trade and collectively to plan and run profitable trade cycle").** A plan's leg
    table showed each leg's own amount/fee, but nothing about what the *cycle* as a whole
    means for your actual cost basis or expected profit. New `lib/calc/tradePlanAnalysis.ts`
    (`analyzeTradePlanByTicker`) computes, per ticker in a plan: average cost **blended with
    any shares you already really hold** (not just this plan's own buy legs in isolation —
    so planning to sell an existing position works correctly even with zero buy legs in the
    plan), a fee-aware break-even price (reuses the same `breakEvenPrice` solver already used
    by the Trade Calculator/Portfolio/Dashboard, not a new formula), shares remaining after
    the plan executes, and planned realized P/L from the plan's own sell legs valued against
    that blended cost. Shown as a new "Per-ticker plan analysis" table under each plan's legs,
    plus a "Total planned P/L" figure in the summary line when any ticker has a sell leg. New
    tests: `lib/calc/__tests__/tradePlanAnalysis.test.ts` (6 cases: plan-only buy cost basis,
    blending a real holding into average cost, sell-only P/L against a real holding, fees
    correctly reducing both buy cost basis and sell proceeds, one row per distinct ticker, and
    a genuinely-empty case with neither a real holding nor a buy leg). Verified live: seeded a
    real 100-share QGTS holding plus a plan with a 100-share buy and a 50-share sell,
    confirmed the rendered average cost/break-even/P/L matched hand-calculated blended
    values. `npm run build` / `npm run test` (173 tests, 6 new) both clean.
63. **PSX Trade Planner: a per-plan default ticker that auto-fills new legs — user request
    ("standard is, a default ticker per trade plan and autofill legs with it; 1 plan may have
    different trade tickers").** `TradePlan` gained an optional `defaultTicker` field. New
    plans (`NewPlanForm`) get a "Default ticker" field alongside name/notes — setting it
    backfills every leg whose ticker is still blank (never overwrites a leg the user already
    typed a different ticker into), and every subsequent "Add leg" click pre-fills the new
    row with it. Saved plans (`PlanCard`) show their default ticker in the summary line
    ("· default ticker QGTS"), can edit it via the same Edit action as name/notes, and their
    own "+ Add leg" flow pre-fills from it too. A plan can still mix tickers freely — this is
    a convenience default, not a constraint — matching the user's own "1 plan may have
    different trade tickers" clarification. Verified live via Playwright: set a default
    ticker in `NewPlanForm`, confirmed both the already-present leg and a newly added one
    picked it up; opened an existing saved plan with `defaultTicker: 'MEZN'`, clicked "+ Add
    leg," and confirmed the new row's ticker input held the full value "MEZN" (checked via
    `inputValue()`, not just a screenshot — the field's own width visually clips longer
    tickers, which could otherwise be mistaken for a truncation bug). `npm run build` /
    `npm run test` (173 tests, unchanged — UI/type addition, no new calc logic) both clean.
64. **PSX Trade Planner legs table made sortable; per-ticker analysis now separates
    already-executed from still-planned legs (fixing a real double-counting bug found while
    doing it); a per-ticker "what if I exit at price X" sandbox added — three related
    user requests handled together.** Sorting: the legs table gets clickable headers
    (Date/Ticker/Action/Shares/Price/Amount/Status) via `useSortableRows`, sorting *display*
    only — every action (Edit/Mark done/Remove) still addresses a leg by its original array
    index, never the sorted position, verified by editing the first row after a descending
    ticker sort and confirming it opened the *correct* leg's data, not whichever leg happened
    to be first in storage order. **Real bug found and fixed while adding the "planned vs.
    executed" distinction the user asked for**: `analyzeTradePlanByTicker` previously
    included every leg regardless of its `executed` flag in the cost-basis math — but an
    executed leg already created a real Transaction, so its shares are *already* inside the
    real holding passed in from `usePSXDerived()`. Counting an executed leg again on top of
    that double-counted its shares/cost. Fixed by splitting legs into
    executed/not-yet-executed and excluding executed ones from `avgCost`/`breakEven`/
    `plannedBought`/`plannedSold` math entirely — they're now reported as separate
    `executedBought`/`executedSold` figures instead, shown in their own table column. New
    `whatIfExit()` in `lib/calc/tradePlanAnalysis.ts` computes fee-aware proceeds/P&L for a
    hypothetical exit price; the new `WhatIfExitCalculator` component shows this two ways per
    ticker — exiting just what's left after the plan's own pending sells, and exiting the
    full position as if those pending sells hadn't happened — answering "is my planned exit
    actually the best one, or would a different price/quantity net more" (the user's own
    framing: "Trade planner plan is like a trade sandbox for testing different trade combos
    for profitable exit"). New tests: `lib/calc/__tests__/tradePlanAnalysis.test.ts` expanded
    to 10 cases including two that specifically cover the double-counting fix (an executed
    buy leg correctly excluded from `avgCost`, an executed sell leg correctly excluded from
    `realizedPL`) plus 3 new `whatIfExit` cases. Verified live: seeded a plan with one
    executed buy leg (100 @ 10, matching a real Transaction), one pending buy (50 @ 12), and
    one pending sell (30 @ 14) — confirmed the table correctly showed "+100 buy" under
    Already Executed and "+50 buy -30 sell" under Still Planned, with a sane blended average
    cost (not doubled), and the what-if calculator produced sensible proceeds/P&L for both
    scenarios at a test price. `npm run build` / `npm run test` (178 tests, 5 new) both
    clean.
65. **Trade Planner full-screen/collapse + app-wide collapsible sidebar — user request
    ("full screen button to view a plan with high focus. plans should be collapsible.
    sidebar also collapsible to save space and focus").** Each `PlanCard` in the PSX Trade
    Planner gained two independent view-state toggles: "Full screen" (renders the card
    `position:fixed;inset:12px` above a dimmed `.modal-overlay` backdrop for high-focus
    editing of one plan) and "Collapse" (hides the legs table/per-ticker analysis/what-if
    calculator, leaving just the header — useful once several plans exist and only one is
    being actively worked). Separately, `AppShell.tsx` gained a desktop-only sidebar
    collapse (distinct from the existing sub-860px mobile drawer, which is closed by
    default and toggled by a hamburger button): above 860px the sidebar is open by default
    and can be slid off-screen via a new `«` button next to the "FinanceRecorder" title
    (`Sidebar.tsx`'s new `.sidebar-title-row`/`.sidebar-collapse-btn`), leaving a small
    floating `»` tab (`.sidebar-expand-tab`, only rendered above 860px) to bring it back —
    state persists across reloads via `localStorage`
    (`financerecorder_sidebar_collapsed_v1`). Implemented via a CSS transform
    (`translateX(-100%)`) rather than `display:none`, so the slide transition animates.
    Verified live via Playwright: full-screen shows the dimmed backdrop and the card
    filling the viewport; collapse hides the body content and shows "Expand"; the sidebar
    collapse button slides the sidebar off-screen, shows the expand tab, persists `true` in
    `localStorage`, survives a reload still collapsed, and re-expands cleanly on tapping the
    tab — zero console errors throughout. `npx tsc -b`, `npm run build`, and `npm run test`
    (178 tests, unchanged — UI-only change, no new calc logic) all clean.
66. **Net Worth dashboard shipped (2026-08-24) — README Pending item 39 (net worth) and
    MODULES_PLAN.md §16, resolved without a Blaze-plan Cloud Function.** The user, when asked
    to choose, said to skip the paid scheduled-function route entirely: "leave blaze plan. if
    you have any free api, okay otherwise manual inputs accepted." New `/net-worth` page
    (`features/netWorth/pages/NetWorthPage.tsx`, nav entry added to `CategoryNav.tsx`) sums
    Cash balance, Bank total balance, QSE/PSX net worth (`cashSummary().netWorth`), and Funds'
    current market value as assets; Personal Loans' net position contributes as an asset or
    liability depending on sign; EMI's outstanding balance is always a liability — combined
    per-currency by a new pure `lib/calc/netWorth.ts` (`computeNetWorthByCurrency`, 6 tests),
    kept store-agnostic so it stays testable without touching any Zustand store. Rentals is
    deliberately informational-only, shown separately, never summed into net worth — property
    values aren't tracked in this app, and rental income already lands in whichever Cash/Bank
    account it was deposited to, so counting it again would double-count. A new
    `lib/calc/fundsModule.ts` (`fundsValueByCurrency`, 3 tests) mirrors FundsPage's own
    per-fund value calculation so the dashboard doesn't depend on that page's component
    internals. Currency conversion: new `lib/fx.ts` fetches from a free, no-API-key provider
    (`open.er-api.com`) at most once every 24 hours, caching the result (with a timestamp) in
    localStorage — never a live per-page-load call, consistent with the app's locked rule. If
    the fetch ever fails for any reason (this dev sandbox's own network policy blocks
    arbitrary outbound hosts, so the actual fetch succeeding could only be confirmed from a
    real browser, not this session — verified instead that the failure path itself degrades
    correctly), the page falls back to whatever's cached, or lets the user type a rate in by
    hand (`setManualRate`) — exactly the "free API if it works, otherwise manual" the user
    asked for, and the page never blocks or crashes either way. Each currency gets its own
    collapsible (`<details>`) section showing real, unconverted Assets/Liabilities/Net; a
    single grand-total stat card converts every currency with a known rate into a
    user-selected preferred currency, and names any currency it couldn't convert instead of
    silently dropping it. Verified live via Playwright with seeded Cash+Bank (both USD) and
    QSE (QAR) data: the USD section correctly summed both modules (500+250=750), the QAR
    section stayed separate, the real network-blocked auto-fetch failed gracefully into the
    manual-entry UI with zero crash, and entering a manual QAR rate correctly updated the
    grand total (750 USD + 1000 QAR/3.64 ≈ 1,024.73 → displayed "1.02k USD") — zero console
    errors throughout. Also fixed during verification: an untouched QSE or PSX workbook was
    contributing a spurious "0" row in its default currency even when the exchange was never
    used at all — fixed by only including an exchange's contribution when its workbook has at
    least one transaction/transfer/adjustment. `npx tsc -b` / `npm run test` (197 tests, 19
    new) / `npm run build` all clean.
67. **REVERTED 2026-08-25 — see Done item 127. This item's own "fix" turned out to be itself a
    real, significant financial-correctness bug**, confirmed against a real user's actual trade
    history: it silently under-charged commission on same-day round trips (in the common
    tied-quantity case, on BOTH legs at once) and on an isolated same-day buy with no matching
    sell at all that day. Original text kept below for the historical record — do not
    re-introduce this pattern.

    **Critical, user-reported: PSX same-day (intraday) buys were charged full commission with
    no way to net until a matching sell was also logged the same day — "we are trying to do
    same-day trade."** `sameDayChargedSide()` in `psxFees.ts` (unchanged, still correct) only
    detects a same-day round trip once BOTH a buy and a sell exist for that ticker+date — a
    lone buy, freshly logged with the intent to close it out later the same day, has no sell
    yet to pair against, so it was charged full commission the moment it was saved. Fixed at
    the UI-default layer, not the calc engine (which was already behaving correctly for what
    it was asked): a new BUY transaction dated today now has the existing "Same-day override"
    checkbox (`manualSameDay`, which `isNettedLeg()` already checks first, ahead of the
    date-based auto-detection) pre-checked by default, in both the Transactions page's add-row
    form (`TransactionsPage.tsx`, new `autoSameDay()` helper) and the per-stock page's add
    form (`StockPage.tsx`, which previously had no same-day control on add at all — only its
    edit-row did). The nudge only ever turns the checkbox ON when the row currently matches
    "BUY dated today," never OFF — so a manual override intentionally set for a genuinely
    backdated trade (the checkbox's other real use case, per its own tooltip) survives editing
    an unrelated field, and an ordinary buy-and-hold trader can still uncheck it before saving
    if they're not planning to close same-day. Verified live via Playwright: a fresh row
    pre-checks correctly; switching action to SELL leaves a manual check alone; switching back
    to BUY (still dated today) re-checks it; unchecking then backdating the date does NOT
    force it back on — zero console errors.
68. **Critical, user-reported: prices/costs displayed with fewer decimals than what was
    actually entered.** `fmtPrice()`'s 4-significant-figure rule (README item 3, still the
    right idea for very cheap stocks) had an unintended side effect once a price cleared 3
    digits: `123.456` displayed as `"123.5"` (1 decimal) and `1234.5` as `"1235"` (0 decimals)
    — a real buy price silently looking less precise on screen than what the user actually
    typed. Fixed with a floor: decimals are now `Math.max(2, 4 - magnitude - 1)` instead of
    `Math.max(0, ...)`, so a price never drops below 2 displayed decimals regardless of
    magnitude, while very small (sub-1) prices still get extra decimals via the same
    significant-figure logic as before. Since ~20 files across the app all route through this
    one shared `fmtPrice()` (Avg Cost, Break-even, Current Price, Target Price, the Trade
    Calculator, etc.), fixing it once fixes all of them — no per-call-site changes needed.
    New tests in `lib/__tests__/format.test.ts` (4 cases) cover the exact regression
    (123.456/1234.5 no longer losing decimals) plus the existing sub-10 and sub-1 behavior.
    Verified live via Playwright with a seeded 123.456 buy price: Avg Cost/Break-even both
    rendered with 2 decimals instead of the previous 1. `npx tsc -b` / `npm run test` (201
    tests, 4 new) / `npm run build` all clean.
69. **User-reported (repeated feedback): several tables still weren't sortable, "like Holdings
    in dashboard."** Audited every `<table>` in the app for `useSortableRows` usage and found
    six real gaps beyond the one named: QSE and PSX Dashboard's Holdings preview table (the
    exact one named — was hardcoded to sort by P/L descending with no way to change it),
    PSX's per-stock "Open lots (FIFO)" table, both QSE's and PSX's per-stock "Recent updates"
    price-history table, and both QSE's and PSX's Dividends "Yearly projection" table. Fixed
    all six with the existing `useSortableRows` hook, same pattern as every other sortable
    table in the app — clickable column headers, no new component. Deliberately left
    un-sortable: the Trade Calculator/Risk Analysis "what-if" scenario ladders (a computed
    progression meant to be read in order, not user data to reorder) and the Dividends
    history table and PSX Trade Planner legs table, both of which already had their own
    working sort mechanism (a hand-rolled `toggleSort`/pre-existing `useSortableRows` usage
    respectively) before this pass — not gaps. Verified live via Playwright on the QSE
    Dashboard Holdings table with 3 seeded tickers: clicking "Ticker" sorted descending
    (QGTS → MEZN → CBQK), clicking again sorted ascending (CBQK → MEZN → QGTS) — same
    click-to-toggle convention as every other sortable table — zero console errors. `npx
    tsc -b` / `npm run test` (201 tests, unchanged — UI wiring onto an already-tested hook)
    / `npm run build` all clean.
70. **Critical, user-reported live on PSX: the per-stock "Daily price" trend chart rendered
    completely blank.** Root cause: `PositionDetail.tsx`'s Line chart sets `pointRadius: 0`
    (a clean unbroken line, by design when there are many days of history) — but a ticker
    with exactly **one** day of price history has no second point to draw a line between,
    and with the dot itself hidden too, the canvas had nothing to show at all. This is the
    common case for any ticker whose price was only just set today, which is exactly what a
    user actively starting to use PSX live would hit immediately. Fixed in both QSE's and
    PSX's `PositionDetail.tsx`: `pointRadius: stats.chronological.length > 1 ? 0 : 3` — a
    single-point history now shows a visible dot; multi-point history is unaffected. Verified
    via a real canvas pixel read in Playwright (not just "no console error") — sampled the
    chart's rendered pixels before/after and confirmed non-blank content with a single seeded
    price point.
71. **PSX Trade Calculator: auto-selects the current ticker when opened from a stock's own
    page — user request ("should auto-select it if on a portfolio item/ticker detail
    page").** `CalculatorLauncher.tsx` (the floating button + modal, shared across every
    Stock Exchanges route) now parses the ticker out of `/stock/:ticker` or
    `/psx/stock/:ticker` and passes it as a new `initialTicker` prop to both QSE's and PSX's
    `TradeCalculator`, which seed their own `ticker` state from it instead of always
    defaulting to the first held position. Opening the calculator from anywhere else
    (Dashboard, Portfolio, Transactions) is unaffected — still defaults to the first held
    ticker as before. Verified live via Playwright: navigating to `/psx/stock/OGDC` and
    opening the calculator showed OGDC pre-selected in the ticker dropdown.
72. **Narrow editable price inputs across the app were too cramped to use — user-reported,
    "Current Price inputbox visible textarea is too small due to padding and incremental
    arrows."** Every one of these fields (Trade Calculator's "Current price", the inline
    market-price cell in every Dashboard/Portfolio Holdings table, Watchlist's target/current
    columns) inherited the base input's `10px 11px` padding, which combined with the
    browser's native number-input spin buttons left very little room for the digits inside
    an 70-110px box — a real usability problem for a finance app with no live price feed,
    where every one of these is a value the user is manually typing and needs to read back
    accurately. New shared `.price-input` class in `theme.css` (`padding: 8px 0 8px 6px` —
    almost zero on the right, where the spinner sits) applied to every such field, with each
    one's declared width also bumped up. Also confirmed (not just fixed the size of) that
    editable current-price inputs already exist in every relevant table per a related user
    request ("no APIs connected, so editable stock current price should be accessible from
    any relevant table") — Dashboard Holdings, Portfolio Holdings, Watchlist, and the
    per-stock page's Summary tab all already had one; this pass only fixed their sizing, no
    new editability was needed.
73. **PSX/QSE Transactions list split into Open positions / Closed positions sections — user
    request.** `TransactionsPage.tsx`'s "Transaction list" tab used to show every transaction
    in one flat table; a ticker you're still holding and one you fully exited months ago were
    mixed together with nothing to tell them apart at a glance. Now split into two
    collapsible sections (open by default) using the same open/closed distinction the
    Portfolio page's Holdings/History tabs already use (a ticker with `shares > 0` from
    `usePSXDerived()`/`useQSEDerived()`'s `positions` is "open"). The ticker filter, group-by
    dropdown, sort headers, and inline Edit/Delete all still work exactly as before —
    filtering/sorting happens first, then the result is split into the two sections, so
    picking a specific ticker just shows it in whichever section it belongs to. The row's
    real array index (not its position within its section) is still what every action
    addresses, so no risk of editing/deleting the wrong transaction. Verified live via
    Playwright with two seeded tickers (one open, one fully closed): each landed in the
    correct section with the correct transaction count, and editing a row still worked.
74. **Dashboard's Holdings and Alerts cards made collapsible by their headers, accordion-style
    — user request ("cards should be collapsible by their headers like accordion panels").**
    New shared `CollapsibleCard` component (`components/Card.tsx`) wraps a `Card` with a
    clickable header (a chevron that rotates open/closed) and conditionally-rendered body;
    an optional `headerExtra` slot renders content that stays independently clickable (its
    own click handler stops propagation) — used for the Holdings card's "Full portfolio →"
    link, which needs to keep working even when the card is collapsed. Applied to QSE's and
    PSX's Dashboard Holdings and Alerts cards as a first working slice — the biggest,
    always-visible cards on the page people would most want to collapse. **Not yet rolled out
    everywhere** (Portfolio, StockPage's Summary sections, chart cards, other modules) — see
    Pending; the component itself is ready to drop into any of them. Verified live via
    Playwright: clicking a header toggles `aria-expanded` and hides/shows the body, the
    Holdings card's "Full portfolio" link stays visible and clickable while collapsed, and
    re-clicking expands it again — zero console errors.
75. **PSX Trade Planner: "Clear plan" button, bigger spacing between saved plans, plans
    collapsed by default — user requests.** "Clear plan" (shown only when a plan has legs)
    removes every leg from a plan in one action — a `confirmDialog`-gated fresh start that
    keeps the plan's own name/notes/default ticker and never touches transactions already
    logged from a previously-marked-done leg — as distinct from "Delete plan," which removes
    the plan record entirely. Saved-plan cards now sit 28px apart instead of 16px so a list of
    several plans doesn't read as one dense block. `PlanCard`'s `collapsed` state now defaults
    to `true` instead of `false` — with several saved plans, having every one fully expanded
    on load was the actual complaint; entering full-screen still force-expands a plan as
    before. Verified live via Playwright: a fresh page load shows no leg-table content for any
    plan (confirming the collapsed default), and the "Clear plan" button is present exactly on
    the plan that has legs.
76. **Stat cards across the app were visually flat/monochrome — user-reported ("colorful
    gradients to distinct the UI components easily") — a real gap, not a design decision.**
    `.stat-card`'s own CSS in `theme.css` already read a `--card-hue` custom property for its
    left-border accent and background tint, but nothing anywhere ever *set* that variable, so
    every stat card silently fell back to the same flat `--accent` color no matter what it
    showed. `StatCard` (`components/Card.tsx`) gained an optional `hue` prop that sets
    `--card-hue` inline; QSE's and PSX's Dashboard stat-card grids now pass a distinct color
    per stat — a fixed palette color (reusing the same `INVEST_PALETTE` hex values the
    allocation/P&L charts already use, for visual consistency) for non-P/L stats like Net
    Worth/Cash Balance/Portfolio Value/Deposits/Fees/Rewards/Open Positions, and
    `var(--profit)`/`var(--loss)` (sign-driven) for Realized/Unrealized/Net P/L and ROI, so a
    loss actually reads red rather than an arbitrary color. Also lifted the dark theme's
    `--bg`/`--panel`/`--panel-2`/`--border` and the light theme's `--bg`/`--border` a step —
    user-reported the page felt hard to visually parse into distinct surfaces, and in dark
    mode specifically `--bg:#0b0e11` vs `--panel:#12161b` was genuinely too close in lightness
    to read as separate ("flat"). Kept the same relative ordering (bg darkest, panel lighter,
    panel-2 lighter still) so nothing about the color *system* changed, just the amount of
    separation between its layers. Verified via before/after screenshots in both light and
    dark mode: every stat card now shows a visibly distinct colored left border/tint, and
    panels clearly separate from the page background in both themes — text contrast and
    readability unaffected. **Not yet applied to QSE/PSX's other pages' stat cards** (Portfolio,
    module pages like Cash/Bank/EMI/etc. that use plain `StatCard` without a `hue`) — see
    Pending; the `hue` prop is ready, each page just needs its own sensible color assignment.
77. **Critical regression, user-reported same day: a same-day BUY+SELL pair both came out with
    0 fee ("app must check on sell transaction... currently buy and sell both have 0 fee").**
    Root cause traced directly to the same-day auto-check fix earlier this session (Done item
    67): a fresh row defaults to BUY dated today with `manualSameDay` auto-checked, but
    switching that same row's action to SELL (rather than adding a brand-new row) never reset
    the flag back to false — the `autoSameDay()` helper only ever nudged it ON, never off, per
    that fix's own stated design. `isNettedLeg()` trusts a manual override unconditionally by
    design (it exists specifically to fix a single leg's date mismatch), so once BOTH legs of
    a real pair carried `manualSameDay: true`, both were treated as the netted side —
    government levies only, on both legs, instead of exactly one of them paying full
    commission. Fixed in both `TransactionsPage.tsx`'s `autoSameDay()` and `StockPage.tsx`'s
    equivalent inline logic: for a row dated today, BUY still defaults to netted (nothing to
    pair against yet), but SELL is now **explicitly reset to false** (not just left alone) so
    it relies on real same-day auto-detection once both legs exist. A non-today date is still
    left exactly as the user set it, in either direction, since a manually backdated override
    is a deliberate choice this logic shouldn't second-guess. New regression test in
    `psxFees.test.ts` documents the exact failure mode (`isNettedLeg` returns `true` for both
    legs of a pair when both incorrectly carry the manual flag) — the calc engine's own
    behavior was correct by design throughout; the bug was purely in the UI defaulting logic.
    Verified live via Playwright: a fresh BUY-today row is pre-checked as before, and
    switching its action to SELL now correctly unchecks the box. `npx tsc -b` / `npm run
    test` (202 tests, 1 new) / `npm run build` all clean.
78. **Critical, user-reported with a real uploaded workbook backup: "I have entered today's
    prices but graph isn't picking them" — a genuine, confirmed bug, root-caused against the
    user's actual data rather than guessed at.** `computePriceStats()`'s min/max/median AND
    its trend-chart data (`chronological`) were both built from `getDailyPriceHistory()`'s
    day-collapsed series — one point per calendar day, that day's *last* update wins. A user
    entering several price updates across one trading day (their real data had 8-16 updates
    per ticker, all dated the same day) had every one of those intermediate updates silently
    discarded before Lowest/Median/Highest or the "Daily price" chart ever saw them — Lowest,
    Median, and Highest all showed the exact same value (confirmed with their OGDC data:
    all three read "332.49" despite real prices ranging 330.21-332.49 that day), and the
    trend chart plotted a single flat point instead of the actual movement. Fixed by computing
    `chronological`/`min`/`max`/`median` from the **raw**, per-update log (sorted by real
    timestamp, falling back to date for older entries recorded before `time` was tracked)
    instead of the day-collapsed one — a ticker updated once a day renders identically to
    before (raw and daily are the same list in that case); a ticker updated many times in one
    day now shows genuine intraday movement. `getDailyPriceHistory()` itself is unchanged and
    still used as-is for sparklines elsewhere (a legitimately different use case — a clean
    one-point-per-day mini chart across many days, not an intraday zoom). New
    `lib/calc/__tests__/priceHistory.test.ts` (4 cases) locks in both the single-update-per-day
    case (unaffected) and the exact regression (several same-day updates no longer collapse
    min/max together). Verified against the user's own uploaded real backup file, not a
    synthetic fixture: before the fix, OGDC's Price Range showed all three stats identical
    (330.21/330.21/330.21 collapsed... actually 332.49 three times) with a near-blank chart
    (63 non-transparent canvas pixels); after the fix, Lowest 330.21 / Median 331.05 / Highest
    332.49 (all genuinely different) with a real visible trend line (35,804 non-transparent
    pixels) — confirmed via both a DOM text read and an actual canvas pixel sample, not just a
    visual glance. `npx tsc -b` / `npm run test` (206 tests, 4 new) / `npm run build` all
    clean.
79. **Same-day-checkbox / auto-fee / fee-override "should be synced" — user-reported confusion
    ("fee isn't auto-calculating due to same day check"), turned into a clear three-mode
    selector.** Web-researched PSX's actual same-day-square-off convention first (minimum
    commission of 3p/0.15% charged on **one side only** for a same-day round trip, per PSX's
    own Ready Market brokerage circular) — confirms the app's existing "larger quantity side
    is charged" rule matches real broker practice, which the user's own report ("sell legs are
    bigger... it should be applied on sell leg") independently confirmed for their own trades.
    The actual UX problem was that "Same-day override" (a checkbox) and "Fee override" (a
    number field) were two independent controls shown side by side at all times — nothing
    stopped both from being filled in at once (feeOverride silently wins), and neither made
    clear that setting one made the other irrelevant. New shared `FeeModeControl`
    (`components/ui/FeeModeControl.tsx`) replaces both with a single three-way selector per
    transaction row: **Auto** (fully computed from Settings, same-day netting still
    auto-detected from the transaction log — the default for most rows), **Semi** (you flip
    whether *this* leg counts as the netted side via a "Netted" checkbox, but the fee amount
    is still computed from Settings — this is what a fresh same-day BUY row starts in, since
    it can't yet know which side will end up bigger), and **Manual** (type the exact fee from
    your statement, bypassing computation). The mode is derived from which of the two
    underlying fields (`manualSameDay`/`feeOverride`) is set — never stored separately — and
    switching modes clears whichever field the new mode doesn't use, so the two can never
    conflict again. Applied to all four PSX transaction-fee UI locations: `TransactionsPage`'s
    add-row form and edit-row, and `StockPage`'s per-stock add form and edit-row. Verified live
    via Playwright: a fresh row defaults to Semi with "Netted" pre-checked; switching to Manual
    hides the checkbox and shows the fee input; switching to Auto hides both — zero console
    errors. `npx tsc -b` / `npm run test` (206 tests, unchanged — UI consolidation onto
    already-tested fields) / `npm run build` all clean.
80. **"We should add sold price to our stock for better understanding" + "find fair market
    value as per my data," two related user requests on the per-stock page, addressed
    together.** Trade history for a ticker already existed (StockPage's "Transactions" tab,
    unchanged) — the actual gaps were: no sell price shown anywhere as its own stat (only
    buried inside the "Current position" bar chart's "Sold" bar, and only the *last* sell, not
    an average), and the existing "Median" price-range stat — now correctly computed from raw
    per-update history (Done item 78) — wasn't labeled as what it actually is: a fair-value
    estimate from the user's own recorded data. Fixed by adding two new stat cards to
    "All-time stats" (shown only when the ticker has at least one sell): **Avg sell price**
    (weighted average across every sell) and **Last sell price**; and relabeling "Median" to
    "Median (fair value)" with a tooltip explaining it's a simple fair-value estimate derived
    from every price the user has recorded, not invented new calc logic. Applied identically
    to both QSE's and PSX's `PositionDetail.tsx`. Verified live via Playwright with a seeded
    two-buy/two-sell OGDC position: Avg sell price correctly computed 125.00
    ((50×120+50×130)/100), Last sell price 130.00, Median (fair value) 120.00 — all matching
    hand-calculated expectations, zero console errors. `npx tsc -b` / `npm run test` (206
    tests, unchanged — no new calc logic, just surfacing existing transaction data) / `npm run
    build` all clean.
81. **Critical, user-reported: "planned trade item marked as done, then updated in the
    transactions but plan and transactions are not synced" + "unless buy & sell are linked,
    fee calc will be buggy" + "fee calculation selectors need labels," three related fixes.**
    (a) `executeTradePlanLeg` ("Mark as done") used to copy a leg's date/ticker/action/
    shares/price into a brand-new Transaction and never link the two records again — the
    Trade Planner kept showing the leg's own frozen-at-execution snapshot forever, so editing
    the real transaction afterward (in Transactions or a per-stock page) never showed up back
    in the plan. Fixed by retrofitting a stable `id` onto `Transaction` (same pattern as
    `Transfer.id` before it — optional, backfilled onto existing data by
    `createWorkbookStore.ts`'s `normalize()`) and a new `TradePlanLeg.executedTransactionId`
    set at execution time; the Trade Planner now resolves an executed leg's displayed date/
    ticker/action/shares/price/fee (and the plan's totals) from the **live** linked
    transaction, falling back to the leg's own snapshot only if no link exists (legs executed
    before this fix) or the linked transaction was deleted (marked with a `*`). (b) Separately,
    a real bug in the fee *estimate* for still-pending legs: `analyzeTradePlanByTicker`'s
    per-leg fee always used a plain standalone-leg calculation, with no awareness of the
    plan's *other* legs — so a plan with a same-day BUY and SELL of the same ticker (the
    exact "trade cycle" the planner exists for) charged full commission on both legs instead
    of PSX's real same-day-netting rule (commission on the larger-quantity side only, the
    smaller side pays levies only). Fixed with a new `calcLegFee` parameter (defaults to the
    old plain behavior, so QSE/other callers are unaffected) — `TradePlannerPage.tsx` builds
    a same-day-aware calculator from the plan's own not-yet-executed legs layered on top of
    the real transaction log, so legs within one plan now correctly net against each other
    exactly like real transactions do. (c) `FeeModeControl`'s Auto/Semi/Manual selector and
    its conditional Netted-checkbox/Fee-amount field previously relied only on `title` hover
    tooltips to explain themselves — invisible on mobile and easy to miss on desktop; each
    now has a visible `Field` label ("Fee mode," "Same-day netted?," "Fee amount"), and the
    checkbox's own text switches between "Netted (levies only)" and "Charged (full fee)"
    instead of a bare "Netted" that gave no clue what unchecking it meant. Verified live via
    Playwright: a same-day BUY(100)/SELL(50) pair in an unsaved plan correctly showed the BUY
    leg (larger qty) charged 23.00 PKR and the SELL leg netted to 0.00 PKR; marking the BUY
    leg done, then editing its linked transaction's shares/price from the Transactions page
    (100→150 shares, 100→110 price, no sign-in needed to edit an existing transaction),
    correctly updated the Trade Planner's row live on next view — zero console errors either
    way. New tests: `createWorkbookStore.test.ts` (id retrofit + leg-link-stays-live-after-
    edit), `tradePlanAnalysis.test.ts` (calcLegFee override actually used). `npx tsc -b` /
    `npm run test` (209 tests, 4 new) / `npm run build` all clean.
82. **Accordion (`CollapsibleCard`) rollout, round 2 — user repeated this request ("Accordian
    header still not implemented") after the first pass only covered Dashboard's Holdings/
    Alerts cards (Done item 74).** Wrapped every genuinely display-only section this pass
    could reach in `CollapsibleCard`: QSE's and PSX's `PositionDetail.tsx` (all 4 sections —
    Daily price, Current position, Open lots for PSX, All-time stats, Price range — previously
    plain `<h4>`-headed blocks with no Card wrapper at all, not just non-collapsible ones), and
    the display-only sections of every non-exchange module's landing page: Cash's "By
    category"/"Balance projection"/"Plans", Bank's identical three, Rentals' "By category"/
    "Monthly rollup", EMI's per-loan "Schedule," Funds' "Transactions," and the Transfers
    page's "Linked transfers" list. Deliberately **not** wrapped: add/edit forms ("Add a
    plan," "Map columns," Settings sections) — collapsing an input form mid-fill is a UX trap,
    not a convenience, so this rollout only ever targets read-only summary/list content, same
    scope decision as the original Dashboard pass. Personal Loans' `RepaymentsSection` was
    also deliberately skipped: unlike every other module here, its add-form and its list are
    one combined component with no natural seam to wrap only the list half without also
    hiding the form. Verified live via Playwright across every touched page (Cash, PSX
    StockPage) with zero console errors, including confirming the Cash "By category" and PSX
    "Daily price" headers actually toggle (`aria-expanded` true→false→true). Remaining
    unwrapped surface — Portfolio's Holdings/History tables (don't fit the pattern: each is the
    *entire* content of its own Tab, so collapsing it would just hide the whole tab), Analytics
    chart-grid cards, and Personal Loans'/EMI's/Funds' account-sync-status cards (trivial
    one-line content, low value) — is tracked as README Pending, not silently dropped.
    `npx tsc -b` / `npm run test` (209 tests, unchanged — UI-only) / `npm run build` all clean.
83. **Raw-vs-concise number display toggle, user-requested (2026-08-24).** README item 56's
    compact stat-card formatting (10,000 → "10k") was a fixed choice with no way to see raw
    numbers without hovering for the tooltip. New Appearance → "Number display" setting
    (`compact`/`raw`, defaulting to `compact` — today's unchanged look) and a shared
    `useAmountFormat()` hook (`hooks/useAmountFormat.ts`) that every call site now reads from
    instead of hardcoding `fmtMoneyCompact`/`fmtCompact`: `MoneyValue` (the ~9 stat cards using
    it), QSE's and PSX's Dashboard (9 more stat cards each, previously calling
    `fmtMoneyCompact` directly), and the Cash/Bank "N upcoming plans (net X)" sub-lines. In raw
    mode the redundant hover tooltip (which exists specifically to show the full number the
    compact form abbreviates) is skipped, since the visible text already is that number.
    Verified live via Playwright: a seeded 12,345,678 USD Cash balance showed "12.35M USD" by
    default, "12,345,678.00 USD" after switching the setting, and stayed raw across a page
    reload (persisted). New `hooks/__tests__/useAmountFormat.test.ts` (2 tests). `npx tsc -b` /
    `npm run test` (211 tests, 2 new) / `npm run build` all clean.
84. **Running balance columns added where they were genuinely missing, user-reported ("no
    running balance column in the cash transfers... same for other transactions").** Audited
    every transaction-style table in the app rather than assuming — Cash's ledger and Bank's
    transaction list already had one (`cashRunningLedger`/`accountRunningLedger`); the real
    gaps were QSE's and PSX's Transfers section (deposits/withdrawals into the trading
    account — no cumulative total at all) and Personal Loans' repayments list (no running
    "remaining outstanding" per repayment, only the loan's current total). New
    `lib/calc/transferBalance.ts`'s `transferRunningBalance()` (deposits add gross-minus-fee,
    withdrawals subtract gross-plus-fee, in date order) adds a "Balance" column to both QSE's
    and PSX's Transfers tables; new `repaymentRunningOutstanding()` in
    `lib/calc/personalLoansModule.ts` adds a "Remaining" column to Personal Loans' repayments
    list. Both are computed independent of the table's current sort order (same pattern as the
    Trade Planner's leg-value resolution) so the running total is always true chronological
    order regardless of which column the user sorted by. Deliberately its own running total,
    not the shared `cashSummary()` ledger that also includes trading activity — the Transfers
    section is specifically about cash moved in/out of the account. Verified live via
    Playwright with real multi-entry seeded data: PSX Transfers (10,000 deposit − 50 fee =
    9,950, then −2,000 withdrawal − 20 fee = 7,930) and Personal Loans (500 principal − 100 =
    400, − 150 = 250) both matched hand-calculated expectations exactly, zero console errors.
    New tests: `transferBalance.test.ts` (4 cases), `personalLoansModule.test.ts` gained 4
    `repaymentRunningOutstanding` cases. `npx tsc -b` / `npm run test` (219 tests, 8 new) /
    `npm run build` all clean.
85. **Real popup tooltips + grouped-column Holdings redesign, user-reported with a direct
    screenshot comparison against a competitor stock-analysis page ("clean, compact info rich
    UI... you are making useless UI with less data and more confusion").** Two concrete,
    specific gaps in that comparison, both fixed: (a) a permanent wall of explanatory text sat
    under the PSX add-transaction form, where the reference screen instead just labels things
    clearly and puts detail behind an on-demand affordance — replaced with one short sentence
    plus a new **`InfoIcon`** that opens a real tooltip on click/hover; (b) the reference groups
    naturally-related numbers into one visual block (OPEN/PREV CLOSE/VOLUME together, RANGES
    together) instead of one-fact-per-column — QSE's and PSX's Dashboard Holdings table
    columns were redesigned the same way: **Stock** (ticker + company name stacked), **Cost**
    (avg cost + break-even, break-even colored green/red vs. current price), **Value** (current
    worth + invested + a ▲/▼ indicator), **P/L** (amount + percentage) — four grouped columns
    replacing what were five separate same-size ones, matching the user's own earlier example
    almost verbatim ("Ticker+logo+name, Avg Cost & Break-even, PL amount & %age, Current Worth
    + Invested + arrow"). New shared **`components/Tooltip.tsx`** replaces native `title`
    hover-only tooltips (small, invisible on mobile/touch) everywhere a `title` string was
    passed to `StatCard`/`MoneyValue`/`FeeModeControl` — no call-site changes needed for
    `StatCard`/`MoneyValue` since they already took a `title` prop, just render it differently
    now. Real positioning bug found and fixed during verification, not assumed away: a naive
    "always open above the trigger" tooltip clipped off the top of the viewport for a
    long/multi-line tooltip near the top of a page (confirmed via an actual screenshot showing
    the popup's first few lines missing above frame) — fixed with a two-pass measure-then-place
    approach (mount hidden, measure real height, place above only if it actually fits, else
    below) using `position: fixed` so a trigger inside a scrollable table/card never gets
    clipped by the container's own `overflow` either. Verified live via Playwright screenshots,
    before and after: the add-transaction row went from a permanent 4-line paragraph to one
    line + an icon; the Holdings table visibly matches the grouped-block density of the
    reference; the tooltip's position bug was reproduced and then confirmed fixed with a
    before/after screenshot pair. A 23-page sweep across every module found zero new console
    errors. `npx tsc -b` / `npm run test` (219 tests, unchanged — UI/layout work) / `npm run
    build` all clean. **Scope note**: this pass covers the two most-viewed screens (Dashboard,
    the add-transaction form); Portfolio's own tables, StockPage, and every other module's
    lists still use the old one-fact-per-column layout and native-title-adjacent tooltips —
    tracked as Pending, the same "ship a vertical slice, document the rest" pattern used
    throughout this project rather than a blind app-wide rewrite in one pass.
86. **Portfolio page columns regrouped (QSE+PSX), continuing Done item 85's pattern.** The
    Portfolio page's Holdings table was the densest table in the app — 11 columns (Ticker,
    Trend, Shares, Avg Cost, Market Price, Break-even, Net P/L, +1%/+2%/+5% exit, Status).
    Regrouped to 8: **Stock** (ticker+name stacked), Trend, Shares, **Cost** (avg cost +
    break-even, break-even colored against current price), Market Price (editable input,
    unchanged), **P/L** (amount + percentage, new — percentage wasn't shown here before),
    **Exit targets** (the three +1%/+2%/+5% columns merged into one stacked cell), Status.
    Verified live via a Playwright screenshot with two seeded positions (one up, one down):
    grouping and coloring rendered correctly, zero console errors. `npx tsc -b` / `npm run
    test` (219 tests, unchanged — UI-only) / `npm run build` all clean.
87. **StockPage/PositionDetail regrouped + colorized (QSE+PSX), same "vertical slice"
    continuation (README items 43/45).** The per-stock page's stat-card grids were still the
    original flat single-color cards with one fact each. Regrouped: "Avg cost" + "Break-even"
    merged into one **Cost** card (break-even colored against the current price, same pattern
    as Dashboard/Portfolio); "Total bought"/"Total sold" merged into **Bought / Sold**; "Avg
    sell price"/"Last sell price" merged into **Sell price**; "First trade"/"Last trade"
    merged into **Trade dates**; "Realized P/L" now gets a profit/loss-colored card instead of
    a flat one. Every stat card on the page (Current position, All-time stats, Price range)
    now also gets a distinct `--card-hue` color, closing the same "every stat card had the
    identical flat single color" gap Dashboard's stat cards had before Done item 76 fixed it
    there — StockPage was never covered by that earlier fix. Verified live via a Playwright
    screenshot with a real multi-buy/multi-sell seeded position: all cards render distinct
    colors, grouped values match hand-calculated expectations, zero console errors. `npx tsc
    -b` / `npm run test` (219 tests, unchanged — UI-only) / `npm run build` all clean.
88. **`StatCard`/stat-card hue rollout finished for every module's landing summary (closes
    README item 43).** Extracted the hue palette + helper (previously copy-pasted per file,
    starting with Dashboard, then duplicated again for StockPage) into a shared
    `lib/statCardHues.ts` instead of a fourth-plus copy, and used it to color Cash's
    "Balance," Bank's "Total balance," Personal Loans' "Net position," EMI's "Monthly
    total"/"Outstanding"/"Paid so far," Funds' "Invested"/"Current value"/"Net profit," and
    Rentals' "Net income" stat cards — every module's very first, most-visible summary card(s)
    now get the same colored treatment Dashboard/StockPage already had, instead of the flat
    single-color look. Verified live via a 6-page Playwright sweep with seeded data for each
    module (zero console errors) plus two screenshots (EMI, Funds) confirming the colors
    actually render distinctly. `npx tsc -b` / `npm run test` (219 tests, unchanged — UI-only)
    / `npm run build` all clean.
89. **Table-cell tooltip sweep, continuing Done item 85's `Tooltip` component into the
    remaining scattered native `title=` spots it named as unswept.** Converted the Fee
    column's "(netted)"/"(override)" tags (both QSE... actually PSX-only, since same-day
    netting is a PSX concept — `TransactionsPage.tsx` and `StockPage.tsx`) and the Trade
    Planner's stale-snapshot `*` marker and "Executed" sync indicator (`TradePlannerPage.tsx`)
    from native `title` to the real popup `Tooltip`. Verified live via Playwright: hovering
    the "(netted)" tag on a seeded same-day BUY/SELL pair correctly shows a `role="tooltip"`
    popup, zero console errors. `npx tsc -b` / `npm run test` (219 tests, unchanged) / `npm
    run build` all clean.
90. **Banking Analytics tab built (2026-08-24), third module of README item 23's "per-module
    Analytics" wave (Cash and Personal Loans done earlier) — see MODULES_PLAN.md §11.** An
    account picker (not a currency picker — Banking's data is inherently per-account, unlike
    Cash) scopes three charts: Balance over time (Line, from the existing
    `accountRunningLedger`), Category breakdown (Doughnut, spend categories only — a category
    with net credit is excluded since mixing credit/debit into one doughnut isn't meaningful),
    and Income vs. spend by month (new `bankMonthlyFlow()`, mirroring Cash's
    `cashMonthlyFlow()` but built from Bank's signed-`amount` transactions instead of Cash's
    IN/OUT+unsigned-amount shape). Also built the "simple budget/spend-plan tool"
    MODULES_PLAN.md §11 asked for: a new `BankSettings.budgets` field (category name -> a
    monthly target amount, optional so existing workbooks parse unchanged) and `setBudget`
    store action, compared each month against actual spend via new `budgetVsActual()` — a
    category with spend but no set target still shows in the table (target column reads "—"),
    not silently dropped, since that's exactly the case a real budget tool needs to surface.
    Verified live via Playwright with a seeded account (3000 salary, 350 groceries spend
    against a 300 target, 80 fuel spend unbudgeted): balance trend correctly stepped
    2000→5000→4650→4570, category doughnut showed Groceries 350/Fuel 80 (Salary correctly
    excluded), income-vs-spend showed 3000/430, and the budget table correctly flagged
    Groceries as 50 over target (red) while showing Fuel's actual with no target — "Add budget
    category" correctly hit the sign-in gate. New tests: `bankModule.test.ts` gained 5 cases
    for `bankMonthlyFlow`/`budgetVsActual`. `npx tsc -b` / `npm run test` (224 tests, 5 new) /
    `npm run build` all clean. **Next per MODULES_PLAN.md §11's suggested order**: EMI/Loans,
    then Funds, then Rentals.
91. **EMI/Loans Analytics built (2026-08-24), fourth module of the same wave — see
    MODULES_PLAN.md §11.** Two additions to each loan's own detail page (`LoanDetail` in
    `EMIPage.tsx`, not a separate tab — EMI's per-loan detail view is already where all its
    numbers live). (a) An "Amortization schedule" stacked bar chart (Principal vs.
    Interest/Markup per month, from the already-existing `emiSchedule()` — no new calc
    needed, purely visualizing data that was already computed for the schedule table below
    it). (b) A "What if: extra payment" live planner: enter a fixed extra amount on top of
    the normal installment, see the new payoff month count, new expected end date, and
    interest/markup saved — new `whatIfExtraPayment()` in `lib/calc/emiModule.ts`, handling
    both repayment modes (`interest`: re-runs the reducing-balance formula with a larger
    monthly payment until the balance clears, capped at the original tenure; `fixedTotal`:
    `Math.ceil(principal / (principalPerMonth + extra))` months, with markup prorated by the
    new month count — a documented simplification, not a claim about any specific lender's
    real early-payoff terms). Both existing 7 stat cards on the page and the 3 new what-if
    result cards got the `--card-hue` colored treatment via the shared `lib/statCardHues.ts`
    helper (same rollout as Done item 88). New tests: `emiModule.test.ts` gained 4
    `whatIfExtraPayment` cases (no-op at 0 extra; exact proportional payoff for a 0%-rate
    loan; fixedTotal-mode markup savings; general interest-mode sanity bounds). Verified live
    via Playwright with a seeded $10,000/12mo/12%-p.a. loan: the amortization chart correctly
    showed principal rising/interest falling month-to-month, and a $100/month extra payment
    correctly projected 11 months (1 sooner), new end date 2026-12-01, and $65 interest
    saved — matching the unit-tested math exactly. `npx tsc -b` / `npm run test` (228 tests,
    4 new) / `npm run build` all clean. **Next per MODULES_PLAN.md §11's suggested order**:
    Funds, then Rentals.
92. **Funds Analytics built (2026-08-24), fifth module of the same wave — see MODULES_PLAN.md
    §11.** New Analytics tab on `FundsPage.tsx` with a currency picker (shown only when more
    than one currency is present) plus a fund picker that scopes two of the three charts.
    "Allocation by category" (Doughnut) sums current value by category across every fund in
    the selected currency — new `allocationByCategory()` in `lib/calc/fundsModule.ts`, a fund
    with zero current value (fully sold, or no NAV known) is omitted rather than shown as a
    meaningless zero-width slice. "NAV over time" (Line) is the selected fund's own
    `priceHistory`, reusing the already-existing `getDailyPriceHistory()` — genuinely empty
    (shows "Not enough data yet") for a fund that's only ever been bought/sold with no
    separate "Update NAV" click. "Contribution vs. value" (Line, two series) is the more
    interesting new piece: new `contributionVsValueSeries()` walks every date where something
    is known (a transaction, or a NAV update) and tracks cumulative net invested next to what
    the position was actually worth at that point — and **deliberately treats each
    transaction's own price as an implicit NAV observation** when no explicit "Update NAV"
    exists for that date, falling back to the last known price otherwise (same fallback idea
    as `getMarketPrice`'s "last BUY price" rule) — so a fund with zero manual NAV updates
    still gets a meaningful value line instead of a flat zero, verified live with exactly that
    case (US Bonds: no NAV history, "NAV over time" correctly shows empty while "Contribution
    vs. value" still plots its one known point from the buy price). New tests:
    `fundsModule.test.ts` gained 6 cases (category scoping/omission/currency-isolation for
    `allocationByCategory`; implicit-price fallback, explicit-NAV precedence, SELL handling,
    and empty-fund for `contributionVsValueSeries`). Verified live via Playwright with two
    seeded USD funds (one with NAV history, one without): allocation doughnut showed Equity
    2,100/Debt 1,040, NAV-over-time correctly traced 10→12→11→14, and contribution-vs-value
    showed Invested/Value diverging correctly (1,550 invested vs. a higher value line) —
    switching the fund picker to the NAV-less fund correctly emptied just that one chart while
    the other two still rendered. `npx tsc -b` / `npm run test` (234 tests, 6 new) / `npm run
    build` all clean. **Next per MODULES_PLAN.md §11's suggested order**: Rentals — the last
    module in this wave.
93. **Rentals Analytics built (2026-08-24), sixth and final module of the per-module Analytics
    wave — see MODULES_PLAN.md §11. Every module in README item 23 now has an Analytics tab.**
    A currency picker (multi-currency only) plus a property picker scope three charts. "Net
    income by property" (horizontal Bar, new `netIncomeByProperty()` in `lib/calc/
    rentalsModule.ts` — one row per property in the picked currency, green/red colored by
    sign, mirroring Personal Loans' "Outstanding by loan" chart pattern) is portfolio-wide,
    not per-property. "By category" (Doughnut) and "Monthly rollup" (Bar, income vs. expense)
    are both for the selected property — reusing the already-existing `propertyByCategory()`/
    `propertyMonthlyRollup()` as-is (they already fed the plain tables already present in the
    Entries tab; this just adds a charted view alongside them, doesn't replace the tables).
    New tests: `rentalsModule.test.ts` gained 1 case for `netIncomeByProperty` (currency
    scoping/exclusion). Verified live via Playwright with two seeded USD properties
    (Apartment 4B net +2,800, Studio 2A net -100): the property bar chart correctly
    color-coded the negative property red, and switching the property picker correctly
    updated both the category doughnut and monthly rollup to that property's own numbers
    (Studio 2A: Rent income 800 / Repairs 900, matching hand-calculated). `npx tsc -b` / `npm
    run test` (235 tests, 1 new) / `npm run build` all clean. **This closes out README item
    23 in full** — Cash, Personal Loans, Banking, EMI/Loans, Funds, and Rentals all now have
    an Analytics tab (Done items 44/45/90/91/92/93).
94. **Statement CSV export extended to Personal Loans and EMI/Loans (2026-08-24) — see README
    item 40, extending Banking's pattern from Done item 58.** Personal Loans' `LoanDetail` gets
    a from/to date-range "Export CSV" button next to its repayments table, exporting Date/
    Amount/Remaining/Source — reusing the same `remaining` (running-outstanding) map the table
    itself already displays, so the export can't drift from what's on screen. EMI's
    `LoanDetail` gets an "Export full schedule CSV" button under its Schedule card, exporting
    every remaining installment (not just the next-12 slice shown on screen) with its due date
    (`installmentDueDate()`), installment/interest/principal/balance. Both reuse the existing
    module-agnostic `toCSV()` helper (`lib/csv.ts`), no new export logic. Verified live via
    Playwright with a real file download (not just a code read, same rigor as Done item 58):
    read the downloaded Personal Loans CSV off disk and confirmed the Remaining column matched
    hand-calculated running balances (1000 → 800 → 500), and the EMI CSV had exactly 13 rows
    (header + 12 months) with correct due dates. `npx tsc -b` / `npm run test` (235 tests,
    unchanged) / `npm run build` all clean. **Still open per item 40**: QSE/PSX positions,
    Funds, and Rentals don't have a CSV export yet — each already has its own detail view
    (PositionDetail, FundDetail, PropertyDetailModal), just needs the same button added.
95. **Statement CSV export extended to Funds and Rentals (2026-08-24) — completing README item
    40 for every module except QSE/PSX.** Funds' `FundDetail` gets a from/to date-range
    "Export CSV" button below its Transactions table (Date/Type/Units/NAV/Amount). Rentals'
    per-property `EntriesList` (Income & expenses tab) gets the same button below its entry
    table (Date/Type/Amount/Category/Note, amount signed by type same as the on-screen table).
    Both reuse the existing `toCSV()` helper, no new logic. Verified live via Playwright with
    real file downloads read off disk: the Funds CSV matched its two seeded buy transactions
    exactly, and the Rentals CSV matched its seeded rent-income/expense pair with correct
    signed amounts. `npx tsc -b` / `npm run test` (235 tests, unchanged) / `npm run build` all
    clean. **Only QSE/PSX positions remain for item 40** — `PositionDetail` already has a
    per-stock transaction history and price-history table; adding the same export button
    there needs a touch more design since a stock statement plausibly wants both the trade
    log and the price history, not just one table like every other module here.
96. **Statement CSV export extended to QSE and PSX, completing README item 40 for every
    module (2026-08-24).** Resolved the "touch more design" note from Done item 95 by
    exporting the two logs separately rather than merging them into one table, since a trade
    and a price update aren't the same kind of row and forcing them into one CSV would mean
    empty columns on every row: each stock's **Transactions tab** (`TickerTransactions` in
    both `features/qse/pages/StockPage.tsx` and `features/psx/pages/StockPage.tsx`) gets the
    same from/to date-range "Export CSV" button as every other module (Date/Action/Shares/
    Price/Cost, plus a Fee column for PSX since its fees are variable — same-day netting,
    manual overrides — unlike QSE's flat rate); separately, `PositionDetail.tsx`'s existing
    "Recent updates" `<details>` section gets its own "Export price history CSV" button,
    exporting the **full raw price log** (`stats.chronological`), not just the 8-row "recent"
    slice already shown on screen — same "export more than the on-screen slice" pattern
    already used for EMI's full-schedule export (Done item 91). Both reuse the existing
    `toCSV()` helper. Verified live via Playwright with real file downloads read off disk for
    all four combinations (QSE/PSX × trade statement/price history): each matched its seeded
    data exactly, including PSX's per-row computed fee in the trade statement. `npx tsc -b` /
    `npm run test` (235 tests, unchanged) / `npm run build` all clean. **This closes out
    README item 40 in full** — every module now has a statement export from its own primary
    record's detail view.
97. **Portfolio's closed-positions (History) table regrouped, completing README item 45
    (2026-08-24).** The last one-fact-per-column table from that item's list: QSE's and PSX's
    `ClosedPositionsTable` (`PortfolioPage.tsx`) went from 8 columns (Ticker, Name, Bought,
    Sold, Realized P/L, Fees paid, First trade, Last trade) to 4 grouped ones — Stock
    (ticker+name), Bought / Sold, P/L (realized amount with fees paid as a sub-line), and
    Trade dates (first → last) — same grouping pattern already used for the Holdings table
    (Done items 85/86) and StockPage's stat cards (Done item 87). Sort keys were reduced to
    one representative column per group (ticker/bought/realized/last-trade-date), same
    tradeoff already accepted for every other grouped-column table in the app. Verified live
    via Playwright with two seeded closed QSE positions (one profitable, one at a loss): the
    screenshot confirmed all 4 columns render correctly with fees shown as a sub-line and the
    P/L cell color-coded — a body-text substring check for "Bought / Sold" came back false
    positive-negative purely from the `.label`/`th` CSS `text-transform: uppercase` (the
    known false-negative pattern already documented earlier in this file), not a real miss.
    `npx tsc -b` / `npm run test` (235 tests, unchanged — UI-only) / `npm run build` all
    clean. **This closes out README item 45 in full.**
98. **Further tooltip sweep, continuing README item 47's remainder (2026-08-24).** Converted
    the highest-value remaining native `title=` spots to the real popup `Tooltip` component:
    QSE's and PSX's `PositionDetail.tsx` "Sell price" and "Median (fair value)" stat cards
    (4 total — these predate the `StatCard` component's own built-in `title`-to-`Tooltip`
    wiring, so they'd been missed by that earlier rollout), Personal Loans' repayments table
    "Remaining" column, and QSE's/PSX's Transactions table "Balance" column — the latter two
    are exactly the "per-lot/per-transaction table cells" this item's own text named as
    unswept. Deliberately left as native `title` (lower value, more invasive to convert):
    single-word `<select>` labels (Appearance's font/size/color/density/number-display
    pickers, whose own option text is already self-explanatory), "Flip sign" import
    checkboxes (Cash/Bank/Rentals — the import tab already has an explanatory paragraph
    above them), and raw `<input>` hint text (Bank's "+/-" amount field, whose placeholder
    already says as much) — converting these would mean restructuring simple form controls
    for marginal benefit, not because they were missed. Verified live via Playwright
    (hover-based, not click, since click toggles state and can look like "not working" in
    an automated check that doesn't also verify the toggle-off): all 3 conversions showed a
    real `role="tooltip"` popup with the correct text on hover, zero console errors.
    `npx tsc -b` / `npm run test` (235 tests, unchanged) / `npm run build` all clean. **Item
    47's remainder is now narrower**: CollapsibleCard headers and the deliberately-skipped
    items named above are what's left, not a full sweep.
99. **New Subscriptions module built (2026-08-24) — README item 24, seventh module beyond the
    original six, per the design sketch in `MODULES_PLAN.md` §12.** Tracks recurring payments
    (streaming, gym, software, memberships) independently of any other module's ledger, with
    an optional link to whichever Bank account or Cash actually pays them. Reuses
    `createEntryStore` (same shape as EMI/Cash — `Subscription[]` under `entries`), own
    Firebase path `users/{uid}/subscriptions`. Cancelling a subscription sets `active: false`
    + `cancelledDate` rather than deleting it, so spend history survives — deletion is still
    available separately for genuine removal. New `lib/calc/subscriptionsModule.ts`:
    `nextBillingDate()`/`monthlyEquivalent()` (normalizes any billing cycle — monthly/yearly/
    weekly/custom-days — to a comparable per-month figure), `totalMonthlySpendByCurrency()`,
    `upcomingRenewals()`, `spendByCategory()`, and `generateRenewalOccurrences()` (every
    renewal from the next one forward, capped at a 12-month horizon — same "12 months means
    12 points, not 13" off-by-one fix already applied in `rentalPlanning.ts`). **"Generate
    renewal plans"** resolves the open design question MODULES_PLAN.md §12 flagged ("auto-
    generate a linked transaction, or just track existence/cost?") by reusing the same
    generate-a-planned-entry pattern EMI/Loans' "Link to bank" and Rentals' lease-projection
    already shipped, rather than the heavier full bidirectional cross-entity-link record
    (item 21's own remainder) — picking Bank or Cash creates a `PlannedBankTransaction`/
    `PlannedCashEntry` per upcoming occurrence (new `sourceSubscriptionId` field on both
    types, mirroring EMI's `sourceEmiLoanId`, so re-linking replaces only this subscription's
    own not-yet-done plans). Analytics tab covers all four items MODULES_PLAN.md §12 named:
    total monthly/yearly recurring spend (on the landing view, colored stat cards), spend by
    category (Doughnut), spend by paying account (Bar, joins with Bank account names), and
    upcoming renewals in the next 30 days (table). New tests: `subscriptionsModule.test.ts`
    (14 cases, hand-traced cycle math for all four billing types). Verified live via
    Playwright with two seeded active subscriptions and one cancelled: the landing list
    showed correct amounts/next-renewal-dates/status, Monthly recurring spend summed
    correctly (45 USD), the "Generate renewal plans" flow correctly listed 12 monthly
    occurrences and hit the sign-in gate, and the Analytics tab's three charts all matched
    hand-calculated numbers (category doughnut, paying-account bar showing "Not linked"
    since generation was gated by sign-in, and both subscriptions correctly appearing in the
    30-day upcoming-renewals window) — zero console errors. `npx tsc -b` / `npm run test`
    (249 tests, 14 new) / `npm run build` all clean.
100. **Funds added as a cross-entity-linking module — README item 21's remainder (2026-08-24).**
     Exposed Funds' `Transfer` field (inherited unused from the full `createWorkbookStore`
     factory) in the Transfers page, resolving the "can follow once its Transfer field is
     actually exposed" note that had blocked this since Done item 29. Since `FundsWorkbook`
     already uses the exact same `Transfer` type as QSE/PSX, this was a mechanical addition
     mirroring their existing case throughout: `types/interEntityTransfer.ts` gained `'funds'`
     to `LinkModule`, `lib/interEntityLink.ts`'s `buildSideRecord` folds it into the same
     `case 'qse': case 'psx':` branch (DEPOSIT/WITHDRAWAL, zero fee), `lib/linkCascade.ts`'s
     three dispatch switches gained a `funds` case using `useFundsWorkbookStore`'s existing
     `addTransfer`/`updateTransfer`/`deleteTransfer`, and `isSupportedLinkPair` allows
     Bank/Cash↔Funds (the same "only pairs with the two hub modules" rule every other
     module here follows — no Funds↔QSE/PSX/Rentals/PersonalLoans pairing). **One real
     design call**: unlike QSE/PSX, Funds has no single portfolio currency (funds can be
     added in different currencies) — `TransferLinksPage.tsx` uses `settings.defaultCurrency`
     as the Funds side's currency for display/mismatch-warning purposes, a pragmatic
     stand-in that matches the same implicit single-currency assumption `useFundsDerived`'s
     already-unused `cashSummary`/`buildCashLedger` calls made before this change — not a
     new problem introduced here. New tests: `interEntityLink.test.ts` gained 2
     `buildLinkedRecords` cases (Bank→Funds, Funds→Cash) and extended both
     `isSupportedLinkPair` cases (accepted pairs, rejected pairs) to cover Funds. Verified
     live via Playwright (same reduced-verification precedent as Rentals/Personal Loans
     linking — no real Firebase Auth round-trip attempted against the production project):
     selecting Funds as either side correctly shows its (default) currency, no
     unsupported-pair warning fires for Bank/Cash↔Funds, and the page's own intro text
     correctly lists the new pairing — zero console errors. `npx tsc -b` / `npm run test`
     (251 tests, 2 new) / `npm run build` all clean. **Item 21's only remaining gap**: EMI
     still has no repayment ledger to link into at all (a data-model question, not a UI gap).
101. **Chart cards made collapsible app-wide — README item 42's "chart cards on Analytics
     pages... worth a design look" remainder (2026-08-24).** Every module's Dashboard/
     Analytics charts (QSE/PSX's 18-chart Analytics pages, both Dashboards, and all six
     non-exchange modules' newer Analytics tabs) render through one shared
     `features/qse/components/ChartCard.tsx` component — changing that single component to
     build on the already-existing `CollapsibleCard` instead of a plain `Card` made every
     chart in the app collapsible in one place, the same fix-once-at-the-shared-layer pattern
     already used for `MoneyValue`/`StatCard`/`Field`. Defaults open (`CollapsibleCard`'s own
     default), so no chart's default visibility changed — this only adds the ability to
     collapse a specific chart, on a page where up to 18 might be shown at once. Deliberately
     left as previously scoped in item 42: Personal Loans' `RepaymentsSection` (its add-form
     and list are one combined component, no clean seam) and Portfolio's Holdings/History
     tables (each is the entire content of its own Tab, needing a different UI shape than a
     plain collapsible wrap). Verified live via Playwright on the QSE Dashboard with a real
     canvas-count check (not just a screenshot): collapsing one chart dropped the page's
     canvas count from 2 to 1, and reopening it restored exactly 2 — confirming the chart
     genuinely unmounts/remounts cleanly through `CollapsibleCard`'s existing conditional-
     render mechanism (the same one already proven working for EMI's Amortization-schedule
     chart, shipped earlier this session). `npx tsc -b` / `npm run test` (251 tests,
     unchanged — UI-only) / `npm run build` all clean.
102. **PSX Trade Planner's Saved Plans made into a real accordion header, user-reported UI bug
     (2026-08-24).** Two related complaints: the card's header didn't act as the accordion
     toggle (a separate "Expand"/"Collapse" button did instead — clicking the name/title did
     nothing), and the action buttons ("Full screen"/"Edit"/"Clear plan"/"Delete plan") sat in
     their own row that could visually land in an awkward spot next to the title rather than
     staying pinned to the right edge ("hanging in between"). Root cause of both: `PlanCard`
     had its own hand-rolled header (`justifyContent: 'space-between'` row) and its own
     `collapsed`/`setCollapsed` state wired only to a dedicated button, instead of using the
     `CollapsibleCard` component already used everywhere else in the app for exactly this
     pattern. Rewired `PlanCard` (non-full-screen mode) onto `CollapsibleCard`: the plan
     name/meta (or, mid-edit, the rename form) is now the `title` — clicking anywhere on the
     header row toggles the accordion — and the four action buttons move into `headerExtra`,
     which `CollapsibleCard` already renders in its own right-aligned, click-stops-
     propagation container, fixing both the "click header to expand" behavior and the button
     alignment in one change. The rename form's own container also gets an explicit
     `stopPropagation` so clicking into its inputs or its Save/Cancel buttons doesn't
     double-fire the accordion toggle. Full-screen mode (a fixed-position overlay showing
     the plan's full content unconditionally) keeps its previous plain-`div` structure
     unchanged, since it never had — or needed — its own collapse toggle. Verified live via
     Playwright: clicking the header title toggled `aria-expanded` true→false→true correctly
     (confirmed via the attribute, not just a screenshot); clicking "Edit" opened the rename
     form while the accordion stayed expanded and the button row correctly dropped "Edit"
     itself while keeping the rest right-aligned; full-screen mode still shows all content
     immediately with no accordion header at all — zero console errors throughout. `npx tsc
     -b` / `npm run test` (251 tests, unchanged — UI-only) / `npm run build` all clean.
103. **Design-system critique, 11-item batch (2026-08-24) — user posted a screenshot of PSX
     Risk Analysis plus a list of cross-cutting UI/UX complaints. Most items were genuine,
     confirmable defects (not taste), fixed at shared-component/shared-CSS level so the fix
     applies app-wide from one change, matching this file's existing "fix once" pattern.**
     - **(2) Avg buy price not rounding to 2dp**: `RiskCalculator.tsx` prefilled the "Avg buy
       price" input straight from `invested/shares` with no rounding — fixed with
       `Math.round(...*100)/100` at the point of prefill.
     - **(6) Underlined nav links**: root cause was `theme.css`'s base `a{color:inherit;}` never
       resetting `text-decoration` — every `<Link>`/`<a>` in the app (nav buttons, "Full
       portfolio →", "← Back to Portfolio", Watchlist ticker links) inherited the browser's
       default underline. One-line fix (`text-decoration:none`) resolved it everywhere.
     - **(10/11) Left-border "warning" boxes / notices not distinct**: found the exact same ad
       hoc `<div className="card" style={{borderLeft:'3px solid var(--warn, orange)'}}>` cloud-
       sync-empty warning copy-pasted across 12 files (Cash/Bank/EMI/Funds/Rentals/Personal
       Loans/Subscriptions/Transfers/QSE+PSX Settings), plus two more ad hoc instances in
       `RiskCalculator.tsx`. New `components/Notice.tsx` (tone: info/warning/danger/success) —
       full tinted background + matching border on every side + a leading icon, no left bar —
       replaces all 15 call sites. New `.notice`/`.notice-*` CSS in `theme.css`.
     - **(5) P/L highlighting should color the whole card, not just text**: `RiskCalculator`'s
       stat cards were a real gap in the earlier app-wide `StatCard` `hue` rollout (Done item
       88) — it never actually touched this page. Added `hueStyle()` (profit/loss-driven for
       P/L cards, palette-driven for the rest) to every stat card on the page.
     - **(4/9) Shadows inconsistent / cards & tables inconsistently rounded**: a real audit of
       `theme.css` found the `.card`/`.card.stat-card`/`.card.chart-card` box-shadow and
       border-left rules had accumulated **three to four competing definitions** at different
       points in the file from repeated "add an override further down so it wins" patches —
       confirmed dead by checking which rule actually won (same-specificity, later-in-file always
       wins) and removed the losing ones rather than leaving them as a red herring for the next
       session. Introduced `--shadow-card`/`--shadow-lg`/`--radius-lg` tokens so every card-family
       shadow and the Material theme's/console density's radius values reference one named token
       instead of each inventing its own numbers. `.stat-card`'s left-border accent was dropped
       entirely (the colored gradient background + `hue` prop already carry the per-card color
       identity; a bar on top of that was redundant clutter, not a second useful signal).
     - **(1) Chips hide sections instead of navigating to them, and inconsistent-filter
       confusion**: the shared `components/Tabs.tsx` (used by Analytics/Transactions/Settings/
       every tabbed sub-page in the app) fully unmounted every non-active tab's content — "keep
       pressing chips just to view a small piece of info." Rewrote it so every section renders
       as its own `CollapsibleCard` (first one open by default, same as before), and a chip
       click now scrolls to that section and forces it open rather than hiding the others —
       nothing is ever unreachable, it's just further down the page. Required making
       `CollapsibleCard` support an optional controlled `open`/`onToggle` pair (additive; every
       other of its ~30 call sites keeps its original self-contained behavior). Also added a
       small "(whole portfolio — not filtered)" badge (new `ChartCard` `unfiltered` prop) to the
       5 whole-portfolio Analytics charts (Realized vs unrealized P/L, Cash vs stocks split,
       Cash balance over time, Deposits vs invested vs net worth, Fees breakdown) that
       deliberately ignore the ticker/month filter — the user's own concrete example ("filters
       work on some and leave others") was this exact ambiguity, previously explained only in a
       filter-bar paragraph easy to scroll past.
     - **Verified live via Playwright** (not just described): Avg buy price showed exactly 2
       decimals against a real fee-inclusive cost basis; every `<a>` on the Dashboard read
       `text-decoration-line: none`; Risk Analysis's two `Notice` boxes rendered as a green
       "not underwater" banner and a gold diminishing-return box, screenshot-confirmed with no
       left bar; the Transactions page's Tabs redesign showed both "Add transaction(s)" and
       "Transaction list" open simultaneously after clicking the second chip (`aria-expanded`
       read `[true, true, false, false, false, false]`), with the other 4 sections visible but
       collapsed on the same page; the Analytics page showed the same pattern plus the new
       "(whole portfolio — not filtered)" badge; zero console errors across Settings/PSX
       Settings/Bank/Subscriptions smoke-checked separately. `npx tsc -b` / `npm run test` (251
       tests, unchanged — no calc logic touched) / `npm run build` all clean.
     - **Deliberately scoped down, not attempted in this pass** (see Pending): (3) font choice
       for continuous-reading legibility, (7) a genuine "assess a stock in one go" information-
       architecture redesign, and (8) making themes/densities actual structural variations
       rather than color/spacing swaps — all three are large, subjective, high-regression-risk
       redesigns that deserve their own scoped session rather than a guess folded into this
       batch.
104. **Trade Planner follow-up batch (2026-08-24), user-reported right after Done item 103 —
     three items, see Pending items 51-53 for the pre-fix framing.**
     - **(51) Entity id audit.** `Adjustment`/`Dividend` gained `id?: string` (same optional-
       retrofit pattern as `Transaction`/`Transfer` — backfilled by `createWorkbookStore.ts`'s
       `normalize()` on every load/`setWorkbook`, and assigned on creation by `addAdjustment`/
       `addDividend` for new records). Deliberately did NOT switch `updateAdjustment`/
       `removeAdjustment`/`updateDividend`/`removeDividend` off index-based addressing — nothing
       currently needs to reference a specific one the way linking needs `Transfer.id`, so this
       is groundwork for whenever that changes, not a full addressing switch (same reasoning
       `Transaction.id` followed before Done item 81 built on it).
     - **(52) Trade Planner leg showing stale data after editing its linked transaction.**
       Traced the actual resolution mechanism (`resolveExecutedTx` in `TradePlannerPage.tsx`,
       `updateTransaction`'s index-based addressing in `createWorkbookStore.ts`) end to end and
       found it correct — both `TransactionsPage.tsx`'s and `StockPage.tsx`'s edit flows
       preserve the real global array index (and therefore the transaction's `id`) through
       filtering/sorting/grouping. The much more likely explanation: the user's leg was almost
       certainly executed *before* Done item 81 shipped the link at all (same very long session,
       so easily older test data) — with no `executedTransactionId` to resolve from, the row
       silently fell back to the leg's own frozen snapshot with only a barely-visible "*"
       tooltip as a clue. Fixed the actual gap rather than a phantom bug in the resolver: a
       stale/unlinked executed leg now shows a red "Executed (unlinked)" status plus a
       warning-toned "⚠" marker, and a new "Link…" button opens an inline picker (a `<select>`
       of that ticker's own transactions) to manually establish the missing link — safer than
       guessing a fuzzy match automatically, which could silently link the wrong transaction.
       Also built the user's second ask: a linked leg's transaction is now directly editable
       inline from the Trade Planner itself (new `startEditTx`/`saveEditTx`, looks up the
       transaction's current array index by its stable id right before saving rather than
       capturing a possibly-stale index up front) — no trip to the Transactions page needed.
     - **(53) Fee always priced at full commission; summary buried.** New `feeScenarios()` in
       `psxFees.ts` (pure, tested) returns both the full-commission and same-day-netted totals
       for a hypothetical leg, independent of what else happens to be in the plan already —
       every pending leg's "Est. fee" cell now shows both side by side ("Full 15.99 PKR ·
       Same-day netted 1.05 PKR"), so the potential same-day saving is visible while still
       planning, not just after the fact. This is shown *alongside*, not instead of, the
       existing automatic `legFee`/`calcLegFee` best-guess (which stays accurate for a leg that
       already does pair with another leg in the same plan). Separately, a row of colored
       `StatCard`-style summary cards (one per ticker, `hueStyle` from the shared palette,
       showing avg cost/break-even/shares-after-plan/planned P&L) now sits above the detailed
       per-ticker table — the at-a-glance read the user asked for, without removing the
       detailed table underneath.
     - **Verified live via Playwright** with a seeded stale (no-link) executed leg and a
       pending same-day-fee-eligible leg: "Executed (unlinked)" status and the Link… picker
       both appeared and correctly re-linked to the right transaction (confirmed via
       `localStorage`, not just the UI); editing the now-linked transaction's shares inline and
       saving correctly updated both the on-screen plan row and the underlying transaction
       record (`localStorage` read back the new share count directly); the fee-scenario note
       rendered as a genuine second line in the cell (confirmed via `getComputedStyle` — a
       screenshot at this resolution made it look visually squeezed together, which would have
       been a false "bug" if trusted without the layout check); zero console errors throughout.
       New tests: `psxFees.test.ts` gained 2 `feeScenarios` cases. `npx tsc -b` / `npm run test`
       (253 tests, 2 new) / `npm run build` all clean.
105. **PSX Risk Analysis 7-item feedback batch, plus a same-day single-ticker Trade Planner
     simplification requested right after (both 2026-08-24).**
     - **(1) Target price/shares/amount calculator.** Asked the user to clarify exactly what
       "Additional capital" should become (AskUserQuestion) — confirmed: replace it outright
       with a 3-way linked calculator (any 2 of Target buy price / Target shares to buy /
       Target amount compute the 3rd), same interaction pattern already used by
       TradeCalculator's Buy price/New shares/Amount row. Avg buy price stays exactly as-is
       (a free-type override pre-filled from real data — the user confirmed that's wanted, not
       a bug). The new Target buy price also fixes a real modeling gap: the old "Additional
       capital" always priced every scenario at the live Current price, with no way to model a
       limit order below/above it — averaging down in practice is usually a specific price, not
       necessarily today's.
     - **(2) Alerts eating space.** Root cause: `CollapsibleCard` around `AlertsBox` on both
       QSE's and PSX's Dashboard had no `defaultOpen` prop, so it silently defaulted to fully
       expanded — collapsed it by default (the existing first-visit toast — "N alerts, see
       Alerts below" — remains the discovery path). Also gave the "Meaningful averaging points"
       table's colored P/L cell real cell padding (it was flush against the cell edge, at risk
       of visually blending into neighboring rows).
     - **(4) Tooltips still missing.** Extended `Field` (the shared label+input wrapper used
       app-wide) with an optional `title` prop that wraps the label in the existing `Tooltip`
       component — added explanations to every jargon-y input on the Risk Analysis page (Risk
       mode, Avg buy price, Target buy price, Target sell price, Min net profit, Stress
       drawdown) and to the "Recovery"/"Net P/L @ target"/"Signal" table headers. Also extended
       `StatCard` with a new `labelTitle` prop (tooltip on the *label*, e.g. "what does
       Break-even mean") — deliberately separate from the existing `title` prop (tooltip on the
       *value*, used everywhere else for showing full precision on an abbreviated number) so
       reusing one prop for two different jobs didn't quietly change what `title` means at
       every other call site in the app.
     - **(5) Symbols/icons/colors for meaningful data.** The "Signal" column (Selected/
       Diminishing/Useful) was plain text — now a colored `.pill` badge with an icon (✓
       Selected, ⚠ Diminishing, plain Useful), reusing the same `.pill-buy`/`.pill-sell`
       language already used for BUY/SELL everywhere, plus two new variants (`.pill-warn`,
       `.pill-info`) for signals that aren't a P/L direction.
     - **(6) Backgrounds on whole cards, not just text.** Mostly already true from the
       preceding design-feedback batch (Done item 103's `StatCard` `hue` rollout onto this
       page) — reinforced by making the new Signal/Net-P&L-at-target badges full-background
       pills instead of colored text, consistent with the same principle.
     - **(7) Card titles should read as titles.** `theme.css` gained
       `.card h3, .card h4{text-transform:capitalize;}` — scoped to actual heading elements
       only (never a plan's own free-typed name, which renders via a plain `<strong>`/`<div>`,
       not a heading), so this can't mis-capitalize anyone's real data.
     - **(3) "Simplest language" and the later "utilize page space" note** are standing
       app-wide guidelines now, not one-shot fixes — see the Design decisions section in
       `CLAUDE.md`.
     - **Single-ticker Trade Plans (user-reported same day, right after this batch):** "1
       ticker may have plans but not vice versa" — a plan is now scoped to exactly one ticker
       (was: an optional "default ticker" that individual legs could still override,
       intentionally allowing mixed-ticker plans in an earlier session — the user's newer
       instruction supersedes that). `NewPlanForm`'s per-leg ticker input is gone entirely
       (one less field per row); the plan-level "Ticker" field is now required to save.
       Existing/saved plans (`PlanCard`) lost their per-leg ticker inputs too — "+ Add leg"
       and the edit-leg row both lock to the plan's own ticker, shown as plain text instead of
       an editable field. Renaming a plan's ticker now re-tickers every still-*pending* leg to
       match (executed legs are left alone — they already created their own real Transaction).
       The plan header now shows the ticker as a visible `pill-info` badge next to the plan
       name instead of a buried "· default ticker X" footnote.
     - **Verified live via Playwright**: the 3-way calculator correctly derived Target amount
       from price×shares; `StatCard`/`Field` tooltips confirmed via `hover()` (an earlier
       `.click()`-based check falsely read as "not working" — Playwright's `.click()` fires a
       hover-then-click, and the Tooltip component's own `onClick` toggles state, so a click
       opens-then-immediately-closes it; hover is required for a false-negative-free check,
       matching how earlier tooltip sweeps in this project were already verified); a
       single-ticker plan saved via the form is only reachable via the sign-in gate as
       expected, and a plan seeded directly shows its ticker pill, offers no ticker input on
       Add-leg, and a leg added through the UI correctly landed with the plan's own ticker
       (confirmed by reading `localStorage` back, not just the UI) — zero console errors
       throughout. `npx tsc -b` / `npm run test` (253 tests, unchanged) / `npm run build` all
       clean.
106. **Editing a linked record now warns instead of silently going one-sided — closes Pending
     item 27's remaining gap (2026-08-24).** Deleting either side of a cross-entity link
     already cascaded correctly (Done item 35); *editing* one side directly in its native
     module (not via the Transfers page) still silently updated only that side, leaving the
     other side and the link record's own cached amounts stale with no indication anything
     was wrong. Auto-propagating the edit to the other side isn't generally safe to do
     blindly — `InterEntityTransferInput.fromAmount`/`toAmount` are independently entered
     specifically because a cross-currency link has no live FX rate to derive one side from
     the other, so "just copy the new amount over" would be wrong for exactly the links most
     likely to need this warning. New `warnIfLinked(module, id)` in `lib/linkCascade.ts`
     checks `findLinkForRecord` and, if the record is linked, shows a `confirmDialog` naming
     the other module and explaining the edit won't sync — proceeding is the user's informed
     choice, cancelling aborts the save entirely. Wired into all 6 native edit-save handlers
     that can touch a linkable record: Cash's ledger, Bank's transactions, QSE's and PSX's
     Transfers, Rentals' entries, and Personal Loans' repayments (Funds has no native
     edit/delete UI for its `Transfer` records at all, so nothing to wire there). New tests:
     `linkCascade.test.ts` gained a `warnIfLinked` describe block (2 cases: no prompt when
     unlinked, prompts and returns the user's choice when linked, using a mocked
     `confirmDialog`). Verified live via Playwright with a seeded Cash↔Bank link: editing the
     Cash side surfaced "Edit this linked entry anyway?" naming Banking as the other side;
     clicking Cancel correctly left the stored amount unchanged (confirmed via `localStorage`,
     not just the UI) — zero console errors. `npx tsc -b` / `npm run test` (255 tests, 2 new) /
     `npm run build` all clean.
107. **CollapsibleCard rollout remainder closed — see Pending item 42, 2026-08-24.** Checked
     Portfolio's Holdings/History tables (rendered through the shared `Tabs` component, which
     was rewritten in Done item 103 to wrap every tab section in its own `CollapsibleCard`) and
     found them already collapsible with zero extra work — a side effect of that earlier fix,
     not something this pass built. Personal Loans' `RepaymentsSection` actually needed a
     change: split it so the add-repayment form stays outside any collapsible (a form
     shouldn't disappear mid-fill) while the repayment table + date-range export controls now
     live inside a new "Repayment History" `CollapsibleCard`. Verified live via Playwright:
     Portfolio's Holdings section defaults open and History defaults closed
     (`aria-expanded: ['true', 'false']`, matching the shared `Tabs` component's "first tab
     open" convention); Personal Loans' add-repayment form stayed visible and clickable while
     the repayment history table sat inside a real collapsible section with its own chevron —
     zero console errors. `npx tsc -b` / `npm run test` (255 tests, unchanged — UI-only) /
     `npm run build` all clean.

108. **New 18-item UI/UX critique batch (2026-08-24), user posted a screenshot of PSX
     Transactions plus two follow-up feedback messages — in progress, this entry covers the
     first four items fixed and verified so far.** (a) Sticky subnav chip row overlapping the
     page title: `.chip-tabs.subnav`'s `margin-top:-14px` caused a measured 10px real overlap
     with `h1.pagetitle` (confirmed via Playwright `getBoundingClientRect()` before/after, not
     guessed) — changed to `margin:8px -5px 20px -5px`; the now-fully-dead standalone
     `.subnav{margin-top:-6px}` rule (only ever used together with `.chip-tabs`, confirmed via
     grep) was removed. (b) Tooltip popup text rendering in ALL CAPS in some spots (e.g.
     RiskCalculator's "Signal" column header tooltip): `Tooltip.tsx`'s popup is a DOM
     descendant of whatever it's nested inside — `position:fixed` only changes where it
     *paints*, not what it *inherits* — so a tooltip nested inside a `<th>` picked up
     `thead th`'s app-wide `text-transform:uppercase`; fixed with an explicit
     `textTransform:'none'` on the popup itself, not a per-page workaround. (c) PSX/QSE Trade
     Calculator's "Current price *" field: the bare asterisk had no explanation anywhere, and
     typing a new value looked like it should "update" something but was purely a local
     what-if override — added an explanatory `Field` tooltip plus a real "Save as market
     price" button (mirrors `PositionDetail.tsx`'s existing `commitPrice` pattern) that
     actually persists the typed value via `setMarketPrice()` when the user wants that. (d)
     Inputs/buttons inconsistently sized and not vertically aligned in the same row (e.g. the
     Add Transactions row): root cause was `.row`'s flexbox default `align-items:stretch` —
     any bare `<input>`/`<button>` sitting beside a taller `Field`-wrapped sibling (e.g.
     `FeeModeControl`, which stacks a label above its control) got stretched to match that
     taller sibling's full height, since flex stretch applies even to native form controls
     with no explicit height set; a Remove button next to "Fee mode" ballooned to ~67px tall
     with its text centered inside the oversized box instead of sitting at a normal button
     height. Fixed by switching `.row`'s default to `align-items:flex-end` (confirmed via grep
     that no `.row` in the app wraps a `Card`/`ChartCard`/`CollapsibleCard` directly, so this
     can't regress any equal-height card-grid layout) plus `min-height`/`min-width` on the base
     `.btn` (38px) and text-input/select rule (38px/70px), with matching smaller overrides for
     `.btn.small` and the `console` density's already-tighter `.btn`/input rules (so the
     "console" density doesn't get forced back up to the new default min-height, keeping it
     genuinely more compact than the default per Pending item 58 below). Verified via a
     Playwright `getBoundingClientRect()` sweep of the actual Add Transactions row: every
     child's bottom edge landed on the exact same pixel row regardless of its own height (38 /
     40 / 67 / 30px), matching the intended fix. While re-screenshotting this row for
     verification, also caught and fixed a related, previously unreported bug of the same
     "unintended uppercase" class as (b): a checkbox's own inline description text (e.g.
     "Netted (levies only)" next to the "Netted?" checkbox) was rendering as
     "NETTED (LEVIES ONLY)" because it's wrapped in a real `<label>` tag for click-target
     semantics, and the base `label{text-transform:uppercase}` rule (meant for a small caption
     sitting *above* a Field's input, e.g. "FEE MODE") doesn't distinguish that from a
     checkbox's inline description text sitting *beside* its control — fixed generally with
     `label:has(> input[type=checkbox]), label:has(> input[type=radio]){text-transform:none;
     ...}` rather than patching the 6 files using this pattern individually. Also renamed the
     "Add transaction(s)" tab label to "Add transactions" — a minor, unreported side effect of
     an earlier session's own `.card h3,h4{text-transform:capitalize}` fix mis-capitalizing the
     literal `(s)` as `(S)`. `npx tsc -b` / `npm run test` (255 tests, unchanged — CSS/copy
     only) / `npm run build` all clean; a 23-page console-error sweep across every module
     found zero regressions. **Still open from this same batch** (tracked as new Pending items
     below): chip active/inactive contrast on non-Classic themes, console density
     differentiation, calculator-button toast/icon-only treatment, icon-only buttons with
     tooltips app-wide, and removing single-child nested cards in Settings.

109. **Right-aligned table action buttons + "Transactions" → "Trade Transactions" rename
     (2026-08-24), items 4/5 of the same batch — see Done item 108.** (a) Edit/Delete/Save/
     Cancel buttons sit in the LAST `<td>` of every table row across the app (confirmed by
     reading every table's JSX, not assumed) — a single `tbody td:last-child:has(button)
     {text-align:right}` rule in `theme.css` right-pins that one cell wherever it holds a
     button, without touching any other `:last-child` cell (a plain numeric/text last column
     with no button is unaffected) or needing a class added to dozens of call sites. (b) "PSX
     Transactions"/"Transactions" was ambiguous against Bank's own "Transactions" tab (real
     money movements, not stock trades) — renamed the QSE/PSX sidebar nav item, page title, and
     "Add transactions"/"Transaction list" tab labels to "Trade Transactions"/"Add trades"/
     "Trade list", and the per-stock page's "Transactions" tab to "Trades" for the same reason.
     Bank's own "Transactions" tab is untouched — it really is transactions, not trades, so no
     ambiguity there. Verified live via Playwright (page title, nav link, and tab labels all
     read correctly) plus a 23-page console-error sweep. `npx tsc -b` / `npm run test` (255
     tests, unchanged — no calc/store logic touched) / `npm run build` all clean.

110. **Chip active/inactive contrast fixed on all 7 Material themes — item 6/13 of the same
     batch (2026-08-24).** The user's report ("chips aren't distinguished well in all themes
     except Classic") pointed at a real leftover bug from an earlier session's own fix (README
     item 53's original fix added `.chip:not(.active)` exclusions to the per-theme override
     rules that were clobbering `.chip.active`'s solid fill) — one sibling rule,
     `html[data-color^="material-"] .chip{background:var(--accent-soft);color:var(--accent);}`,
     was missed. Its extra `html` type selector gives it higher specificity than the plain
     two-class `.chip.active` rule (tied class-count broken by type-selector count), so it
     silently overrode `.chip.active` back to the same soft tint every inactive chip gets, on
     all 7 `material-*` themes — the non-Material, non-wine themes (ocean/forest/violet/
     sunset) were already fine, since their own override rule never touched background/color
     in the first place. Fixed by adding the same `:not(.active)` exclusion. Verified via
     Playwright computed-style checks (not just a screenshot) across light Material Blue, dark
     Material Blue, and light Material Crimson — active vs. inactive background colors are now
     genuinely distinct in all three, plus a before/after screenshot comparison. `npx tsc -b` /
     `npm run test` (255 tests, unchanged) / `npm run build` all clean; a 23-page console-error
     sweep found zero regressions.

111. **Console density fixed to actually be the densest tier — item 7 of the same batch
     (2026-08-24).** User's report ("No significant difference between UI compress options.
     Console is even more reverse than its name") was a real, measurable bug, not a subjective
     complaint. Confirmed via Playwright before touching anything: a table row's computed
     font-size/padding was **identical between "Comfortable" and "Console"** (14px / 11px 10px
     / 54.5px row height) — Console's own rule only ever set `table{font-size:...}`, but the
     base ruleset gives `tbody td` its own explicit `font-size:14px`, and a plain type selector
     (`table`) can never out-specify a type+class selector (`tbody td`), so that rule was
     silently dead; Console also never overrode `tbody td` padding at all, unlike Compact.
     Rewrote the Console density block to mirror every property Compact already overrides
     (`.grid`, `.section-title`, `.mgrid`/`.mcard`, `.ticker-card`, `.portfolio-grid`,
     `.pagesub`, and — using the *same* `table, thead th, tbody td` selector list Compact uses,
     so the same specificity applies — table font-size and `tbody td` padding), each with
     tighter values, so the three tiers now form a genuine strictly-decreasing series rather
     than three partially-overlapping, independently-authored rule sets. Verified via the same
     Playwright measurement before/after: row height now goes 54.5px (Comfortable) → 46.5px
     (Compact) → 38.5px (Console), plus a before/after Dashboard screenshot comparison showing
     Console's stat cards and page title genuinely smaller. `npx tsc -b` / `npm run test` (255
     tests, unchanged) / `npm run build` all clean; a 23-page console-error sweep found zero
     regressions. **This closes out items 1-9 of the original screenshot report** (see item
     108's note) — the two follow-up messages' items (Calculator button toast/icon-only
     treatment, icon-only buttons with tooltips app-wide, single-child nested Settings cards)
     and the larger deferred redesigns are still open, tracked below.

112. **Toast hidden behind the Calculator button + icon-only Calculator FAB — first item of
     the follow-up batch (2026-08-24).** Real, measurable bug, not a z-index tweak done
     blind: the toast (`bottom:20px;right:20px;z-index:50`) and the floating Calculator
     button (`bottom:24px;right:24px;z-index:500`) sat in almost the exact same screen
     position with the button's z-index 10x higher, so any toast while that button was
     visible rendered genuinely hidden behind it, not just visually close. Fixed two ways
     together, per the user's own two-part ask ("Toast is hidden beneath Calc Button. Calc
     Icon is enough. move its text to the tooltip"): (a) shrank the Calculator button from a
     "🧮 Calculator" text pill to a round 52px icon-only FAB, with the label moved into a
     real `Tooltip` popup (`align="right"`) instead of a native `title` — the
     `position:fixed` was moved to a new *outer* wrapper div rather than staying on the
     button itself, since `Tooltip`'s own trigger span is normally positioned and a
     `position:fixed` button directly inside it would visually render at the viewport corner
     while its DOM parent stayed wherever it fell in document flow (fixed elements are
     removed from flow) — breaking both hover detection and the tooltip's own position math,
     which read the parent span's (wrong, empty) rect. (b) Moved `.toast` up to
     `bottom:92px` — clear of the Calculator button's full height — rather than only raising
     its z-index, so a toast is never painted on top of a live button either. Verified live
     via Playwright: measured both elements' bounding boxes with a real triggered toast and
     confirmed zero rectangle overlap, plus hovering the button showed the real tooltip text.
     `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run build` all clean; a
     23-page console-error sweep found zero regressions.

113. **Icon-only Edit/Delete/Save/Cancel/Export/Clear buttons on QSE and PSX Trade
     Transactions — second item of the follow-up batch (2026-08-24), matching the
     screenshot page the user posted.** New shared `components/ui/IconButton.tsx` (button +
     real `Tooltip` popup instead of a native `title`, sized to match `.btn.small`) and two
     new icons in `icons.tsx` (`EditIcon` — a pencil, nothing in the set covered "edit"
     before this — and `ExportIcon`). Applied to every repeated table-row action
     (Edit/Delete on the Trade List/Cash Transfers/Rewards & Adjustments sections, Save/Cancel
     on their edit rows) and the two toolbar utilities (Export JSON, Clear all) on both QSE's
     and PSX's Trade Transactions page — the exact set the user's screenshot showed with
     full-text buttons crowding a now-right-aligned action column. Deliberately **not**
     applied to "Add row"/"Save transaction" — those are the page's primary CTAs (shown
     once per form, not repeated per row), which the user's own list ("Edit, Add, Delete,
     Fullscreen, import, Export") reads as targeting *repeated small utilities*, not a form's
     main confirm button; kept with visible text for clarity. One implementation pitfall
     avoided from the same session's Calculator-button fix (Done item 112): initially tried a
     rotated `CheckIcon` as a makeshift "X" for Cancel — looked wrong (a rotated checkmark
     doesn't read as a close/cancel glyph) — replaced with a real new `XIcon` instead of
     forcing an existing icon into a shape it wasn't designed for. Verified live via
     Playwright: hovering Edit/Save showed the correct tooltip text, clicking Edit correctly
     entered edit mode with icon-only Save/Cancel, and a before/after screenshot comparison
     confirmed the Trade List/toolbar rows are visibly far less cluttered. `npx tsc -b` /
     `npm run test` (255 tests, unchanged) / `npm run build` all clean; a 23-page
     console-error sweep (both QSE and PSX Transactions pages included) found zero
     regressions. **Scope note**: this covers the one page named in the screenshot: the
     broader "icon-only buttons with tooltips app-wide" ask (README Pending item, still open)
     is a much larger sweep across every other module's own Edit/Delete buttons —
     `IconButton` is now a ready-made building block for that, not yet applied beyond
     Transactions.

114. **Single-child card nesting removed from QSE/PSX Settings pages — third item of the
     follow-up batch (2026-08-24), the user's own examples: "Account -> Account, Data
     management -> Data management."** Root cause: `Tabs` (the shared sub-nav component)
     already wraps each tab's content in its own `CollapsibleCard` titled with that tab's
     label — but `AccountSection`/`DataManagement` (both exchanges) and QSE's own
     `AmountSettings` each ALSO wrapped their content in a second, inner `<Card>` with an
     `<h3>` repeating the exact same label, so "Account" (for example) rendered twice: once
     as the outer accordion's real header, once again as a redundant heading one level in.
     Fixed by removing the inner `<Card>`/`<h3>` wrapper from all three, letting the outer
     `CollapsibleCard` (from `Tabs`) provide both the card chrome and the title — confirmed via
     a Playwright `h3` text sweep that "Account"/"Data management"/"Amount settings" now each
     appear exactly once on the page, not twice. **Deliberately left alone**: PSX's "Fees &
     amounts" tab, whose content (`AmountSettings`) genuinely contains four separate cards
     with their OWN distinct sub-headings ("Commission & fees", "Capital gains tax", "Cost
     basis method", "General") — that's a real, useful grouping of different information under
     one outer accordion, not the "only child repeating the parent's own title" pattern the
     user's examples named; verified this multi-card section still renders correctly
     (unflattened) via a screenshot after expanding it. `npx tsc -b` / `npm run test` (255
     tests, unchanged) / `npm run build` all clean; a 23-page console-error sweep found zero
     regressions (one page showed a transient network error on one run, gone on a re-run —
     the same known sandbox FX-fetch limitation documented elsewhere in this file, not a
     real regression). **This closes out every item from the user's original screenshot plus
     both follow-up messages** — what remains is the batch of larger, deliberately-deferred
     redesign items tracked below.

115. **"Colour cards only belong to one theme" (item 6) fixed — a real, root-caused bug,
     not a design tweak (2026-08-24).** Confirmed the premise first via a before/after
     screenshot across wine/Material Blue/Ocean/dark Material Blue rather than assuming: in
     every theme except wine, every Dashboard stat card rendered the exact same near-flat
     tint, with zero visible difference between "Net Worth"'s color and "Total Fees"'s
     color. Root cause: a later `html:not([data-color="wine"]) .card.stat-card,
     .card.chart-card{background:linear-gradient(...--accent-soft...)}` rule (added to tone
     down an earlier, more saturated per-theme card treatment) applied the exact same flat,
     hue-blind gradient to every stat card in every non-wine theme, completely overriding the
     `--card-hue`-driven per-card coloring `StatCard`'s own `hue` prop and
     `lib/statCardHues.ts` already provide everywhere else — wine was the only theme that
     never went through this override at all, so it was the only one where the hue rollout's
     work (README Done items 32/38/43/88) was actually visible. Fixed by splitting
     `.card.stat-card` out from `.card.chart-card` in both this rule and its Material
     light/dark-specific duplicate, and giving stat-card the same `--card-hue`-based gradient
     formula the base (wine-only-reachable) `.stat-card` rule already used — chart-card (which
     has no per-card hue) keeps the original flat tint unchanged. Verified via a real
     before/after screenshot comparison across all 4 themes tested — every theme now shows
     the same distinct per-card colors wine always had. `npx tsc -b` / `npm run test` (255
     tests, unchanged) / `npm run build` all clean; a 23-page console-error sweep found zero
     regressions.

116. **`IconButton` rolled out to every other module's Edit/Delete/Save/Cancel buttons
     (2026-08-24) — the "app-wide" remainder of Done items 62/113, done on the session's own
     initiative per the standing instruction to keep working down the Pending list.** Applied
     to QSE/PSX per-stock Transactions tables, Personal Loans (loan detail header + repayments
     table + list row), Rentals (properties list + entries table), Banking (accounts list +
     transactions table + Planning tab), Cash (ledger + Planning tab), EMI (loan detail header
     + list row), Funds (fund header + transactions table), Transfers (linked-transfers table),
     Subscriptions (subscription header), and both QSE/PSX `DividendsSection` components — 13
     files in total. Added `EditIcon` (a pencil — nothing in the icon set covered "edit" before
     this) and `XIcon` (a real close/cancel glyph) to `icons.tsx`. **Deliberately scoped down**
     in one file: PSX's `TradePlannerPage.tsx` — already one of the most complex, frequently
     bug-fixed files this session (Done items 42/43/64/81/102/104) — only got its two
     unambiguous per-leg "Edit" buttons converted; its several single-instance form-level
     "Cancel" buttons (for the metadata-edit form, the leg-link picker, the add-leg form) were
     left as plain text, since those are lower-value, higher-risk-of-subtle-breakage targets in
     an already-fragile file, not the repeated-list-row pattern this rollout targets elsewhere.
     Also left "Add row"/"Save transaction"/"Save fund"-type primary-CTA buttons and
     module-specific actions ("Open", "Mark as done", "Mark done", "Reactivate"/toggle-"Cancel")
     untouched everywhere — those are distinct single actions, not the generic repeated
     Edit/Delete/Save/Cancel utility this ask targets. **One real bug caught during the rollout,
     not shipped**: an edit in `BankPage.tsx`'s Planning-tab plan-row Delete button left a
     dangling `</button>` closing tag from the original markup (the new `IconButton` self-closes,
     so the old wrapping tag's closer had nothing left to match) — caught by re-reading the
     surrounding JSX immediately after the edit, before running `tsc`, not by the compiler
     itself catching it after the fact. Verified via `npx tsc -b` after every file (not batched
     at the end, specifically so a mistake like the above would be caught immediately against
     the file that caused it) plus `npm run test` (255 tests, unchanged) and `npm run build`,
     both clean at the end; a 23-page console-error sweep found zero regressions; and a live
     Playwright functional test on Personal Loans (not just a render check) confirmed hovering
     the Edit button shows the correct tooltip and clicking it actually enters edit mode with
     the expected form fields.

117. **New Transfers-page feedback batch, first two items (2026-08-25).** (a) "Withdrawals are
     ignored, making the stats ambiguous" — real gap, not a misreading: QSE's/PSX's Dashboard
     showed a "Total Deposits" stat card (`summary.totalInward`) but `summary.totalOutward`
     (already computed in `cashSummary.ts`, just never displayed) had no card anywhere in the
     UI, so a user who'd both deposited and withdrawn saw only the gross deposit figure with no
     way to see money that had left. Added a "Total Withdrawals" stat card right next to it on
     both Dashboards. (b) "Input buttons, selectboxes etc still are different in height" — a
     real, root-caused shared-component bug, confirmed via Playwright measurement before
     touching anything: on the Transfers page's "New Linked Transfer" row, the Date/Amount/Note
     `Field`s and the bare "Create link" button had identical CSS heights (38px) but different
     screen positions — the button sat 5px lower. Cause: `Field`'s wrapping element is itself a
     `<label>`, which inherits the base `label{margin-bottom:5px}` rule (meant for a plain
     caption above unrelated content stacking below it) — `align-items:flex-end` aligns
     flex children by their MARGIN box, so a Field's extra 5px bottom margin pushed its own
     content 5px above the row's true bottom edge, while a margin-less bare button/input sibling
     sat right on it. Fixed with `marginBottom: 0` on `Field`'s own wrapping label — a one-line
     fix in the single shared component, so it corrects this misalignment everywhere `Field`
     shares a row with a bare (non-Field) control, not just this page. Verified via the same
     Playwright measurement after the fix (all four controls now share an identical top AND
     bottom) plus a screenshot. `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run
     build` all clean; a 23-page console-error sweep found zero regressions. **Still open from
     this batch**: card-header action-button alignment, whole-card coloring instead of colored
     text/pill backgrounds, sidebar contrast, a bank-account-number/SMS-metadata field for
     future SMS-based transaction import, Rentals semi-automated rent collection with
     partial-payment tracking, and per-entity default transfer source memory — tracked as open
     work, several large enough to need their own design pass.

118. **"All" chip added to `Tabs`, third item of the same batch (2026-08-25).** A page with many
     sub-sections (e.g. QSE/PSX Trade Transactions' 6 sections) needed one click per section to
     see everything since the `Tabs` redesign (README Done item 103) made each section its own
     collapsible card. New leading "All" chip (in the single shared `Tabs.tsx`, so every page
     using it gets this at once) opens every section without scrolling anywhere — its own active
     state reflects whether every section is already open, not which chip was clicked last.
     Verified live via Playwright: clicking "All" flipped every section's `aria-expanded` from a
     mixed true/false state to all-`true`, and the chip itself showed the active style. `npx tsc
     -b` / `npm run test` (255 tests, unchanged) / `npm run build` all clean; a 23-page
     console-error sweep found zero regressions.

119. **Bank account number + SMS sender metadata, fourth item of the same batch (2026-08-25) —
     user is planning a mobile app to read transactions from SMS bank alerts.** `BankAccount`
     gained three optional fields — `accountNumber`, `smsSenderId`, `smsSenderNumber` — captured
     but not yet read by anything (no SMS-parsing feature exists yet; this just gives that
     future feature somewhere to read from). Added to `AddAccountForm` for new accounts, and to
     `AccountDetailModal` for existing ones via a local-draft-state + explicit "Save details"
     button (same pattern Rentals' `PropertyDetailModal` already uses) rather than writing
     straight to the modal's `account` prop, since that prop is a point-in-time snapshot from
     `AccountsList`'s own `detailAccount` state, not a live store subscription. Deliberately
     not added as new table columns — this is supplementary metadata a user only needs when
     setting up SMS import later, not something to see at a glance in an already-dense accounts
     table. Verified live via Playwright: filled in an account number + SMS sender ID on an
     existing account and confirmed "Save details" correctly hit the sign-in gate (same
     verification depth as every other gated write in this app). `npx tsc -b` / `npm run test`
     (255 tests, unchanged) / `npm run build` all clean; a 23-page console-error sweep found
     zero regressions.

120. **Per-entity default transfer source remembered + prefilled, fifth item of the same batch
     (2026-08-25) — the user's own example: "PSX I can only use Zindagi Account for deposits &
     withdrawals, while I can collect rent each month through a different source... we can pick/
     prefill the last used source."** New `hooks/useLastTransferSource.ts` remembers the "From"
     side used the last time a link was created INTO a given "To" entity, keyed by
     `module(:ref)` (so two different Rentals properties, say, each remember their own usual
     funding source independently). On the New Linked Transfer form, changing "To" now prefills
     "From" with whatever was remembered for that entity — the user can still pick something
     else afterward, this is a default, not a lock. A successful link creation updates the
     remembered value for next time. Verified via Playwright: selecting "PSX" as "To" correctly
     prefilled "From" as "Banking" with the exact remembered account (`zindagi1`) restored, not
     just the module — confirmed by reading every select's live value on the form, not assumed
     from DOM position (an earlier draft of this same check had a test-script bug: the "Account"
     dropdown's position in the DOM shifts depending on which module is currently selected on
     each side, so a fixed index matched the wrong control after the "To" change). **Deliberately
     not built**: the broader "link a transfer directly from each entity's own page" idea from
     the same message — a real UI-surface question ("check feasibility") spanning QSE/PSX
     Settings, Rentals' property page, Personal Loans, Funds, and EMI, not something to guess a
     design for; tracked as a Pending item instead. `npx tsc -b` / `npm run test` (255 tests,
     unchanged) / `npm run build` all clean; a 23-page console-error sweep found zero
     regressions (one page showed a transient network error on one run, gone on a re-run — the
     same known sandbox FX-fetch limitation noted elsewhere in this file). **This closes the
     concrete half of the Transfers-page feedback batch** — what remains (card-header
     action-button alignment, whole-card coloring, sidebar contrast, Rentals semi-automated
     collection, and the per-entity direct-link idea just mentioned) are all real, several
     large enough to need their own scoped session, tracked below.

121. **Card action buttons moved to the top-right of their card's header, first pass
     (2026-08-25) — see Pending item 58 for what's left.** The user's own framing: "wherever
     action buttons are, try to align them at card header top right corner." Audited every
     `CollapsibleCard` in the app for a single card-level utility action (Export/Save, not a
     per-row Edit/Delete, which already lives right-aligned in its own table column per Done
     item 109) sitting below the card's content instead of beside its own heading, and moved
     each one into `CollapsibleCard`'s existing `headerExtra` slot — no new component needed,
     just using the mechanism that already existed for this exact job (previously only used by
     Dashboard's Holdings/Alerts cards and the Trade Planner). Fixed: Bank's `AccountDetailModal`
     ("Account details" → Save details, "Download statement" → Export CSV, both previously
     plain `<h4>`s with the button stranded below several fields), Personal Loans' "Repayment
     History" card (Export CSV + its From/To date fields), EMI's "Schedule" card (Export full
     schedule CSV), and Funds' "Transactions" card (Export CSV + From/To). **Deliberately left
     as-is, and why**: per-row Edit/Delete/Save/Cancel buttons (correct convention already, not
     this complaint); "Add row"/"Add repayment"/"Generate renewal plans"-style primary-CTA
     buttons that cap off a fill-in-the-fields form (Done item 113 already established these
     stay as visible-text buttons in their natural form-flow position, not header actions);
     QSE's/PSX's per-stock "Trades" tab Export CSV and Rentals' "Income & expenses" tab Export
     CSV, both of which live inside a tab rendered through the shared `Tabs` component (each tab
     is its own auto-generated `CollapsibleCard` with no per-tab `headerExtra` support today) —
     hoisting those specific buttons would need `Tabs`/`TabDef` to grow a per-tab header-extra
     slot plus lifting each button's local date-range state up to the tab-definition call site,
     a real but separate structural change not worth the risk in the same pass as the safer
     fixes above; and QSE's/PSX's PositionDetail "Export price history CSV" button, which sits
     inside a native `<details>` nested *within* the "Price range" `CollapsibleCard` (gated
     behind expanding "Recent updates") — moving it to the outer card's header would misattribute
     it as exporting the whole price-range stats section rather than just that inner table.
     Verified live via Playwright with seeded data for all four fixed modules: all four Export/
     Save buttons render top-right of their heading, functionally unchanged (Bank's account
     modal, Personal Loans' and EMI's loan detail, Funds' fund detail all screenshot-confirmed),
     zero console errors. `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run build`
     all clean.

122. **Whole-card coloring instead of a colored pill layered on top of an already-colored card
     (2026-08-25) — closes Pending item 59.** The user's own framing: "Some texts have red/green
     bgs. whole cards should be colored and text bg colors should be removed." Root cause,
     confirmed via `grep` before touching anything: this app already has two sanctioned
     whole-element coloring mechanisms (`StatCard`/`.stat-card`'s `--card-hue`, and the `.pill-*`
     badge classes for table cells) — the actual bug was **stacking both on the same element**:
     roughly a dozen stat-cards across the app set `hueStyle(...)` on the card (sometimes an
     arbitrary rotating per-currency color, unrelated to the value's sign) AND ALSO applied
     `pill-buy`/`pill-sell` to the value text inside that same card — a colored badge floating
     inside an already-differently-colored card, which reads exactly like "text has its own
     red/green background" even though the mechanism itself (`.pill`) is the app's own sanctioned
     one. Fixed by making the card's own `hueStyle` carry the sign (`var(--profit)`/
     `var(--loss)`) instead of an arbitrary/unrelated hue, and removing the now-redundant pill
     class from the inner value everywhere this pattern showed up: Cash's/Bank's per-currency
     Balance cards, Personal Loans' Net position (list) and Outstanding (loan detail) cards,
     Rentals' Net income cards, Subscriptions' Monthly recurring spend and Status cards, EMI's
     Outstanding cards (both loan-detail and overall-summary) and "Interest saved" what-if card,
     Funds' Net profit cards (both per-currency and per-fund), QSE's/PSX's Trade Calculator
     Break-even/Current P/L cards (previously plain, uncolored cards with only the inner pill —
     now colored only once a current price is entered, since there's nothing signed to color
     before that), and `RiskCalculator`'s Current net P/L and stress-test cards (these already
     had the correct sign-driven hue; only the redundant pill needed removing). Left untouched
     on purpose: `.pill-buy`/`.pill-sell` used in actual table cells (Bank/Cash ledgers, Personal
     Loans repayments, Subscriptions' Status column, etc.) — a colored badge in a plain table row
     is the correct, established use of `.pill`, not the "card already colored, badge redundant"
     bug being fixed here. Verified live via Playwright with seeded data across 6 modules plus a
     seeded QSE position for the Trade Calculator/Risk Analysis cards (screenshots confirm solid
     whole-card fills with plain white/dark text, no separate inner badge) — zero console errors.
     `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run build` all clean.

123. **Sidebar menu bg/text contrast investigated and the real bug found + fixed (2026-08-25) —
     closes Pending item 60.** Measured before guessing: computed real WCAG contrast ratios (not
     eyeballed) for `.navbtn` text vs. the sidebar background and `.navbtn.active` text vs. its
     own background, across all 12 color themes × light/dark (24 combinations) — every single
     one already passed AA comfortably (4.97–16.11:1). Also screenshotted the Category and
     Appearance dropdown menus across 4 theme combinations and pixel-sampled the actual PNG
     output directly (not just eyeballed it) after an initial visual read of one screenshot
     looked wrong — the pixel sample proved the panel background WAS correctly dark, the "looks
     white" impression was an optical illusion from viewing a medium-dark navy next to a
     near-black page background, not a real bug. The actual bug was found by checking what the
     app's CSS *couldn't* reach: `grep -r color-scheme` came back empty — the app never told the
     browser which palette (light/dark) it was using, so every native browser-drawn control (a
     `<select>`'s own OPENED dropdown list is the big one, plus number/date spinners and
     scrollbars) rendered in the browser's default LIGHT appearance regardless of this app's own
     dark theme. That's a real "menu" (literally, a browser-native `<select>` popup menu) with
     wrong bg/text contrast, appearing at *every* `<select>` in the app — a far better match for
     "many places" than a sidebar-specific theory the numbers had already ruled out. Fixed with
     one CSS property: `color-scheme:dark` on the base `:root` (dark is the un-overridden
     default palette) and `color-scheme:light` on `:root[data-theme="light"]` — doesn't change
     any app-drawn color (those are already correct per the measurements above), only tells the
     browser which built-in palette to use for controls it draws itself. Verified via Playwright:
     `getComputedStyle(document.documentElement).colorScheme` correctly reads `"dark"`/`"light"`
     per theme across a base theme and a Material theme, zero console errors. Native select
     popups are OS-level overlays outside a page screenshot's reach in headless Chromium, so this
     is verified via the browser-standard `color-scheme` mechanism taking effect (a well-documented
     MDN-specified behavior), not a direct screenshot of an opened dropdown. `npx tsc -b` /
     `npm run test` (255 tests, unchanged — a CSS-only fix) / `npm run build` all clean.

124. **Rentals semi-automated rent collection built (2026-08-25) — closes Pending item 61.** The
     user's own framing: pick a collection cycle (daily/weekly/monthly/annual) and a last
     collection date, then the app *proposes* the next collection for the user's approval and
     date/amount adjustment (never auto-creates one silently), with a way to record a
     partially-paid rent and carry the remaining balance into the next proposal. Built as a
     genuinely separate mechanism from the existing lease-based `generateLeaseRentPlans()` (Done
     item 60), which bulk-projects a whole lease's cycles up front from lease start/end dates —
     this is an ongoing, one-at-a-time "is it due yet" prompt instead. `Property` gained three
     optional fields (`collectionCycle`, `lastCollectionDate`, `pendingRentBalance` — a carried-
     forward shortfall, never negative on an overpayment, an accepted v1 simplification over
     tracking a real credit balance). New pure `proposeRentCollection()`/`nextPendingBalance()`
     in `lib/calc/rentalPlanning.ts` (9 new tests): the proposal always advances exactly ONE
     cycle past the anchor date (never loops ahead through multiple missed cycles) so a missed
     collection surfaces as one overdue proposal the user approves, which then becomes the new
     anchor for the next call — catching up one cycle at a time rather than silently skipping
     ahead. `PropertyDetailModal`'s new "Rent collection" card shows the computed due date/
     amount (pre-filled but editable) and an "Approve & log" button that creates a real
     `RentalEntry`, updates `lastCollectionDate` to the logged date, and recomputes
     `pendingRentBalance` from whatever amount was actually entered — a lower amount than
     proposed is exactly how a partial payment gets recorded, no separate "partial payment" UI
     needed. **A real, previously-undiscovered bug was found and fixed while verifying this**:
     approving triggers `confirmDialog()` then (if not yet signed in) `ensureSignedIn()` from
     *inside* `PropertyDetailModal`, which is itself a `Modal` — both the confirm dialog and the
     sign-in modal share the exact same `.modal-overlay` CSS class and z-index (100) as every
     other `Modal` in the app, and since `ConfirmDialogHost`/`SignInModalHost` are mounted once
     near the app root (before routed page content in the DOM), a same-z-index page-level Modal
     mounted later in the tree paints ON TOP of them — burying their buttons, unclickable,
     underneath whatever modal triggered them. Confirmed via Playwright: an initial verification
     attempt's `confirmDialog()` click timed out with Playwright reporting a stray date input
     from the underlying Rentals modal "intercepting pointer events" at the Confirm button's
     coordinates — a real, reproducible interaction bug, not a test-script artifact. This is a
     pre-existing latent bug (the lease-based plans' own "Mark as done" already called
     `confirmDialog()` from inside this same modal, just never exercised this failure mode
     before — Bank's `AccountDetailModal` has the identical exposure for its own confirm/sign-in
     calls). Fixed once at the shared layer: `Modal` gained an optional `zIndex` prop (same
     escape hatch `TermsGateModal` already used its own inline `zIndex:1000` for, just now
     available to any caller), and `ConfirmDialogHost`/`SignInModalHost` both pass `zIndex={300}`
     — comfortably above any regular `.modal-overlay` (100) and the mobile sidebar drawer (150/
     200), still well below the Terms gate (1000). Verified via a real click-hittability check
     (not just a screenshot): both the Confirm button and the sign-in modal's email input are
     now genuinely clickable when opened from inside an already-open Rentals modal, with zero
     console errors. `npx tsc -b` / `npm run test` (264 tests, 9 new) / `npm run build` all
     clean.

125. **Direct transfer-link shortcut built for PSX and QSE (2026-08-25) — partially closes
     Pending item 62; still open for Rentals/Personal Loans/Funds/EMI.** The user's own example:
     "PSX i can only use Zindagi Account for Deposits & Withdrawls... check feasibility" of
     linking a transfer straight from a module's own page instead of always needing the separate
     Transfers page. Both exchanges' "Cash Transfers" add-form gained a "Link this to a Bank
     account or Cash" checkbox — checking it swaps the plain Fee input + Add button for a module
     picker (Bank account or Cash) and a "Link & add" button that calls the exact same
     `createLinkedTransfer()` the Transfers page itself uses (no parallel implementation), and
     reuses `useLastTransferSource` for the same prefill-the-usual-source behavior Done item 120
     already built — checking the box for the first time on a PSX deposit correctly pre-selected
     "Zindagi (PKR)" in the verification below, matching the user's own example exactly.
     Deliberately simpler than the full Transfers page in one respect: both sides always share
     the same amount (no "different amount on the other side" toggle) — a real cross-currency
     conversion still belongs on the full Transfers page, which already has that control. Built
     on PSX first as a prototype, then copied near-verbatim onto QSE (`LinkedTransferFields` in
     each page's own `TransactionsPage.tsx` — not extracted into a shared component, since the
     two pages' `TransferForm`s weren't shared to begin with either) once the prototype confirmed
     the approach — QSE's own verification (a separate Bank account, a different currency)
     matched PSX's behavior exactly. Verified live via Playwright on both exchanges: checking the
     box swaps in the Bank/Cash picker with the remembered account pre-selected, and "Link & add"
     correctly hits the sign-in gate — zero console errors on either. `npx tsc -b` /
     `npm run test` (264 tests, unchanged) / `npm run build` all clean. **Rentals/Personal
     Loans/Funds/EMI remain open** — each needs its own short "what does linking mean on this
     page" pass since none of them has a plain deposit/withdrawal record like QSE/PSX's
     `Transfer`.

126. **CRITICAL, real financial-correctness bug found and fixed while designing the Rentals
     link shortcut above (2026-08-25) — Bank/Cash↔Rentals linked transfers had an inverted
     RENT_INCOME/EXPENSE sign since this pairing was first added (README Done item 34).**
     Every other linkable pairing (Bank↔Cash, Bank↔QSE/PSX, Bank↔Funds) is a transfer between
     two modules that each hold a REAL balance, where the shared `from`='out'/`to`='in'
     convention is correct by construction — conservation of money means one side's balance
     falls by exactly as much as the other's rises. **Rentals holds no real balance of its
     own** — `RentalEntry.type` (RENT_INCOME/EXPENSE) just categorizes what a REAL Bank/Cash
     event meant for that property's own performance tracking; it was never "money leaving or
     entering a Rentals-held pool." Real rent landing in a bank account and the property's own
     income going up are the *same* event moving the *same* direction, not money moving from
     one pool to another — so applying the generic opposite-polarity convention to this pairing
     produced the wrong type every time: linking "Bank → Rentals" (the natural choice when
     paying an expense *from* Bank) gave Bank the correct outflow (-amount) but wrongly logged
     the property side as **RENT_INCOME** instead of EXPENSE; linking "Rentals → Bank" (the
     natural choice when rent *arrives* at Bank) gave Bank the correct inflow (+amount) but
     wrongly logged the property side as **EXPENSE** instead of RENT_INCOME — backwards in both
     of the pairing's two real documented use cases ("rent received, or an expense paid," per
     this file's own `MODULES_PLAN.md` §7 description). This mirrors a class of bug the
     `personalLoans` case in the same function already had a documented exception for
     ("direction is intentionally unused... unlike every other module's side record") — Rentals
     needed the identical kind of exception and didn't have one. Verified via an explicit
     two-scenario walkthrough (not just intuition) before touching code, confirmed from two
     independent angles (real-world cash-flow direction, and "which side actually holds the
     real money and is it rising or falling") that agreed on the same fix. Fixed in
     `lib/interEntityLink.ts`'s `buildSideRecord` (`case 'rentals'`) by swapping the ternary;
     both existing tests in `lib/__tests__/interEntityLink.test.ts` had their expected values
     (and misleading names) corrected to match, since they encoded the wrong behavior as
     "correct." `updateLinkedTransfer` reuses the same `buildLinkedRecords` function, so editing
     an existing linked Rentals transfer also now recomputes with the corrected mapping.
     **Not done, and deliberately so — flagging for the user's attention, not silently
     "fixing" their data**: this bug has been live since Rentals linking first shipped, so ANY
     Bank/Cash↔Rentals linked transfer created before this fix has its RentalEntry's
     RENT_INCOME/EXPENSE type backwards relative to what actually happened. There is no safe way
     to auto-detect and silently correct those past records without risking a wrong guess on
     real financial data, per this project's own locked cloud-sync-safety principle (never
     mutate real financial data without an explicit, informed user action) — **if you have ever
     created a linked transfer between Banking/Cash and a Rentals property, please review those
     entries and correct any with the wrong income/expense type by hand.** New links created
     from this point on are correct. `npx tsc -b` / `npm run test` (264 tests, 2 corrected) /
     `npm run build` all clean.

127. **CRITICAL, root-caused against the user's own real uploaded PSX workbook backup
     (2026-08-25): app cash balance and portfolio value didn't match the broker's own figures
     — traced to Done item 67's "auto-check same-day override" default being a real,
     significant fee-under-collection bug, not a cosmetic one.** The user reported the app
     showed Cash Balance 471.42 PKR / Portfolio Value 39,310.63 PKR against their broker's own
     Balance 442.47 / Portfolio 39,401, and attached their real workbook backup. Rather than
     guess, seeded the exact uploaded JSON into the running app (confirmed it reproduces the
     app's own numbers: Cash Balance 471.42 exactly, Portfolio Value 39,363.01 — this session's
     own earlier fixes moved the Portfolio Value slightly from what the user originally saw, but
     Cash Balance matches exactly) and separately ran the real calc engine directly against the
     same data via a scratch test to inspect every computed fee. **Two independent causes found,
     one benign, one a real bug**:
     - **Portfolio Value vs. broker (benign, not a bug)**: the app's Portfolio Value
       intentionally subtracts an *estimated* sell fee from raw market value (`cashSummary.ts`),
       while a broker's own "Portfolio" figure is typically raw shares × current live price with
       no assumed exit cost. The remaining gap after accounting for that is fully consistent
       with ordinary intraday price movement between whenever the broker's app was checked and
       whenever this app's `marketPrices.PSO` was last manually updated — expected, and already
       covered by this app's own "Estimates only — verify against your official statement"
       disclaimer, since there's no live market-data feed by design (locked decision, see this
       file's own "Design decisions" section).
     - **Cash Balance vs. broker (a real bug, now fixed)**: Done item 67's "pre-check the
       'Same-day override' checkbox for every fresh BUY dated today" default is **provably
       wrong** for the single most common case it was meant to help with. PSX's own same-day
       netting rule (confirmed against a real broker, Done item 79) is "the LARGER-quantity side
       pays full commission, the smaller side is netted" with ties going to BUY — meaning a
       plain same-day round trip where you buy X shares and later sell all X of them (a tie) has
       the BUY as the side that should pay full commission, not the side that gets netted. But
       Done item 67 pre-checked the BUY's own override to netted=true *before the matching sell
       even existed* — and `isNettedLeg()` trusts an explicit `manualSameDay: true` unconditionally
       by design (correct for its original, narrower purpose: a deliberate manual correction for
       a backdated trade). The result: once the matching sell was logged, BOTH legs of the round
       trip came out netted (zero commission on either side) instead of exactly one paying full
       commission — and an isolated same-day buy with no matching sell *at all* that day was
       *also* wrongly charged zero fee, having nothing to actually net against. Verified by
       recomputing the user's real cash ledger with every `manualSameDay` flag stripped back to
       pure date-based auto-detection: the ledger's final balance dropped from 471.42 to 446.73
       (a **24.69 PKR under-charge**, from exactly 5 real transactions in the user's own trade
       history that were wrongly netted this way) — closing the large majority of the 28.95 PKR
       gap to the broker's stated 442.47, with the small remainder plausibly explained by this
       PSX profile's government-levy settings (NCCPL/SECP/PSX/CDC) all being configured to 0,
       which is a settings/data question for the user to verify against their broker's real fee
       schedule, not a code bug. **Fixed by reverting Done item 67's default entirely**: a fresh
       BUY dated today no longer pre-checks "Same-day override" in either
       `TransactionsPage.tsx`'s add-row form or `StockPage.tsx`'s per-stock add form (both now
       default to Fee Mode "Auto"/unchecked) — the existing, already-correct date-based
       auto-detection in `psxFees.ts` handles same-day netting automatically and correctly the
       moment both legs of a real round trip exist, with no default flag needed at all, since
       there's no way to know in advance whether a not-yet-matched buy will end up being the
       charged or netted side (that depends on the sell's eventual quantity). The checkbox
       itself is untouched and still available for its original, narrower, genuinely-manual
       purpose (the recorded date not lining up with the real same-day trade) — just no longer
       pre-checked by default. **Not silently fixed, flagging for the user's attention**: this
       bug only affects the *default* going forward — any transaction in your real data that
       already has `manualSameDay: true` baked in from this old default (in the uploaded backup:
       specifically the BUY legs of OGDC 1@330.5, OGDC 1@331.46, PPL 1@242.5, SNGP 1@102.61, and
       the isolated PSO 26@374 buy with no same-day sell) needs manual review — open each in Fee
       Mode and switch it from "Semi" back to "Auto" (or uncheck "Netted") unless you deliberately
       want it treated as netted for a real backdated-trade reason. There is no safe way to
       auto-detect and correct these without risking a wrong guess on real financial data, per
       this project's own locked cloud-sync-safety principle. `npx tsc -b` / `npm run test` (264
       tests, unchanged — this is a UI-default change, not a calc-engine change) / `npm run
       build` all clean; verified live via Playwright that a fresh row on both the Transactions
       page and the per-stock page now starts in Fee Mode "Auto" with nothing pre-checked, zero
       console errors.

128. **CRITICAL, user-reported (2026-08-25): a same-day buy+sell of equal quantity showed
     spurious open shares instead of a fully closed position — "trade timing is important...
     those transactions should be marked as closed trades rather than cause the available
     stocks to miscalculate."** Root cause: `Transaction` has no time-of-day, only a date, so
     `computePositions`, `computeFIFOPositions`, and `computeRealizedPLTimeSeries` all sorted
     same-day transactions by date string alone — a same-day tie fell back to
     `Array.prototype.sort`'s stability, i.e. whatever order the transactions happened to sit
     in the underlying array (entry order, not necessarily real trade order). If a same-day
     SELL landed before its matching BUY in that array, it was processed against a position
     that didn't exist yet: the running share count went negative and was silently clamped to
     zero (`computePositions`) or found no lots to consume at all (`computeFIFOPositions`),
     then the BUY that followed re-opened a position that should already have been fully
     closed — exactly the user's report. New shared `lib/calc/sortTransactions.ts`'s
     `sortTransactionsChronological()` sorts by date, then BUY before SELL on a tie, wired into
     all three functions. This is a safe general fix, not a narrow hack for this one scenario:
     you can never legitimately sell shares that don't exist yet without a same-day buy
     providing them first, and for every other same-day ordering (a sell against an
     already-open position, followed by an unrelated same-day buy) the final share count and
     invested total come out identical regardless of which order they're summed in. New tests
     in `calc.test.ts` and `fifoPositions.test.ts` reproduce the exact reported scenario (a
     same-day SELL entered before its matching BUY) and confirm the position now correctly
     shows 0 open shares with realized P/L computed against the real cost basis, not the full
     sale treated as cost-free profit. Verified live via Playwright: seeded a PSX workbook with
     OGDC's real 24-08-2026 data (2 buys then a matching 2-share sell, sell entered first in
     the array) — Portfolio's Holdings tab now correctly shows "No open positions" for OGDC
     instead of a phantom 2-share holding. `npx tsc -b` / `npm run test` (267 tests, 3 new) /
     `npm run build` all clean.
129. **Critical, user-reported (2026-08-25): "I updated price from Calculator but it didn't
     reflect on dashboard until i refresh."** Root cause: the Dashboard's and Portfolio's
     Holdings tables (QSE and PSX, 4 call sites total) render their inline "Current price" cell
     as `<input defaultValue={r.mp || ''} .../>` — deliberately uncontrolled so free typing
     doesn't fight a controlled `value` re-snapping mid-keystroke (same reasoning as the Trade
     Calculator's own Amount-field fix, Done item 51). But `defaultValue` only sets the
     *initial* DOM value; React does not re-apply it on a later re-render just because the prop
     changed — so a price saved from the floating Trade Calculator (which correctly updates the
     shared store, and every other reactive stat on the page updated immediately, confirmed via
     the calculator's own live Worth-Now/P&L preview) left this one specific input showing its
     stale value until a full page reload force-remounted it. Fixed with `key={r.mp}` on the
     same input in all 4 files (`DashboardPage.tsx`/`PortfolioPage.tsx`, QSE and PSX) — forces
     React to remount the element (picking up the new `defaultValue`) whenever the price
     changes for a reason other than typing into the field itself, while an unrelated re-render
     with the same price leaves in-progress typing untouched. **Verification note**: a fully
     signed-in round trip through the real floating-Calculator UI couldn't be exercised in this
     sandbox (writing a market price is sign-in-gated, and per this project's own locked policy
     no throwaway account may be created against the real production Firebase project) — so a
     new regression test, `components/__tests__/priceInputRemount.test.tsx`, isolates the exact
     `defaultValue`+`key` pattern via `@testing-library/react` (the project's first `.tsx` test
     file) and demonstrates both the bug (without the key, a rerender with a new price leaves
     the DOM value stale) and the fix (with the key, it updates), plus a third case confirming
     an unrelated same-price rerender doesn't disturb the field. A live Playwright sweep of all
     4 pages confirmed each renders its seeded price correctly and with zero console errors.
     `npx tsc -b` / `npm run test` (270 tests, 3 new) / `npm run build` all clean.
130. **Real 24-08-2026 broker statement extracted and appended to every existing trade-log
     artifact in the repo, plus the PSX fee formula calibrated against it (2026-08-25) —
     user-requested, arrived alongside the critical same-day-order bug report (Done item 128)
     with the exact same real data.** User attached two contract-note images (JS Global
     Capital Limited / JSBL-ZINDIGI, Trade Date 24/08/2026) and asked to (a) append them to
     "the html table and excel sheet in our repo" and (b) "use all this data to set defaults
     and study the exact formulas." Found and updated three pre-existing artifacts:
     `psx/trades/trades.html` (a new per-statement `<table>` appended, matching its existing
     Purchase/Sale-section + per-symbol-subtotal + grand-total structure exactly — OGDC/PPL/
     PSO/SNGP, 17 legs, grand total 79 net shares / 63.02 Brok. Amount / 9.45 SST / 3.99 Levies
     / 29,810.90 PKR net, all transcribed and cross-footed against the real statement's own
     subtotals before writing), `psx/trades/trades_all.html` (17 new rows appended to its flat
     chronological table in the same order, meta line updated from "45 transactions · 17–21 Aug
     2026" to "62 transactions · 17–24 Aug 2026"), and `JS_Zindigi_SNGP_Trading_Analysis.xlsx`
     (one new `Trade Data` row for the statement's single SNGP leg — this workbook is
     deliberately SNGP-only per its own filename/scope, unlike the two HTML logs which cover
     every ticker — following the exact same formula pattern as every existing row, with the
     `Summary` sheet's `SUM` ranges extended from row 32 to row 33). Both HTML files were
     verified by actually rendering them in a headless browser and reading back the DOM (row
     counts, computed totals), not just eyeballing the diff. **Formula calibration, the more
     substantial part of this item**: cross-checked `calcFeeBreakdown()` against the real
     statement's Brok. Amount/SST Amount/Levies Charges columns for all 13 purchase legs plus
     4 independent spot-checks from an earlier (17–21 Aug) statement already in
     `trades_all.html`. `feePct=0.2%`/`lowPriceFee=PKR0.05` (commission) and `sstPct=15%`
     matched every real row exactly already — no change needed there. The government-levies
     bucket did not: `nccplFeePct` (the app's one field standing in for the whole combined
     PSX+NCCPL+SECP+CDC "Levies Charges" line, since the broker's own statement doesn't itemize
     those separately either) was an uncalibrated guess at 0.011%, but the real data only
     reconciles — every single one of the 13+4 real rows, exactly, under standard 2-decimal
     rounding — at 0.0119% (the fitted valid range was 0.01185%–0.01202%). Updated
     `DEFAULT_PSX_SETTINGS.nccplFeePct` to 0.0119 and added a permanent regression test
     (`psxFees.test.ts`) pinning `calcFeeBreakdown`'s commission/SST/levies output against every
     real row from the statement — this is real ground-truth data, not a synthetic hand-traced
     case like this file's other fee tests. **This only changes what a brand-new PSX workbook
     starts with — it does NOT retroactively touch any existing user's own saved Settings**
     (per this project's locked cloud-sync-safety principle): the investigating user's own real
     settings (from Done item 127's investigation) have `nccplFeePct: 0`, so their own workbook
     computes zero government levies today regardless of this default change — they'd need to
     manually update PSX → Settings → "Fees & amounts" themselves if they want the calibrated
     0.0119% applied to their own account. **User's 4th ask, "trade timing... those
     transactions should be marked as closed trades" — already fully resolved by Done item
     128's fix, confirmed by re-reading the code, not a separate change**: the existing
     Open/Closed split in `TransactionsPage.tsx` (Done item 73) already derives from
     `computePositions`'s `shares > 0`, so the same-day-ordering fix that makes a closed
     round-trip correctly show 0 open shares automatically makes it classify as "Closed" too —
     no additional UI code was needed for this specific ask. `npx tsc -b` / `npm run test` (271
     tests, 1 new) / `npm run build` all clean.
131. **Direct transfer-link shortcut extended to Rentals, Personal Loans, and Funds, closing
     out Pending item 62 (2026-08-25).** The shortcut already built for QSE/PSX (Done item 125)
     reuses `createLinkedTransfer`/`useLastTransferSource` directly — no parallel
     implementation — via a "Link this to a Bank account or Cash" checkbox that swaps a native
     add-form's plain submit controls for a module picker + "Link & add" button. Each of the
     three remaining modules needed its own short "what does linking mean here" answer, per
     this item's own standing note:
     - **Rentals** (`AddEntryForm`): which side is `from`/`to` depends on the entry's own
       `type`, mirroring `interEntityLink.ts`'s already-documented Rentals exception (no real
       balance of its own) — RENT_INCOME means real money is arriving on the OTHER side
       (Rentals = `from`), EXPENSE means real money is leaving the other side (Rentals = `to`).
     - **Personal Loans** (`RepaymentsSection`): `PersonalLoanRepayment` itself ignores link
       direction (always positive), but which side the real Bank/Cash account occupies still
       depends on the loan's own `direction` field — `owed_to_me` means a repayment is money
       arriving (Bank/Cash = `to`), `i_owe` means money leaving to pay someone back (Bank/Cash
       = `from`).
     - **Funds** — a real, separate gap found while scoping this: unlike the other three
       modules, Funds had **no native add-form for its `transfers` field at all** (per Done
       item 106's own note, "Funds has no native edit/delete UI for its `Transfer` field") —
       the only way to create one was the standalone Transfers page's generic linking form.
       Built a new "Transfers" tab on `FundsPage.tsx` (a plain add/edit/delete list, matching
       QSE/PSX's own `TransferForm`/`TransfersSection` pattern almost verbatim, since Funds
       reuses the exact same `Transfer` type via the shared `createWorkbookStore` factory) with
       the same link-checkbox — this both closes item 62's remaining case and fixes that
       standing gap in the same change, since a linking shortcut needs *something* to attach
       to. **EMI remains the one module this can't reach** (see Pending item 21) — it has no
       repayment ledger at all, a data-model gap, not a UI one. Verified live via Playwright
       across all three (screenshots confirm the link-mode fields render correctly with a
       seeded Bank account selectable) plus a full submit-to-sign-in-gate check on Rentals
       confirming the whole flow (checkbox → fill amount → Link & add → sign-in modal) works
       end to end, not just that the fields render — zero console errors on any of the three.
       `npx tsc -b` / `npm run test` (271 tests, unchanged — UI wiring onto already-tested store
       actions) / `npm run build` all clean.
132. **`Tabs` gained a per-tab `headerExtra` slot, closing Pending item 58's remainder
     (2026-08-25).** `TabDef` now accepts an optional `headerExtra: ReactNode`, passed straight
     through to the underlying `CollapsibleCard`'s own `headerExtra` prop — the same mechanism
     Done item 121 already used everywhere else, just not reachable from inside a `Tabs`-
     rendered section until now. Used it to fix the two buried-Export-CSV cases item 58 named:
     - **QSE's and PSX's per-stock Trades tab**: the from/to date-range + Export CSV controls
       lived inside `TickerTransactions`'s own content. Extracted a `useTickerExport(ticker)`
       hook (mirroring the existing `useTickerExport`-shaped hooks elsewhere in the app) that
       `StockPage` calls once, builds the header control from, and passes into the `Tabs`
       array's `headerExtra` — `TickerTransactions` itself is otherwise untouched.
     - **Rentals' Income & expenses tab**: harder than QSE/PSX, since the export scope depends
       on *which property* is currently picked, and that picker used to live inside
       `EntriesTab`'s own `usePropertyPicker()` call — invisible from `RentalsPage`, where
       `Tabs` is actually defined. Lifted `usePropertyPicker()` up to `RentalsPage` itself,
       passed `properties`/`property`/`propertyId`/`setPropertyId` down into `EntriesTab` as
       props instead, and added a new `useEntriesExport(property)` hook (same shape as
       `useTickerExport`) called at the `RentalsPage` level so the header control always
       reflects whichever property `EntriesTab` has picked.
     Verified live via Playwright across all three pages with seeded data — Export CSV (plus
     the date-range fields) now renders top-right of each section's own header instead of
     buried in the content below, zero console errors, and PSX's Trades tab additionally
     confirmed the fee-calibration change from Done item 130 live end to end (a seeded 10-share
     @300 PKR buy showed Fee 7.26 PKR, matching commission 6.00 + SST 0.90 + levies 0.36 by
     hand). `npx tsc -b` / `npm run test` (271 tests, unchanged — UI restructuring, no calc
     logic touched) / `npm run build` all clean.
133. **Real time-of-day + timezone support built, closing the second half of Pending item 41
     (2026-08-25) — user-confirmed design: backfill missing time to noon, prefill a timezone
     selector linked to the record's market/currency.** New `lib/datetime.ts` is the one shared
     place that knows how to turn a date + optional `time` ("HH:MM") + optional IANA `timezone`
     into a real comparable instant (`toInstantMs`) — dependency-free, DST-aware (computes the
     target zone's real UTC offset for that specific date via `Intl.DateTimeFormat`, one
     correction pass, no library needed), and it maps QSE/PSX to their own market timezone
     (`Asia/Qatar`/`Asia/Karachi`) plus ~25 other currencies to a representative financial-
     center timezone for prefilling. `Transaction`/`Transfer`/`Adjustment`/`Dividend` gained
     optional `time`/`timezone` fields; `sortTransactionsChronological` and `buildCashLedger`'s
     sort now compare by real instant first, falling back to the existing BUY-before-SELL/
     transfer-before-trade tiebreak only on an exact tie — which is what happens automatically
     for any record still missing a time (both default to the same noon-UTC placeholder), so
     this is a strict, backward-compatible upgrade: every existing test and every already-
     correct sort order stayed identical, confirmed by the full suite passing unchanged (280
     tests, 9 new for `datetime.ts` itself) before touching any UI. New shared
     `components/ui/TimeZoneFields.tsx` pairs a `<input type="time">` with a timezone field
     (backed by a `commonTimezones()` datalist) — wired into QSE's/PSX's Trade Transactions
     (multi-row add form and the per-stock `StockPage` add form) and Cash Transfers forms, the
     two places same-day ordering actually matters. Verified live via Playwright: QSE prefills
     "Asia/Qatar", PSX prefills "Asia/Karachi", QSE's Cash Transfers form prefills from its QAR
     currency to the same — zero console errors. `npx tsc -b` / `npm run test` (280 tests,
     unchanged after the UI wiring) / `npm run build` all clean. **Deliberately scoped down**:
     Adjustments/Dividends and the six non-exchange modules' own add-forms don't have the UI
     fields yet — see the updated Pending item 41 for the remainder, now a mechanical rollout
     with the hard design/engine work already done.
134. **Dashboard chart click-to-drill-down, partial start on Pending item 17 (2026-08-25).**
     QSE's and PSX's Dashboard "Allocation by ticker (cost basis)" (Doughnut) and "P/L by
     ticker" (Bar) charts are now clickable — clicking a slice/bar navigates to that ticker's
     own `/stock/:ticker` (or `/psx/stock/:ticker`) page, with a pointer cursor on hover so it's
     discoverable. Both charts already have their data indexed by `rows[i].ticker` (the same
     array the click handler's Chart.js element index maps back into), so no new data plumbing
     was needed — just `onClick`/`onHover` in each chart's `options`. **A real small bug caught
     immediately by `tsc`**: `DashboardPage.tsx` (both exchanges) has two separate top-level
     functions in one file — `HoldingsCard()` (already had its own `useNavigate()` for the
     Holdings table's row-click) and `DashboardPage()` itself, which is where these two charts
     actually render — `navigate` needed its own `useNavigate()` call inside `DashboardPage()`,
     since a hook declared in one function isn't visible in a sibling function in the same
     file. Verified live via Playwright with a seeded single-position workbook for each
     exchange: clicking the doughnut ring navigated to `/stock/QIBK`/`/psx/stock/OGDC`,
     clicking the bar did the same — both confirmed by pixel-sampling the canvas to find the
     ring/bar's real on-screen bounds first, not guessing coordinates from a screenshot alone
     (a first attempt's coordinate landed just outside the ring and silently did nothing,
     which is exactly the kind of false negative pixel-sampling avoids). Zero console errors.
     `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm run build` all clean.
     **Deliberately scoped down**: Analytics page's ~18 charts (mostly month-indexed or
     whole-portfolio-wide, lower drill-down value than a ticker-indexed chart) and hover
     cross-highlighting between charts are still open — see the updated Pending item 17.
135. **Time+Timezone fields rolled out to QSE's/PSX's Adjustments and Dividends forms
     (2026-08-25), continuing Pending item 41's remainder.** Same `TimeZoneFields` component
     and `defaultTimezoneForCurrency`/`defaultTimezoneForMarket` prefill logic already used by
     the Trade Transactions/Cash Transfers forms (Done item 133), applied to the two remaining
     QSE/PSX add-forms: `AdjustmentForm` (both exchanges' `TransactionsPage.tsx`) and
     `AddDividendForm` (both exchanges' `DividendsSection.tsx`). `Adjustment`/`Dividend` already
     had optional `time`/`timezone` fields from Done item 133's type changes, so this was purely
     UI wiring — no calc-engine or type changes needed. Verified live via Playwright: the
     timezone field on each of the 4 forms prefills correctly from the workbook's currency
     (QAR→Asia/Qatar, PKR→Asia/Karachi), zero console errors. `npx tsc -b` / `npm run test`
     (280 tests, unchanged) / `npm run build` all clean. **Still open**: the six non-exchange
     modules' own add-forms (Cash, Bank, Personal Loans, Rentals, Funds, Subscriptions) — same
     mechanical wiring, not yet done.
136. **Time+Timezone rollout completed for the five non-exchange modules that need it
     (2026-08-25), fully closing Pending item 41.** `CashEntry`, `BankTransaction`, and
     `PersonalLoanRepayment` all gained optional `time`/`timezone` fields (same shape as
     `Transaction`/`Transfer`/`Adjustment`/`Dividend` before them); `RentalEntry` too, though it
     has no running-balance calc to update (Rentals aggregates by category/month, never a
     per-entry running total). `cashRunningLedger`, `accountRunningLedger`, and
     `repaymentRunningOutstanding` all switched from a bare `date.localeCompare` sort to
     `toInstantMs`-based real-instant sorting — the same backward-compatible upgrade pattern as
     Done item 133 (two untimed records always tie at the same noon-UTC instant, so every
     existing correct sort order is preserved). `TimeZoneFields` wired into each module's
     primary add-form: Cash's `AddEntryForm`, Bank's `AddTransactionsForm` (now takes a
     `currencyCode` prop from the selected account to prefill the right timezone), Personal
     Loans' `RepaymentsSection` add-row, Rentals' `AddEntryForm` (same currencyCode-prop
     pattern, from the property), and Funds' `FundDetail` transaction form (using the fund's own
     `currencyCode` — no type change needed there since Funds reuses the shared `Transaction`
     type that already had these fields from Done item 133). **Subscriptions deliberately
     skipped**: a `Subscription` record has only a `startDate`/`cancelledDate` on the
     subscription object itself, no per-transaction dated log the way every other module has —
     there's no same-day-ordering scenario here for a time field to resolve, so adding one would
     be inert UI with nothing behind it. Verified live via Playwright with seeded data for all
     five modules: each add-form's timezone field correctly prefilled from the relevant
     currency (Bank/Rentals from their account/property's currency, Cash/Personal Loans/Funds
     from the workbook's own currency), zero console errors across all of them. `npx tsc -b` /
     `npm run test` (280 tests, unchanged) / `npm run build` all clean.
137. **Click-to-drill-down extended to every ticker-indexed Analytics chart, QSE and PSX
     (2026-08-25) — see README Done item 134 for the earlier Dashboard-only version, this
     closes Pending item 17's click-navigation half in full.** New `tickerClickOptions(tickers,
     navigate)` helper (duplicated once per `AnalyticsPage.tsx`, same reasoning as
     `tickerClickHandlers`-style helpers elsewhere in the app — the two files aren't otherwise
     shared) returns Chart.js `onClick`/`onHover` options mapping a clicked element's index back
     into whatever ticker array fed that chart's own data, spread into 6 charts per exchange:
     ROI % by ticker, Invested vs current value, Total P/L by symbol, Holding period — closed
     positions, Portfolio allocation (market value), and Dividend income by ticker. Deliberately
     left non-clickable: "Winners vs losers" (a win/loss count, not itself ticker-indexed even
     though it's derived from `rows`) and every month-indexed or whole-portfolio chart (Cash
     balance over time, Fees breakdown, Monthly trading activity, etc.) — clicking a month bar
     or a portfolio-wide slice has no single ticker to navigate to. **TypeScript note**: the
     helper's `onClick`/`onHover` parameters had to be typed `any` rather than Chart.js's own
     `ChartEvent`/`ActiveElement[]` types — those types only resolve correctly through
     `react-chartjs-2`'s own prop-level contextual inference (as in the inline arrow functions
     Done item 134 used directly in the `options` prop), and a standalone helper function
     outside that context doesn't get the same inference, producing real type-mismatch errors
     the first time this was tried. Verified live via Playwright with seeded single-position
     workbooks for both exchanges: the "ROI % by ticker" horizontal bar navigated on click, and
     — reusing the same pixel-sampling technique Done item 134 established for hitting a
     doughnut's actual ring rather than guessing screenshot coordinates — a precise scan of the
     "Portfolio allocation" doughnut's canvas confirmed its ring click also navigates correctly
     on PSX. Zero console errors. `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm
     run build` all clean.
138. **Re-audited Pending item 56 (Portfolio page overhaul) against the live app and fixed the
     one real remaining bug: reference-line chart labels silently dropped (2026-08-25) — see
     the updated Pending item 56 for the full re-audit of every sub-item.** QSE's/PSX's
     `PositionDetail.tsx` "Current position" section already draws a horizontal bar chart with
     4 reference points (Buy/Sold/Current/Break-even) — confirmed via a real seeded position
     (buy, partial sell, current price) that all 4 bars render with correct values. The bug:
     Chart.js's default `ticks.autoSkip` applies to a category y-axis too, not just linear/time
     scales, and at the chart's original 110px/90px height it silently dropped the "Sold" and
     "Break-even" axis labels while still drawing all 4 bars — exactly matching the user's
     "chart is missing sold-price and break-even reference labels" report, which reads very
     differently once you know the data was always there and only the labels were suppressed.
     Fixed with `scales: { y: { ticks: { autoSkip: false } } }` plus a modest height bump
     (110/90 → 150/115px) to give the now-unskippable labels room. Confirmed via a real
     before/after screenshot (before: only "Buy"/"Current" visible on a 4-row chart; after: all
     4 labels render) on both QSE and PSX. **Every other sub-item in this Pending entry was
     checked live and found already correct or not reproducible** (CGT computing a genuine
     non-zero value; the current-position card already showing its documented fields; the price
     input already a fixed 150px, not full-width; stat cards already colored via Done item 88) —
     see the updated Pending item 56 for the full item-by-item breakdown. `npx tsc -b` / `npm
     run test` (280 tests, unchanged) / `npm run build` all clean.
139. **Right-hand-stack layout built for the per-stock page, closing Pending items 56/57's
     remainder and partially addressing item 54 (2026-08-25).** `PositionDetail.tsx` (QSE and
     PSX) restructured from one long single-column stack of `CollapsibleCard`s into a new
     `.position-split` CSS grid: a left column holding the stat-card sections (Current Position,
     Open lots for PSX, All-time stats) and a narrower 380px right column holding every chart
     (Daily Price, the Buy/Sold/Current/Break-even reference bars — pulled out of the Current
     Position card into its own small card so it lives with the other charts — and Price range).
     Collapses to a single column under 900px viewport width. **A real tradeoff, stated rather
     than hidden**: on the mobile single-column fallback, cards now render in left-column-then-
     right-column DOM order (Current Position, then All-time stats, then Daily Price, then Price
     range) rather than the original top-to-bottom order (Daily Price first) — considered and
     accepted rather than adding `order`-based reflow CSS for a mobile-only ordering nicety of
     genuinely marginal value. Verified live via Playwright at both a wide (1400px) and narrow
     (500px) viewport, plus the "All" tab view that renders every section on one page: stats
     left/charts right on wide, clean single-column stacking on narrow, all 4 reference-chart
     labels intact, zero console errors. `PositionModal.tsx` (an alternate quick-popup wrapper
     around this same component) was checked and found to have no live caller in the app
     currently, so it wasn't part of this verification. `npx tsc -b` / `npm run test` (280 tests,
     unchanged — pure layout restructuring) / `npm run build` all clean.
140. **First app-wide plain-language pass, Pending item 55 (2026-08-25).** Surveyed every
     `className="label"` stat-card text app-wide and picked out the genuine jargon a non-trader
     wouldn't know: "Realized/Unrealized/Net P/L" (Dashboard, both exchanges), "Cost"/break-even
     and "Est. CGT if sold now" (PositionDetail, both exchanges), "Outstanding" (EMI's per-loan
     card and its currency-totals card; Personal Loans' per-loan card), and "Avg NAV cost"/"XIRR"
     (Funds' per-fund detail). Each now has an explanatory `Tooltip` on the label — for the ones
     already using the shared `StatCard` component (Dashboard) this was just the existing
     `labelTitle` prop; for hand-rolled stat-card markup elsewhere (PositionDetail/EMI/Personal
     Loans/Funds all build `<div className="stat-card card">` by hand, not via `StatCard`) it
     meant wrapping the label `<div>` in `<Tooltip>` directly, matching the pattern
     `PositionDetail.tsx` already used for "Sell price"/"Median (fair value)". Deliberately left
     alone: labels that already explain themselves via an adjacent `sub` line (Personal Loans'
     "Net position" already says "Net owed to you"/"Net you owe" underneath) and Subscriptions'
     "Monthly equivalent"/"Yearly equivalent" (descriptive English, not an abbreviation). Verified
     live via Playwright **hover** (not click, per this file's own earlier lesson that click
     toggles a `Tooltip`'s state) on 5 of the new tooltips across 4 pages — each showed the
     correct explanatory text, zero console errors. `npx tsc -b` / `npm run test` (280 tests,
     unchanged) / `npm run build` all clean. **This is a first pass on the highest-traffic terms,
     not an exhaustive audit** — see the updated Pending item 55 for what's still open.
141. **Fixed a real bug behind Pending item 48 (body font choice) — the app's own font-picker
     feature never actually loaded any of its 6 fonts (2026-08-25).** Investigating the "choose
     a reading-optimized font" ask found the feature already fully built:
     `AppearancePanel.tsx`'s font `<select>` already has 6 options (`theme.css`'s
     `html[data-font=...]` blocks set `--body`/`--disp`/`--mono`), including two explicitly
     marketed as reading-optimized ("Atkinson Hyperlegible (max readability)", "Lexend
     (reading-friendly)"). The actual bug: `grep`ing the whole `webapp/` tree for
     `fonts.googleapis`/`fonts.gstatic`/`@font-face`/`@import url` found zero matches — none of
     `Inter`, `Space Grotesk`, `JetBrains Mono`, `Atkinson Hyperlegible`, or `Lexend` were ever
     actually loaded as web fonts, so every one of those 5 (`Source Serif 4` partly excepted,
     since its stack falls back to the real system font Georgia) silently rendered as the
     browser's generic system sans-serif — making 3 of the 6 picker options (the default, the
     "max readability" one, and the "reading-friendly" one) visually indistinguishable from each
     other despite being marketed as different typefaces. This had been true since the feature
     first shipped; nothing regressed it. Fixed with one `<link>` in `webapp/index.html`
     pulling all 6 needed families from Google Fonts in one request (`display=swap`, plus the
     `preconnect` hints). **Verification note, and a real limit on what this session could
     confirm**: `curl` confirmed both the Google Fonts stylesheet endpoint and the exact
     `fonts.gstatic.com` font-file URL it returns are live and serve real font data, and a
     Playwright pass confirmed the fix introduces zero regressions elsewhere in the app — but
     this sandbox's own headless Chromium (not this session's own `curl`) hit a
     `net::ERR_CONNECTION_RESET` fetching the same Google Fonts stylesheet URL that `curl`
     fetched successfully seconds earlier, the identical sandbox-only browser-vs-curl network
     gap already documented for the Net Worth dashboard's FX-rate fetch (Done item 66) — so the
     actual visual font swap could not be screenshotted from here. **Do not treat this as
     unverified-and-therefore-suspect**: the fix itself (a standard, extremely common Google
     Fonts `<link>` pattern) is not in question, only whether *this specific sandboxed dev
     environment* can prove it renders — a future session with real browser access, or the user
     checking the live GitHub Pages deployment, should confirm the 6 font options now look
     visually distinct and update this note once confirmed. `npx tsc -b` / `npm run test` (280
     tests, unchanged) / `npm run build` all clean.
142. **Console density made genuinely information-different, not just smaller (2026-08-25) —
     see the updated Pending item 50, density half.** Console density already had a real,
     measurably-denser row height/font-size/padding (Done item 111), but every stat card's
     secondary "sub" line (break-even color hint, avg/last sell price, "1 buys · 1 sells", etc.)
     was still shown, just shrunk to 8.5px — matching the user's complaint almost exactly
     ("just tighter padding," not a different information experience). Changed
     `.stat-card .sub` to `display:none` under Console density instead of shrinking it, so
     Console genuinely shows *less* — the primary value only — rather than the same information
     at a smaller size. Verified live via Playwright with a real position: the same stat card's
     `.sub` element is visible under Comfortable density and confirmed hidden (not just small)
     under Console. **Scoped down deliberately**: this addresses density's half of the
     complaint; the color-theme half (do Material vs. wine/ocean/etc. themes need genuinely
     different visual treatment beyond a palette swap) remains open — see the updated Pending
     item 50. `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm run build` all clean.
143. **Risk Analysis reachable from a stock's own page, Pending item 49's named gap
     (2026-08-25).** Risk Analysis existed only as `/risk-analysis`/`/psx/risk-analysis`, a
     separate whole-portfolio page with its own ticker picker — the exact "spread across
     Dashboard/Portfolio/StockPage/Risk Analysis" complaint. `RiskCalculator` gained an optional
     `initialTicker` prop (only sets the initial `useState`, so the existing whole-portfolio page
     is completely unaffected — it just never passes the new prop); `StockPage.tsx` (QSE and
     PSX) gained a third "Risk Analysis" tab alongside Summary/Trades, rendering the same shared
     `RiskCalculator` pre-scoped to that ticker. Gated on the position actually being open (shares
     `> 0`) — same guard `PositionDetail`'s own "Current position" section already uses — since
     `RiskCalculator` only ever lists held tickers (averaging down needs something to average).
     Verified live via Playwright: the tab appears and correctly prefills the ticker select on an
     open QSE position, and correctly does NOT appear on a fully-closed PSX position (bought then
     sold in full) — confirming the gate works both ways, not just the happy path. `npx tsc -b` /
     `npm run test` (280 tests, unchanged) / `npm run build` all clean. **Deliberately scoped
     down**: this closes the specific, named "Risk Analysis is a separate page" gap; the broader
     "assess a stock in one go" information-architecture question (is `PositionDetail`'s own
     section order/content actually optimal, should Dashboard/Portfolio link in more directly)
     remains open — see the updated Pending item 49.
144. **Second plain-language tooltip pass, extending Done item 140 to EMI/Personal
     Loans/Subscriptions (2026-08-25) — see the updated Pending item 55.** Audited the
     non-exchange modules' own stat-card labels and form fields for genuine jargon (as opposed
     to section headings like "By category"/"Net income"/"Monthly rollup," which already read
     as plain English and weren't touched). Added tooltips for: "Principal" (Personal Loans'
     stat card + add-loan form field, EMI's add-loan form field — "the original amount of the
     loan, before any repayments"), "Amortization schedule" (EMI's chart section heading — what
     the chart actually shows), "Total interest/markup (life)" (EMI — clarifies "(life)" means
     the whole loan term, not just what's accrued so far), and "Monthly equivalent"/"Yearly
     equivalent" (Subscriptions — explains these are normalized figures for a subscription that
     might actually bill weekly/yearly/on a custom cycle, not the literal next charge amount).
     Personal Loans' "Principal" used both `StatCard`'s wrap-the-label-in-`Tooltip` pattern (for
     the hand-rolled stat card) and `Field`'s existing `title` prop (for the add-loan form field,
     the same mechanism Done item 105 established for PSX's Risk Analysis form). Verified live
     via Playwright hover (not click, per the established `Tooltip`-toggles-on-click lesson from
     Done item 105) with seeded data for all three modules — every new tooltip rendered a real
     `role="tooltip"` popup with the expected text; zero non-font-related console errors (the
     one error present is the same sandbox-only Google Fonts `net::ERR_CONNECTION_RESET` gap
     already documented under Done item 141, unrelated to this change). `npx tsc -b` / `npm run
     test` (280 tests, unchanged) / `npm run build` all clean. **Deliberately scoped down**:
     Bank/Cash/Rentals' own labels weren't touched (their existing phrasing was judged plain
     enough already), and this remains a targeted pass on genuine jargon, not an exhaustive
     audit of every string in the app — see the updated Pending item 55.
145. **App-wide content-width bump, closing the measurable half of Pending item 54's "utilize
     all page spaces" (2026-08-25).** Measured first, per this file's own standing practice:
     `.main`'s existing `max-width:1180px` plus the 220px sidebar left ~520px of genuinely
     unused space on the right of every single page at a 1920px viewport (confirmed via a real
     `getBoundingClientRect()` read, not eyeballed) — a real, literal instance of "not utilizing
     page space" present on every page in the app, not just the per-stock page Done item 139
     already fixed. Bumped `.main`'s `max-width` to 1600px. Deliberately not removed entirely or
     bumped further — an unbounded content width would stretch a single stat card or a narrow
     settings form to an absurd, harder-to-scan width on an ultrawide monitor, trading one
     readability problem for another. This required zero per-page layout changes: every
     Dashboard/module page already lays out its stat cards and charts with
     `repeat(auto-fit, minmax(...px, 1fr))` grids, so the freed width is automatically absorbed
     as extra columns (QSE's Dashboard went from 6 stat cards per row to 8 at 1920px) rather than
     stretching existing cards to a weird size. Verified live via Playwright across Dashboard,
     Portfolio, Bank, and Cash at a real 1920px viewport: `.main`'s measured width went from
     1180px to the full 1600px on every page, `document.documentElement.scrollWidth` matched the
     viewport exactly on all four (no new horizontal overflow introduced), and a full-page
     screenshot of the Dashboard confirmed the extra grid columns render cleanly with nothing
     visually broken or oddly stretched. `npx tsc -b` / `npm run test` (280 tests, unchanged — a
     CSS-only change) / `npm run build` all clean. **Deliberately scoped down**: this is the
     "let existing content breathe wider" half of the complaint, not the "add genuinely new
     right-rail content" half — see the updated Pending item 54 for what's still open.
146. **Funds "Snapshot Import" built — a new import shape, not the Bank/Cash "map these
     columns" pattern (2026-08-25), user-requested against a real personal spreadsheet.** The
     user's own tracking file (per-fund Total Invested/Withdrawn/Current Balance, not a dated
     transaction log) doesn't fit the existing statement-import UI, which expects Date/Amount
     rows — Funds' data model is buy/sell-at-a-NAV instead. New `lib/calc/
     fundsSnapshotImport.ts` (`parseFundsSnapshotCSV`/`buildFundsImportPlan`/
     `materializeFundsImport`, fully tested against the user's real — corrected — spreadsheet
     data) reconstructs a synthetic BUY (and, if withdrawn, a SELL) dated on one shared "as of"
     date per row, at whatever placeholder NAV reproduces the reported invested/withdrawn/
     current-balance numbers exactly: a still-open position gets a NAV update so remaining
     units × NAV = current balance; a fully-redeemed position (current balance = 0) sells 100%
     of its units at NAV = withdrawn/invested, so realized P/L lands on withdrawn − invested —
     confirmed this reconstruction reproduces the source spreadsheet's own real numbers, not
     just internally self-consistent ones (see the test file's cross-check against the
     spreadsheet's own "All Totals" row). New "Import" tab on `FundsPage.tsx`
     (`SnapshotImportSection`): CSV upload, an editable preview table (platform/code/name are
     inline-editable — real value, since the user's own source file had a mislabeled row caught
     and fixed this way), a duplicate-fund-code warning (two rows can legitimately be the same
     fund code as two separate real positions — flagged, not merged), and a sign-in-gated
     "Import" button. Verified live via Playwright against the user's actual uploaded CSV: 8
     rows parsed correctly stopping before the file's unrelated second bank-balance table (per
     the user's explicit instruction to ignore that table for this import); the real mislabeled
     row reproduced in the preview exactly as in the source file and was corrected inline; the
     duplicate-code warning correctly fired for both the mistake (before fixing) and the
     genuine ALHISF double-entry (after); Open/Closed status and computed NAV matched hand
     calculations; clicking Import correctly hit the sign-in gate — this app never writes real
     financial data without an explicit signed-in click, and no throwaway account was created
     against the production Firebase project to go further than that, per this project's own
     locked cloud-sync-safety principle. `npx tsc -b` / `npm run test` (288 tests, 8 new) /
     `npm run build` all clean.
147. **Hover cross-highlighting between charts, first pass on QSE/PSX Dashboard (2026-08-25) —
     see the updated Pending item 17.** Dashboard's two ticker-indexed charts (Allocation by
     ticker, P/L by ticker) previously each highlighted independently (each already had its own
     click-to-drill-down from Done item 134, unrelated). Added a page-level `hoveredTicker`
     state shared between both charts' `onHover` handlers — hovering a slice/bar in either chart
     now dims every ticker in BOTH charts except the hovered one, so the pair reads as one linked
     view. New `dimColor()` in `lib/chartLabels.ts` (a plain alpha-suffix dim, not a background-
     mix — correct regardless of what's underneath a given segment, unlike blending toward an
     assumed background color) is shared by both exchanges' Dashboard. **A real TypeScript
     inference gap hit while extracting the shared handler into `tickerHoverHandlers()`,
     matching a lesson already documented for Done item 137's click-navigation helper**:
     Chart.js's real `ChartEvent`/`ActiveElement[]` types only resolve through react-chartjs-2's
     contextual inference when the handler is written inline in the `options` JSX prop — a
     factored-out helper function loses that inference and needs `any` params instead. Verified
     live via Playwright with a real pixel-level check, not a visual guess: sampled the bar
     chart's own canvas pixels before/during a hover and confirmed the non-hovered bar's alpha
     channel dropped from 255 (opaque) to ~94 (dimmed); separately confirmed the SAME hover (over
     the bar chart) also measurably dimmed roughly half the doughnut canvas's opaque pixel count
     (43,988 → 23,555) while its dim-alpha pixel count rose correspondingly (1,176 → 21,601) —
     proving the two charts are genuinely linked, not just independently interactive. `npx tsc
     -b` / `npm run test` (280 tests, unchanged) / `npm run build` all clean. **Deliberately
     scoped down**: only Dashboard's 2 ticker charts per exchange are linked — Analytics' 6
     ticker-indexed charts per exchange (12 total) are a separate, larger follow-up, not attempted
     in this pass — see the updated Pending item 17.
148. **Net Worth page 6-item feedback batch fixed (2026-08-25).** User posted a screenshot of
     the page plus 6 numbered items. (1/3) "Use current values as default... exchange rates" +
     "currency value should be editable/prefilled" — picking a currency in the Manual rate
     override used to always start the Rate field blank even when a rate for that currency was
     already known (auto-fetched or previously entered by hand); a new `onManualCodeChange()`
     prefills it from `rates.rates[code]` when known, so this reads as "edit the current value"
     rather than "guess a new one." (3, remainder) "Make Currency selector wider and right
     pinned" — the "Show total in" `<Select>` widened 110px → 150px; it was already the
     rightmost element in a `justify-content: space-between` row, so no further pinning was
     needed once actually checked. (4) "Estimated net worth: oddly showing text bg" — a REAL bug,
     not a design nit: the big number was hand-rolled as `<div className="stat-card"
     style={{padding:0}}>`, missing the `card` class every other stat card in the app has —
     `.stat-card` alone already carries its own `--card-hue`-driven gradient background
     (`theme.css` line 433), so without the `.card` class's rounding/inset and with `padding:0`
     inline overriding the CSS's own padding, that gradient rendered as a stray colored strip
     flush with the parent card's edges instead of a proper inset stat card — replaced with the
     real shared `StatCard` component, sign-colored via `hue`. (5) "Manual currency rate eating
     too much space" — the rate-status text + manual-override form used to run the full page
     width below the big number; restructured into a two-column layout (`Card`'s content split
     into a `row`): the big number stays on the left, and a narrow (≤280px) stacked panel with
     the "rates as of" line, "Refresh rates" link, and the manual-override mini-form (each field
     stacked vertically, not side by side) sits on the right. (2) "Show grouped info of all
     finances... for detailed view on a single page" — `computeNetWorthByCurrency()`
     (`lib/calc/netWorth.ts`) gained a new `breakdown: {module, amount}[]` field per currency row
     (zero-amount modules omitted), and each currency's `<details>` card now lists a "By module"
     section underneath its Assets/Liabilities/Net row, showing exactly which of Cash/Bank/
     Stocks (QSE)/Stocks (PSX)/Funds/Personal Loans/EMI contributed how much. (6, app-wide note)
     "Cards in multiple columns... rather than eating whole page width with blank spaces" — the
     per-currency `<details>` cards used to stack full-width one under another; wrapped them in a
     `repeat(auto-fit, minmax(360px, 1fr))` CSS grid so 2-3 currency sections sit side by side on
     a wide viewport instead of forcing a scroll past mostly-blank space to see a handful of
     numbers — the first concrete instance of this general principle, not a full app-wide pass
     (see the new Pending item 63 for the rest of the app). New test in
     `lib/calc/__tests__/netWorth.test.ts` covers the new `breakdown` field. Verified live via
     Playwright: manual-rate prefill confirmed showing the exact cached rate (e.g. "278.5" for
     PKR) after picking a currency with a known rate; the big stat card renders as a proper
     rounded green/red card, not a stray strip; the "By module" breakdown correctly listed "Cash
     500.00 USD" / "Bank 250.00 USD" against seeded data; the currency-section grid genuinely
     laid out 2 columns at a 1400px viewport. `npx tsc -b` / `npm run test` (281 tests, 1 new) /
     `npm run build` all clean.
149. **Risk Analysis and Trade Transactions: link a ticker to its own stock page (item 7 of the
     same 2026-08-25 batch).** `RiskCalculator.tsx` gained an optional `stockPageUrl?: (ticker)
     => string` prop — when provided, a "TICKER's page →" button renders next to the Stock
     picker. Passed by both standalone `RiskAnalysisPage.tsx` files (QSE → `/stock/:ticker`,
     PSX → `/psx/stock/:ticker`); deliberately NOT passed from `StockPage.tsx`'s own embedded
     Risk Analysis tab (Done item 143) — the user is already on that ticker's own page there, so
     the link would point at itself. Separately, QSE's and PSX's Trade Transactions pages had
     their ticker column as plain text in the trade-list table — turned into a `<Link
     to="/stock/:ticker">`/`<Link to="/psx/stock/:ticker">` so a specific trade row jumps straight
     to that stock's page too. Verified live via Playwright: the Risk Analysis link renders and
     points at `#/stock/QIBK` for the selected ticker; the Trade list's ticker cell is a real
     link to the same URL once that (collapsible) section is expanded.
150. **Portfolio's Holdings table was missing the Value column Dashboard's Holdings table has —
     user-reported mid-session (2026-08-25).** Comparing QSE's/PSX's `PortfolioPage.tsx`
     `OpenPositionsTable` against `DashboardPage.tsx`'s `HoldingsCard` (both list open positions,
     but were built as two separate hand-rolled tables) found a real, concrete gap: Dashboard's
     Holdings table has a grouped "Value" column (current market value + invested amount + a
     ▲/▼ indicator, from Done item 85's column-grouping redesign) that Portfolio's own Holdings
     table never got — Portfolio only showed Cost and P/L, leaving the actual current worth and
     invested amount only inferable by mental math. The user asked whether a popup would be
     safer/easier than adding another column; judged a direct column addition was actually the
     simpler, lower-risk fix here, since Portfolio's table already computes the exact same
     `gross`/`invested` values internally (just didn't surface them) and already has room for one
     more grouped column matching its existing Stock/Trend/Shares/Cost/Market Price/P/L/Exit
     targets/Status pattern — a popup would have been more code for a piece of data that fits the
     existing row shape perfectly well. Added a `value` field to each row's computed data and a
     "Value" column between Market Price and P/L, verbatim-matching Dashboard's own markup
     (worth, invested, sign-colored arrow) for both QSE and PSX. Verified live via Playwright with
     a seeded position: Value column correctly showed "1,200.00 QAR ▲ Inv 1,002.75 QAR" for a
     100-share QIBK position bought at ~10.03 and priced at 12. `npx tsc -b` / `npm run test`
     (281 tests, unchanged) / `npm run build` all clean.
151. **Funds "Daily History Import" built (2026-08-26), user-corrected the Snapshot Import
     (item 146) the same day: "this csv importer has just picked the final balances... i have
     added all balance changes day by day. you cannot ignore them!"** The user attached a
     richer xlsx (one sheet per fund, a Date/PrvBlc/NewBlc/Profit-Loss row per real update) and
     asked for average monthly/annual P&L computed from that real update history — confirmed
     via `AskUserQuestion` first: (a) average = mean of real calendar-month/year totals, not a
     naive per-calendar-day average or an XIRR-style rate (holidays genuinely have nothing to
     sum, not missing data to interpolate), and (b) they'd already imported the CSV Snapshot
     into their real account, so a sheet matching an existing fund must **replace** that fund's
     transactions, not add alongside them. New `lib/calc/fundsDailyHistoryImport.ts`
     (`reconstructFundDailyHistory`, tested against the user's own real ALHCMOF/ALDDF daily
     rows) is the core: `PrvBlc` is the user's own manually-set opening balance for that
     update — not necessarily the prior row's closing balance — so `NewBlc − PrvBlc` is already
     pure organic growth; a gap between one row's `PrvBlc` and the previous row's `NewBlc`
     is exactly how a real deposit/withdrawal gets detected and priced at the NAV implied
     just before it, separating cash flow from growth without guessing. Verified end to end
     against the user's real ALHCMOF data (9 real deposits, zero withdrawals): reconstructed
     final value matched the reported balance (5,790,054.40) exactly. `lib/calc/
     fundsModule.ts`'s new `organicPLByPeriod` makes monthly/annual P&L an ongoing capability,
     not just an import-time number — derived from whatever `transactions`/`priceHistory` a
     fund already has stored (works for any fund, not only ones imported this way), by isolating
     each `contributionVsValueSeries` point's value change from its cash-flow change. **A real
     bug caught by cross-checking the two derivations against each other, not by inspection**:
     the first version silently dropped the very first data point's own same-day growth
     whenever a fund's initial buy and its first NAV observation shared a date (the common
     case) — a dedicated test comparing "monthly P&L derived from the raw daily log" against
     "monthly P&L derived from the reconstructed transactions/priceHistory" caught a mismatch
     immediately, well before this ever reached a real user's data. New "Import" tab UI
     (`DailyHistoryImportSection.tsx`) sits behind a mode toggle next to the existing Snapshot
     Import: parses every sheet in the uploaded xlsx, auto-suggests which fund each sheet
     belongs to by matching its last real balance against the workbook's own Summary sheet
     (falls back to "create new fund," never guesses, when two funds are indistinguishably
     ambiguous — e.g. this user's own two same-coded, both-closed ALHISF positions), and shows
     avg monthly/annual P&L plus a loud, explicit "will REPLACE N existing transactions" warning
     before any matched-to-an-existing-fund import — confirmed via `confirmDialog`, never silent,
     consistent with this project's locked cloud-sync-safety principle. **New dependency,
     flagged rather than silently added**: needed a client-side .xlsx parser (the CSV importer's
     own hand-rolled parser only handles one flat table, not multiple sheets) — added `xlsx`
     (SheetJS community edition) at the last npm-published version (0.18.5); `npm audit` flags
     one high-severity advisory in it with no fix available via npm (SheetJS moved later fixes to
     their own CDN, which this sandbox's network policy can't reach to install from instead).
     Weighed this against `exceljs` (heavier, ~90 extra transitive packages including several
     deprecated ones, and still not vulnerability-free) and judged the realistic exposure
     narrow for this specific use — the file is self-uploaded by the account's own owner, never
     fetched from a third party or rendered to any other user, so the practical blast radius of
     the known prototype-pollution/ReDoS advisories is a user attacking their own browser tab,
     not a cross-account or stored-XSS path. Still worth a security-focused pass from a future
     session if a non-npm-blocked path to a patched SheetJS build becomes available. Verified
     live via Playwright against the user's real uploaded xlsx and a seeded pre-existing fund:
     the auto-match correctly resolved to the seeded fund, the replace warning showed the
     correct existing-transaction count, switching the currency picker updated the right
     card, the confirm dialog carried the destructive wording, and the real sign-in gate fired
     before any write — zero console errors. `npx tsc -b` / `npm run test` (305 tests, 17 new) /
     `npm run build` all clean (bundle grew ~120KB gzipped from the new xlsx dependency).
152. **Exit targets + Status brought to Dashboard's Holdings table and the per-stock detail
     page — item 1 of a new 2026-08-26 feedback batch (2026-08-26).** The user's exact framing:
     "Portfolio Holdings table is more complete it should [be] replicated on dashboard and also,
     same info should be available on the item's details page" — a fair read of the situation,
     since Portfolio's own table had grown two columns (Exit targets: +1%/+2%/+5% price targets;
     Status: EXIT READY/WATCH/HOLD-REVIEW/PRICE NEEDED) that Dashboard's copy of the same table
     never got, and neither existed on `PositionDetail.tsx` (the per-stock "Summary" tab) at all.
     Added both to QSE's and PSX's `DashboardPage.tsx` `HoldingsCard` (same status-threshold
     logic duplicated per the existing per-page-duplication convention this table already
     follows, not factored into a shared helper) and to `PositionDetail.tsx`'s "Current
     position" card as two new stat cards. **One real design decision**: `PositionDetail`'s new
     "Status" stat card does NOT reuse the `.pill-buy`/`.pill-sell` classes Dashboard's/
     Portfolio's *table cells* use for this — Done item 122 specifically fixed a "stat card +
     inner pill = double-colored" anti-pattern, so the stat card's own hue (green for EXIT
     READY, red for HOLD/REVIEW, the card's default color otherwise) carries the signal instead,
     matching every other stat card in the app; `.pill-buy`/`.pill-sell` remain exactly right
     for the *table* cells, which are a different, already-correct use per that same Done item's
     own reasoning. Verified live via Playwright with a seeded 2-position portfolio (one up, one
     down): Dashboard's Holdings table showed real EXIT READY (green) / HOLD REVIEW (red) values
     with correct exit-target prices; StockPage's Current Position card showed the same for the
     losing position with the stat card itself tinted red, not a redundant inner pill. `npx tsc
     -b` / `npm run test` (299 tests, unchanged) / `npm run build` all clean.
153. **Net Worth page redesigned, items 2/3/4/5/7 of the same 2026-08-26 batch (2026-08-26).**
     A large follow-up round on the page shipped in Done item 148, addressing five more numbered
     complaints from a real screenshot. (2/3) "One card 80% width with full blank area... FX
     convert has set USD as standard... it should be [a] separate card at the right... Show
     total in should be grouped with [the] info it controls... Default currency should be
     logical": split the previous single Card into two side-by-side Cards of roughly equal
     width — "Net worth summary" (the "Show total in" picker now lives directly inside it, right
     above the big number it controls) and "Exchange rates" (its own full Card, not a squeezed
     20%-width sidebar). `useLastCurrency`'s hardcoded `'USD'` first-ever fallback was replaced
     with whichever currency the user has the largest absolute net exposure in (falls back to
     `'USD'` only when there's no data yet to judge by) — a real "last chosen, else something
     sensible" default instead of an arbitrary global one. The bigger technical piece: new
     `effectiveRate()`/`setCrossRate()` in `lib/fx.ts` let the user set or view a rate between
     ANY two currencies they hold (e.g. "1 QAR = 76.5 PKR" directly), not just "1 USD = X" —
     the internal rate table stays USD-anchored (this was already technically correct for any
     currency pair, exactly how `convertAmount` already converts non-USD-to-non-USD amounts;
     the limitation was purely in the UI only ever offering USD as one side) — solving for
     whichever leg isn't already anchored. A **real bug was caught live, not by the unit tests
     first written for this**: the initial `setCrossRate` unconditionally solved for `to`'s
     rate, which corrupted the shared USD anchor itself the moment `to === 'USD'` (e.g. "1 QAR =
     0.3 USD" got written as `rates.USD = 1.092`, silently breaking every other currency's own
     rate since they're all expressed relative to *1 USD = 1*) — caught via a real Playwright
     round-trip (set a rate, read `localStorage` back) before this was ever committed, fixed by
     special-casing `to === base` to solve for `from` instead, and a new regression test added
     alongside the tests that didn't catch it. Also added a read-only "Rates between your own
     currencies" table (every pairwise rate among currencies the user actually holds, computed
     live). (4) "Add charts to view capital split per currency" — a new "Capital split by
     currency" Doughnut chart (converted to the preferred currency; a currency that can't
     convert, or has negative net worth — a doughnut can't show a negative slice — is left out
     of the chart specifically, still fully visible in the per-currency cards below). The
     "worth difference by time" half of this item was NOT built — a real net-worth-over-time
     chart needs periodic historical snapshots this app has never taken (everything here is
     computed live from current data, nothing is logged over time), which is a genuine new
     design decision (how often to snapshot, where to store it) worth its own scoped pass, not
     guessed at inside this one. (5) "More useful info & stat cards... Debts, inflow/outflow
     today, month" — new `flowByCurrency()` in `lib/calc/netWorth.ts` (pure, tested) combines
     Cash's unsigned `type: IN|OUT` entries and Bank's already-signed transactions by date range;
     three new stat cards ("Total debts," "Today's net flow," "This month's net flow") sit
     inside the summary card, each a converted sum alongside the real per-currency figures, never
     a silent replacement for them. (7) "Cards bg gradients are making them vague... minor
     glassy/shiny effect is enough" — `.stat-card`'s hue-gradient mix dropped from 16% to 7%
     (a whisper of color, not a wash) plus a very faint top-left highlight layered on top for a
     subtle glass sheen, applied once in the base rule and its two per-theme overrides
     (non-wine, Material) so all three stay in sync. The "each theme should be different from
     other" half of item 7 is the same still-open, more speculative color-theme question as
     README Pending item 50 — not attempted here, tracked there. New tests:
     `lib/__tests__/fx.test.ts` gained 6 cases (including the `setCrossRate` regression),
     `lib/calc/__tests__/netWorth.test.ts` gained 4. Verified live via Playwright throughout:
     the two-card layout, the default-currency logic actually picking the biggest-exposure
     currency on a fresh profile, the cross-rate prefill and the corrected save round-trip via a
     direct `localStorage` read, the doughnut chart rendering real proportional slices, and all
     three new stat cards showing correct seeded numbers. `npx tsc -b` / `npm run test` (300
     tests, 10 new) / `npm run build` all clean.
154. **EMI per-month installment overrides — item 6 of the same 2026-08-26 batch (2026-08-26).**
     The user's exact framing: a property installment plan can have irregular real-world terms
     — "Banks loan 10005 EMI 1000 and last one 1005," or "1 big installment every 6 months" —
     that a single flat EMI can't represent. Asked via `AskUserQuestion` which design to build
     (a recurring-pattern rule, a per-month override table, or both) since this is a genuine
     multi-way fork with real correctness implications for a persisted schedule; the user chose
     **per-month override table**: keep the regular auto-calculated schedule as the default, let
     any specific month be given a different actual payment, and recalculate every later month
     from what was actually paid. `EMILoan` gained `installmentOverrides?: Record<number,
     number>` (keyed by 1-indexed month); `emiSchedule()` substitutes an override for that
     month's payment in both repayment modes — interest mode's already-sequential balance-
     tracking loop needed no new state, just `payment = overrides[m] ?? emi` before computing
     `principalComp`; fixedTotal mode (no compounding) keeps the SAME principal:markup split
     *ratio* as the regular installment for an overridden month, so a bigger payment splits
     proportionally bigger on both sides rather than all going to one or the other. **Early
     payoff is a real, deliberate addition, not an afterthought**: the loop now stops once
     balance clears (same idea `whatIfExtraPayment` already used for its own "what if" loop),
     so a large override can finish a loan before its original tenure — `emiSummary()`'s
     `elapsed`/`monthsRemaining` clamp against the actual (possibly shorter) `rows.length`
     instead of `loan.tenureMonths`, and `paidSoFar` now sums each row's own real payment
     instead of `elapsed * emi` (harmless when nothing's overridden — every row.emi already
     equalled emi — but necessary once they can differ). UI: the existing "Schedule (next 12
     installments from today)" table in `EMIPage.tsx`'s `LoanDetail` gained a per-row pencil
     icon that opens an inline amount input (Save/Cancel), an "(custom)" tag on an overridden
     row's Installment cell, and an X icon to reset a month back to the regular installment —
     scoped to upcoming months only (the table's own existing window), not past ones, since this
     is a planning tool, not a payment-history editor. Follows this project's locked sign-in-
     gated-write rule (`ensureSignedIn` before either save or reset), even though the pre-
     existing "Edit loan" Save button in this same file doesn't have that gate — a pre-existing
     gap in unrelated code, not fixed here, but not repeated in this new code either. Verified
     live via Playwright: a $1200/12-month 0%-interest loan with a 300-unit override at month 8
     (vs. the regular 100) correctly showed the "(custom)" tag, correctly recalculated month 9's
     balance off the new lower balance, and correctly stopped the schedule at month 10 once the
     override's extra payment cleared the loan early — 2 months sooner than the original
     12-month tenure, with the chart and every stat card reflecting the same numbers. New tests:
     `lib/calc/__tests__/emiModule.test.ts` gained 5 cases (both repayment modes, plus the
     early-payoff `emiSummary` clamp). `npx tsc -b` / `npm run test` (322 tests, 5 new) / `npm
     run build` all clean.
155. **Hover cross-highlighting extended to Analytics' own ticker-indexed charts, closing
     Pending item 17 in full (2026-08-26).** Done item 147 linked only Dashboard's 2 ticker
     charts per exchange, deliberately deferring Analytics' larger 6-charts-per-exchange (12
     total) case as a separate follow-up — this is that follow-up. Both exchanges'
     `AnalyticsPage.tsx` gained the same page-level `hoveredTicker` state Dashboard already
     uses; the existing `tickerClickOptions()` helper (Done item 137's click-to-drill-down)
     gained a `setHovered` parameter so the same function now handles both click-navigation
     and hover-driven dimming in one place, rather than adding a second parallel helper.
     Applied `dimColor()` to all 6 ticker-indexed charts per exchange: ROI % by ticker,
     Invested vs current value (both its "Invested" and "Current value" datasets), Total P/L
     by symbol, Holding period, Portfolio allocation, and Dividend income by ticker — the
     last three of which live in entirely different `Tabs` sections than the first three,
     so hovering a bar in "Performance" correctly dims a slice in "Allocation" or "Activity &
     dividends" too, the whole point of "cross-highlighting" rather than a same-chart-only
     effect. Verified live via Playwright on both exchanges with a real pixel-level check
     (not a visual guess): swept the "ROI % by ticker" chart's canvas for a coordinate that
     actually registers a Chart.js hover (confirmed via `cursor: pointer`, since the exact
     bar-vs-padding boundary can't be guessed reliably from a screenshot alone — a lesson
     from Done item 134's own click-target verification, reapplied here), then confirmed via
     before/after screenshots that hovering QIBK's (QSE) / OGDC's (PSX) bar dims every other
     ticker's bars in the SAME chart, in "Total P/L by symbol" one card over, AND in "Portfolio
     Allocation" — a doughnut in the separate "Allocation" tab section — proving the link
     spans across `Tabs` sections, not just within one visible card grid. `npx tsc -b` / `npm
     run test` (322 tests, unchanged — pure UI wiring on the already-tested `dimColor`) / `npm
     run build` all clean.
156. **EMI/Loans gains a real repayment ledger + becomes a linkable module, closing README
     Pending items 21/62's long-standing remainder (2026-08-26).** EMI previously had no
     addressable record of an actual payment — only the computed `emiSchedule()` and the
     per-month `installmentOverrides` shortcut (a plain number, no id, nothing to reference).
     New `EMIRepayment { id, loanId, month, amount, date, source?, statementRef? }`
     (`types/emiWorkbook.ts`) plus a hand-written `emiWorkbookStore.ts` (EMI needed a second
     array, same "doesn't fit `createEntryStore`'s single-array shape" reasoning that made
     Personal Loans hand-written before it) whose `addRepayment`/`updateRepayment`/
     `deleteRepayment` keep the new ledger and the existing `installmentOverrides` in sync as
     one write — `emiSchedule()`'s calculation logic is completely untouched, this only adds
     an addressable id/date/source on top of what it already read. EMI joined the
     cross-entity-linking system (`LinkModule` gained `'emi'`, same "direction doesn't flip
     the sign" exception as `personalLoans` — a payment always reduces what's owed regardless
     of which side of the link it's on) via a new `emiMonth` field on `LinkSideConfig`,
     resolved by the Transfers page as "the next not-yet-overridden installment" before
     `buildLinkedRecords` runs (kept out of the pure `buildSideRecord` itself, which has no
     store access). New "Repayment log" `CollapsibleCard` on each loan's detail view lists
     every recorded repayment (not just the Schedule table's next-12-month window), with
     inline edit/delete going through `warnIfLinked`/`confirmAndDeleteLinkable` like every
     other linkable module's native edit/delete. **EMI is no longer the sole unlinked
     module** — see MODULES_PLAN.md §8, now fully closed. Verified live via Playwright: the
     EMI loan picker appears correctly on the Transfers page with the right currency and no
     false "unsupported pair" warning, and both the pencil-editor save and the Transfers-page
     link correctly hit the sign-in gate (a real signed-in round-trip against the production
     Firebase project wasn't attempted, same standing reasoning as every other linked
     module's own verification note). New tests: `store/__tests__/emiWorkbookStore.test.ts`
     (4 cases covering the override-sync behavior) and 4 new cases in
     `interEntityLink.test.ts`. `npx tsc -b` / `npm run test` (330 tests, 8 new) / `npm run
     build` all clean.
157. **Net Worth gains an on-demand snapshot + a real net-worth-over-time chart, closing
     README Pending item 64 (2026-08-26).** Resolves the three open design questions that
     item left explicitly unguessed-at: cadence is on-demand only (a "Save snapshot" button,
     never automatic — clicking again the same day updates that day's entry instead of
     duplicating it); storage is a new own-Firebase-path store
     (`netWorthSnapshotsWorkbookStore`, `users/{uid}/netWorthSnapshots`), kept fully separate
     from every module's own workbook so this carries zero migration risk; and a snapshot is
     an explicitly FROZEN point-in-time copy (`types/netWorthSnapshot.ts`'s own doc comment)
     — entering a backdated transaction later never rewrites a past snapshot, only the next
     "Save snapshot" click captures a new current state. The new chart plots the currently-
     selected preferred currency's own history only (no historical FX rates are kept, so
     converting several currencies' history to one would be misleading) via `ChartCard`'s
     existing `empty` gate (fewer than 2 points shows "Not enough data yet" instead of an
     unreadable single-point line). Gained a standard "Account" cloud-sync section (same
     pattern as every other module) rather than the lighter no-upload-UI treatment Rentals'
     Planning feature uses, since a snapshot is real point-in-time history, not
     regenerate-safe projection data. Verified live via Playwright with 3 seeded snapshots:
     the chart rendered the correct dates/values (400 → 450 → 500 USD) with datalabels, and
     "Save snapshot" correctly hit the sign-in gate. `npx tsc -b` / `npm run test` (included
     in the 330/8-new count above) / `npm run build` all clean.
158. **Critical, self-audited while building the above (2026-08-26): a real cross-account
     data-leak gap in `resetAllLocalWorkbooks()`.** This function exists specifically to
     prevent one account's local data surviving into the next signed-in account on the same
     browser (see Design decisions above — a previous version of this exact bug already once
     caused real data loss). Checking it before adding the two new stores above found it was
     already stale: Subscriptions and all three Planned* stores (Cash/Bank/Rentals) were
     added to the app after this function was last written and were never wired into it —
     the exact bug class it exists to prevent, just for those four. Fixed by adding all four
     plus the two new stores from today. New test coverage in `resetLocalData.test.ts` seeds
     and asserts all 4 previously-missed stores are actually cleared, not just trusted by
     inspection. **Lesson for any future new per-account local store**: add it to
     `resetAllLocalWorkbooks()` at the same time it's created, not as an afterthought — this
     is the second time this exact class of gap has been found only by an unrelated audit,
     not by the module's own original build session.
159. **PSX Settings' "Fees & amounts" tab regrouped into a responsive grid, one concrete
     instance of README Pending item 63 (2026-08-26).** Its 4 sub-cards (Commission & fees,
     Capital gains tax, Cost basis method, General) used to stack full-width one under
     another despite each holding only a handful of fields — Commission & fees (by far the
     largest, 10 fields) now spans both columns on its own row while the other 3 sit 2-3 per
     row on a wide viewport, same `repeat(auto-fit, minmax(320px,1fr))` pattern the Net Worth
     page's own two summary cards established. Audited every other module's Settings/landing
     page for the same "several small full-width cards stacked with room to spare" shape
     first — QSE's own Amount Settings is a single card (nothing to group), and every
     non-exchange module's own page follows a form→list→Account shape where each card
     serves a genuinely different purpose (a form next to a table would look wrong squeezed
     into a half-width cell) — PSX's Fees & amounts tab was the one clear, safe match found.
     Verified via a real screenshot at 1400px: the grid renders exactly as intended, no
     visual regression. **Item 63 is not closed** — a full app-wide audit (Settings sub-cards
     elsewhere, module landing pages) is still open, tracked as a per-page judgment call, same
     as the item's own existing note.
160. **Critical, user-reported (2026-08-26): a stock's Current Price input on its detail page
     appeared to "disappear" right after saving.** Root cause: `PositionDetail.tsx` (QSE and
     PSX both had the identical bug) binds the "Update price" input to local `priceInput`
     state, and `commitPrice()` — after correctly calling `setMarketPrice()` and updating
     every other stat on the page — reset that local state to `''`, blanking the visible
     field even though the price genuinely saved (confirmed by reading `setMarketPrice` in
     `createWorkbookStore.ts`: it synchronously updates `marketPrices` and appends to
     `priceHistory`, no bug in the actual persistence). Fixed by re-filling `priceInput`
     with the value that was just saved instead of clearing it. New regression test
     (`positionDetailPriceInput.test.tsx`, same isolated-harness pattern as Done item 129's
     `priceInputRemount.test.tsx`) reproduces the bug and confirms the fix, since exercising
     the real save flow live requires a signed-in account this project's own cloud-sync-safety
     rule won't create against the production Firebase project. `npx tsc -b` / `npm run test`
     (332 tests, 2 new) / `npm run build` all clean.
161. **EMI/Loans: a custom fixed monthly payment with the remainder "balloon"-charged in the
     final installment, user-requested (2026-08-26).** Distinct from the existing per-month
     `installmentOverrides` (README item 6 of an earlier batch, which sets ONE specific
     month's payment by hand): the new `EMILoan.customMonthlyPayment` field applies a single
     fixed amount to every month automatically, and — since a fixed payment generally doesn't
     divide the loan evenly by its tenure the way the real EMI formula does — the schedule
     engine (`emiSchedule()`) automatically "true's up" the LAST month to whatever's actually
     still owed (remaining balance plus that month's own interest/markup) instead of
     repeating the custom amount and either leaving a residual balance or overshooting.
     Implemented symmetrically for both repayment modes: interest mode's balloon is
     `balance + that month's interest`; fixedTotal (no-interest/Sharia) mode's balloon closes
     out both the remaining principal AND whatever markup hadn't yet been collected, so the
     loan's grand total still equals `totalToReturn` regardless of how the custom payment
     compared to the natural installment along the way. A per-month `installmentOverrides`
     entry still wins over the auto-balloon on whichever month it's set on, including the
     final one. New `EMIScheduleRow.isBalloon` flag distinguishes this auto-computed row from
     a manual `overridden` one in the UI — the Schedule table shows "(final payment)" instead
     of "(custom)" so it's clear the engine computed it, not the user. `emiSchedule()`'s
     returned `emi` (used everywhere as "the monthly installment," including the landing
     page's totals and `whatIfExtraPayment`'s own baseline) now reflects the custom amount
     when set, so "extra payment" planning correctly stacks on top of it rather than the
     theoretical EMI. New "Custom monthly payment (optional)" field added to both the add-loan
     form and the edit-loan form. Verified live via Playwright with a seeded 1200/12-month/0%
     loan and a 50/month custom payment: months 1-11 each showed exactly 50.00, and month 12
     showed "650.00 USD (final payment)" — matching the hand-traced test expectations exactly.
     New tests: `emiModule.test.ts` gained 6 cases (0%-rate balloon, interest-bearing balloon,
     early-payoff-skips-balloon, override-wins-over-balloon, fixedTotal dual true-up, and
     `whatIfExtraPayment` stacking correctly on the custom base). `npx tsc -b` / `npm run test`
     (338 tests, 6 new) / `npm run build` all clean.
162. **EMI/Loans direct transfer-link shortcut, closing Pending item 62's remainder
     (2026-08-26).** The four other linked modules (QSE/PSX/Rentals/Personal Loans/Funds) each
     got an inline "Link this to a Bank account or Cash" checkbox on their own add-form —
     EMI was the sole holdout, since it has no blank add-form for a repayment: its "add a
     transaction" moment is the Schedule table's inline pencil-editor (`saveOverride`, which
     sets one specific month's actual payment). Wired the same checkbox into that editor row
     instead: checking it swaps the Save button for a module (Bank/Cash) + account picker and
     a "Link & add" button, calling the same `createLinkedTransfer`/`useLastTransferSource`
     every other module's shortcut already uses — no parallel implementation. Since the
     editor already knows exactly which month it's setting (`r.month`), the link is built
     with that exact `emiMonth` directly, rather than needing the standalone Transfers page's
     `nextUnpaidEmiMonth()` guess. EMI's repayment amount is always positive regardless of
     link direction (same documented exception as `personalLoans`), but unlike Personal
     Loans, the real Bank/Cash account is always the `from` (paying) side here — an
     installment payment always leaves the account, there's no "owed to me" direction to flip
     it. Verified live via Playwright with a seeded loan + bank account: the checkbox reveals
     the module/account picker (correctly defaulting to the only seeded account), and
     clicking "Link & add" correctly hits the real sign-in gate rather than silently writing
     anything — zero real console errors (only the sandbox's known Google-Fonts
     `ERR_CONNECTION_RESET`, see Done item 141). `npx tsc -b` / `npm run test` (338 tests,
     unchanged — UI wiring onto already-tested store/link functions) / `npm run build` all
     clean.
163. **EMI/Loans: full-schedule + due-date editing + Paid/Upcoming/Planned status + recurring
     "Big EMI every N months" generator + homepage restructure (2026-08-26, user-requested).**
     Several real design forks here were resolved with the user via AskUserQuestion before
     building, mirroring the precedent set by Done item 154's per-month-override decision:
     the periodic bigger-payment amount supports BOTH "major month pays this amount alone"
     and "major month pays regular + this amount" (a toggle, not a single fixed choice, per
     the user's own clarification); the loan explicitly KEEPS its original tenure rather than
     finishing early from the extra payments; "add unreconciled amount to last month" defaults
     ON; and "Planned" status means specifically a not-yet-executed plan from the existing
     "Link to bank" feature, not any override. New `EMILoan.paymentDayOfMonth?: number`
     (whole-loan default day-of-month, e.g. 28th) feeds `installmentDueDate()`, with the same
     day-doesn't-exist-in-target-month clamp the rest of this file's date math already
     accepts. A single installment's own due date can still be pinned independently on top of
     that default — reuses `EMIRepayment.date` (already existed) rather than a new override
     map, via new `resolvedDueDate(loan, month, repayments)` which prefers a real repayment
     record's own date when one's set. New `PlannedBankTransaction.sourceEmiMonth?: number`
     (alongside the existing `sourceEmiLoanId`) lets the Schedule table match a row to its
     plan by exact month instead of comparing computed date strings, which could drift once
     `paymentDayOfMonth` exists. The Schedule table gained a "show full schedule, start to
     end" checkbox (default off, keeping the existing "next 12" view as the default), a Due
     date column, and a Status column (Paid/Planned/Upcoming pills) — Paid is
     `month <= elapsed`, Planned checks for a matching not-yet-executed planned transaction,
     Upcoming is everything else. New `generateBigEmiOverrides()` in `emiModule.ts` (pure,
     tested — 7 new cases) computes the periodic major-month overrides plus, when
     reconciliation is on, the true final-month payment needed to exactly zero the balance at
     the loan's own declared tenure — reusing `emiSchedule()` itself to compute the
     pre-reconciliation balances rather than duplicating the amortization loop. If the majors
     are big enough that the loan already finishes early on the schedule's own existing
     early-stop, there's genuinely no debt left to reconcile at the final month, so the
     function leaves that case alone (same "can't force tenure past a real payoff" tradeoff
     `customMonthlyPayment`'s balloon already accepts). The UI applies the computed overrides
     through the same `addRepayment`/`updateRepayment` path a single manual override already
     uses — no parallel write path. Separately, user feedback ("no one adds a EMI/Loan every
     day") restructured the landing page: stats + loan list now render first, with the
     add-loan form moved behind a floating round "+" button (same FAB pattern the Trade
     Calculator button already uses) opening a popup instead of permanently occupying the top
     of the page. Verified live via Playwright: the landing page shows the list with no
     inline form; the FAB opens a modal with the new payment-day field; a seeded loan with
     `paymentDayOfMonth: 28` correctly shows every due date landing on the 28th; the pencil
     editor's new date input correctly prefills from the computed due date and accepts an
     edit; the full-schedule toggle correctly expands from 12 (next-12 view) to the loan's
     full 12-month tenure with 2 Paid / 10 Upcoming status pills on a seeded partially-elapsed
     loan; and both the Big EMI generator's "Generate" and the pencil editor's "Save"
     correctly hit the real sign-in gate rather than writing anything while signed out — zero
     real console errors (only the sandbox's known Google-Fonts `ERR_CONNECTION_RESET`, see
     Done item 141). `npx tsc -b` / `npm run test` (350 tests, 12 new) / `npm run build` all
     clean.
164. **QSE/PSX Dashboard right-rail, first real content added — see Pending item 54's
     remainder, partial (2026-08-26).** The earlier width bump (Done item 145) only let
     existing grids breathe wider on a wide viewport; this adds genuine new right-rail
     *content* the user asked for: a **Net worth** panel (the currency the user has the
     biggest exposure in, its Net figure, and a per-module breakdown, linking to the full
     `/net-worth` page) and an **Upcoming plans** panel (the next few not-yet-executed plans
     from Cash's and Banking's Planning features, merged and sorted by date — previously only
     visible as a stat-card sub-line on each module's own landing page, Done item 57, never
     from anywhere else in the app). Both reuse existing calc functions with zero new
     business logic — `useNetWorthSummary()` (new hook, extracted from `NetWorthPage.tsx`'s
     own data assembly so both the page and the rail share one source of truth instead of
     duplicating seven store subscriptions; `NetWorthPage.tsx` itself now calls this same
     hook, confirmed unchanged behavior via the full test suite before touching any UI) and
     the existing `PlannedCashEntry`/`PlannedBankTransaction` arrays, just sorted/merged in
     the component. New shared `.rail-split` CSS grid (1fr + 320px, collapsing to one column
     under 1000px — same pattern as `PositionDetail`'s `.position-split` from Done item 139)
     wraps QSE's and PSX's Dashboard pages specifically, as a working vertical slice on the
     highest-traffic pages before any wider rollout — same "ship one thing, verified" pattern
     this project always follows (CollapsibleCard, StatCard hue, IconButton all started this
     way). Verified live via Playwright at both a wide (1600px — confirmed genuine side-by-
     side layout via bounding-box x-coordinates, not just a visual guess) and narrow (500px —
     confirmed the rail collapses below the main content) viewport, with a seeded planned
     Cash entry showing up correctly in the rail and the "Full breakdown →" link correctly
     navigating to `/net-worth` — zero real console errors. `npx tsc -b` / `npm run test`
     (350 tests, unchanged — a data-assembly extraction plus new UI, no calc logic changed) /
     `npm run build` all clean. **Deliberately scoped down**: only QSE's/PSX's Dashboard got
     the rail this pass — Portfolio, module landing pages, and a third rail panel (e.g. a
     contextual glossary) are still open, tracked in Pending item 54's remainder below.
165. **CRITICAL, user-reported with real numbers (2026-08-26): fixedTotal (no-interest) EMI
     loans showed a badly wrong "remaining balance."** The user's exact repro: principal
     45,046, total to return 50,115.33, 36 months, EMI ~1,392 — the app showed "Balance:
     43,794.81" after just the first installment, when it should have been ~48,723.33
     (50,115.33 − 1,392). Root cause: `emiSchedule()`'s fixedTotal branch tracked its running
     `balance` as PRINCIPAL ONLY (via an internal `principalRatio` split used to break each
     payment into a principal/markup pair for the "Interest/markup" column) — correct for an
     interest-bearing loan (a bank's own "outstanding principal" genuinely excludes interest
     that hasn't accrued yet), but wrong for fixedTotal mode, which has no real compounding or
     interest-accrual concept at all: the principal/markup split there is purely an internal
     display breakdown, not a genuinely separate debt, so a no-interest borrower's real
     "how much do I still owe" is the FULL remaining total, not a principal-only subset of it.
     Fixed by tracking `balance` as the total remaining obligation (starting at `total`,
     decreasing by the full payment each month) for fixedTotal mode specifically — interest
     mode's principal-only tracking is untouched, since it's actually correct there. Also
     fixed the same bug in two places that inherited the old assumption: `emiSummary()`'s
     `elapsed === 0` special case (used to always return `loan.principal` regardless of mode)
     and `generateBigEmiOverrides()`'s reconciliation math (used to ADD remaining markup on
     top of the balance, which double-counted it once the balance itself started including
     markup). UI: the "Net remaining (outstanding)" tooltip is now mode-aware, since the two
     modes genuinely mean different things by "outstanding" now (previously one tooltip text
     — "not counting future interest/markup" — was simply wrong for fixedTotal loans).
     **Found and fixed as part of the same 2026-08-26 EMI feedback batch that added the
     zone-grouped stat cards (see Done item 166) — investigated FIRST, before touching any
     layout, since a correctness bug always outranks a display redesign.** New regression
     tests reproduce the user's exact numbers directly (`emiSchedule`/`emiSummary`, both
     hand-traced against the real loan) — 5 new cases. `npx tsc -b` / `npm run test` (359
     tests, 5 new) / `npm run build` all clean; verified live against the exact reported loan
     — the app's own numbers now match hand-calculated expectations exactly at every point in
     the schedule checked (month 1 via the unit test, month 7/8 via a live browser check).
166. **EMI loan-detail stat cards regrouped into three zones, plus several missing figures
     added — user-requested batch (2026-08-26), see Done item 165 for the correctness bug
     found while investigating this same feedback.** Replaced the old flat 7-card list with
     three explicitly labeled, grouped zones matching the user's own spec almost exactly:
     **Origination** (Total amount sanctioned, Markup percentage, Net to return/total cost),
     **Current status** (Net remaining/outstanding, Net paid to date, Monthly EMI), **Timeline**
     (Next due date, Expected completion date, Remaining EMI count) — "Always group the
     relevant info in one layout," per the user's own explicit note. New pure
     `markupPercentage(loan)` (tested) gives a comparable percentage figure for both repayment
     modes — the real annual rate for interest mode, an equivalent derived percentage (markup
     ÷ principal) for fixedTotal mode, which has no rate at all. "Overdue Balance / Penalties"
     — part of the user's original 3-zone request — was deliberately NOT built: asked the user
     via AskUserQuestion first, since this app has zero missed-payment or penalty tracking at
     all (every other figure already assumes on-schedule payment regardless of whether a
     repayment was actually logged) — the user's own explicit choice was to skip it for now
     rather than get a fake or internally-inconsistent version; a real "Overdue" figure needs
     its own design pass. The old flat list's "Interest/markup so far" card was folded away
     (its info is now implicit in Net to Return minus principal) rather than kept as a fourth
     stray card outside any zone, per the user's own "group the relevant info" instruction.
     **Same batch also fixed a real, separate, systemic labeling gap** (the user's first
     numbered item: "Add labels on top of all form elements"): audited every module for the
     "detail-page primary-record edit form" pattern (the `[editing, setEditing]` boolean
     toggle, as opposed to a table's own per-row inline edit, which is already adequately
     labeled by its column header) and found the SAME gap — a raw `.row` of unlabeled inputs
     with only placeholder text, no real `<Field>` label — in three modules: EMI's own
     edit-loan form, Personal Loans', and Subscriptions'. Fixed all three by wrapping every
     field in the existing `Field` component (already used correctly by every module's own
     ADD form — only the EDIT forms had drifted). Verified live via Playwright: all 9 new
     stat-card fields render with the exact expected values against a seeded loan, the 3 zone
     headers show, and the edit-loan form's fields are now all `Field`-labeled. `npx tsc -b` /
     `npm run test` (359 tests, 4 new for `markupPercentage`) / `npm run build` all clean.
167. **CRITICAL, user-reported same day (2026-08-26): `paymentDayOfMonth` shifted every due
     date back by one day for a positive-UTC-offset user ("I placed 28 as day, while app fixes
     27... same with 29").** Root cause: `installmentDueDate()` mixed a UTC-parsed
     `new Date(startDate)` with LOCAL-timezone `Date` methods (`getMonth`/the
     `new Date(y,m,d)` constructor/`setDate`) and then read the result back out via
     `.toISOString()` (always UTC) — a classic JS Date trap. For Pakistan (UTC+5, matching
     this user's own PKR loan), constructing a fresh LOCAL midnight for the target month and
     calling `.toISOString()` on it converts that LOCAL midnight back to the PREVIOUS day in
     UTC, silently shaving a day off. This sandbox's own dev/CI environment runs in UTC (zero
     offset), which is exactly why every earlier "verified live" Playwright check for this
     feature (Done item 163) never caught it — the bug is invisible at UTC+0 by construction.
     Fixed by rewriting `installmentDueDate()` as plain integer year/month/day arithmetic —
     no `Date` object ever represents the final calendar date, so there's no local/UTC
     boundary left to cross; `Date.UTC(...)`/`getUTCDate()` are used ONLY to look up how many
     days a target month has, both UTC consistently, so that lookup itself can't reintroduce
     the same class of bug. New regression tests assert the exact reported values (day
     28→28, day 29→28 when clamped) directly, timezone-independently — no need to simulate
     UTC+5, since the fix no longer depends on runtime timezone at all. **Lesson for any
     future date-math bug report from a real user**: this sandbox's own UTC-only dev
     environment is a blind spot for exactly this class of bug (local/UTC Date mixing) —
     don't trust "verified live" from this sandbox alone for date-sensitive features; prefer
     timezone-independent implementations (plain arithmetic, or explicit UTC throughout) over
     `Date` objects with mixed local/UTC access patterns as a rule, not just a fix-after-the-fact.
     **Also fixed in the same pass**: renamed the "Start date" field label to "Installment
     start date" on both the add-loan and edit-loan forms (the user's own suggested wording,
     since "start date" alone was ambiguous with when the LOAN itself started vs. when
     installments are due). **App-wide CSS fix, same user report** ("inputs have no min-width
     to defend their text views... they should go the next line if viewport is small"): the
     `.row > *{flex:1}` + `min-width`/`flex-wrap` fix that used to be gated behind
     `@media(max-width:640px)` (mobile only) is now the unconditional BASE rule — a many-field
     row (e.g. EMI's 10-field edit-loan form) was squeezing every field down to an unreadable
     sliver on a full DESKTOP viewport too, since nothing outside the mobile media query
     stopped `flex:1` from dividing the row's width evenly among however many fields happen to
     be in it. Verified this doesn't regress icon-button or chip rows sharing the same `.row`
     class: `.btn`'s own `min-width:38px`/`flex:0 0 auto` (already present, unchanged) wins
     over the new base rule at equal specificity by later source order, and a live check of
     both the QSE/PSX exchange-switcher chips and Funds' import-mode chips showed natural,
     un-stretched widths — the fix only engages once a row is genuinely too crowded to fit at
     a reasonable minimum width, the exact case it was meant to catch. Verified live via
     Playwright: a seeded loan reproducing the user's exact PKR numbers showed every one of 36
     schedule due dates correctly ending in the configured day (zero off-by-one dates), and
     the edit-loan form's 10 fields now wrap across 4 rows at 174-265px each instead of one
     crammed row. `npx tsc -b` / `npm run test` (360 tests, 1 new) / `npm run build` all clean.
168. **Six more quick wins from the same 2026-08-26 batch — closes Pending items 71/100/74/80
     directly; contributes toward 68/83.** (1) EMI Timeline zone gained "Paid EMI count"
     (`sum.elapsed`, already computed) alongside the existing "Remaining EMI count" — closes
     item 71. (2) EMI loan-detail page reordered to Stats → Schedule (with the nested Big EMI
     generator) → Amortization chart → What-if planner → Link-to-bank, closing item 68's
     literal request (the latter three moved as one group, keeping their own relative order,
     since the user's own wording didn't specify where they land beyond "after Schedule").
     (3) Personal Loans' loan-detail page reordered to Repayments → Payoff Planner (was the
     reverse) — closes item 100. (4) Net Worth's "Rates between your own currencies" table now
     shows both directions (1 A = X B, 1 B = Y A) instead of just one — closes item 74;
     `effectiveRate()` already derives either direction symmetrically from the same
     USD-anchored table, so no calc change was needed, just rendering both. (5) Banking's
     "Total balance (CODE)" stat-card label — which read like a live-converted figure, when
     it's actually just "your accounts that happen to use this currency, summed" — renamed to
     "Accounts in CODE" with an explanatory tooltip spelling out the no-conversion caveat
     directly; closes item 80 (a lighter-touch fix than the user's own literal "Pakistani
     Banks Total Balance" suggestion, since that assumes currency implies country, which isn't
     generally true). Verified live via Playwright across all four pages (EMI, Personal Loans,
     Net Worth, Banking) with seeded data — zero real console errors. `npx tsc -b` / `npm run
     test` (360 tests, unchanged — no calc logic touched) / `npm run build` all clean.
169. **Four more items from the same batch — closes Pending items 89/75/79/102 directly.**
     (1) **App-wide**: `Tooltip` now renders a small muted info-icon affordance right after its
     children, so a `Tooltip`-wrapped label visibly signals it has more info instead of relying
     on a user already knowing to hover it — fixed once in the shared component, applying
     everywhere at once (closes item 89). `children` was loosened to optional in the type,
     since the icon alone can now be the whole trigger for an icon-only tooltip. One existing
     call site (PSX's Fee-mode explainer, Done item 85) had manually wrapped its own `InfoIcon`
     as `Tooltip`'s children — simplified to rely on the new automatic icon instead of showing
     two icons back to back; audited the rest of the app and confirmed this was the only such
     manual pattern. (2) Net Worth's "Net worth over time" chart now renders AFTER the
     per-currency summary cards instead of before them (closes item 75). (3) Net Worth's
     per-module "By module" breakdown (inside each currency's own card) now renders as small
     colored stat cards instead of a list of table-style rows, reusing the same sign-colored-
     card pattern (Done item 122) rather than a redundant inner pill (closes item 79). (4) The
     Transfers page's permanent "New linked transfer" explanatory paragraph — the exact
     "eating whole page space" pattern already fixed elsewhere via Done item 85 — moved behind
     a `Tooltip` next to the heading, one short interaction instead of a permanent block
     (closes item 102). Verified live via Playwright: icons render on Dashboard stat cards, the
     PSX fee-mode tooltip shows exactly one icon (not two), the Net Worth chart's Y-position is
     confirmed below the currency cards' via real bounding-box measurement, 8 by-module cards
     render, and the Transfers tooltip correctly shows/hides on hovering its icon (a first test
     attempt hovering the whole heading missed the icon's actual bounding box — hovering the
     icon directly confirmed it works). `npx tsc -b` / `npm run test` (360 tests, unchanged —
     UI-only) / `npm run build` all clean.
170. **Banking/Cash "Add" forms moved to FAB+popup + Branch/Account Type fields — closes
     Pending items 81/82/86.** Banking's "Add account" form (previously a permanently-visible
     `Card` at the top of the Accounts tab) is now a floating "+" button + popup, same pattern
     already used for EMI's "Add a loan" (Done item 166) — the form itself is unchanged, just
     moved behind `AddAccountFab`. `BankAccount` gained optional `branch`/`accountType` fields
     (free-form text with a small suggestion datalist — `Savings`/`Current`/`Checking`/`Salary`/
     `Business`/`Fixed deposit` — not a fixed enum, per this project's own locked "category
     fields must be free-form" rule), wired into the add-account form, the accounts table's edit
     row, a new "Type / Branch" table column, and `AccountDetailModal`'s existing account-detail
     editor (closes item 82). Same FAB+popup treatment applied to both Banking's and Cash's
     "Add a plan" forms on their respective Planning tabs (closes item 86). Verified live via
     Playwright: the permanent forms are confirmed gone from all three tabs, each FAB opens a
     working modal, a submitted account correctly hit the sign-in gate (no real account to
     complete an end-to-end save with, same established verification limit as every other
     sign-in-gated write in this project). `npx tsc -b` / `npm run test` (360 tests, unchanged)
     / `npm run build` all clean. **Not done in this pass**: item 84 (leading the account-detail
     modal with "add a transaction" instead of the edit-details form) and item 83 (a real routed
     detail page vs. a modal) — both still need the larger architecture decision described in
     their own Pending entries.
171. **IBAN → bank name/BIC lookup + a "required fields" visual convention (2026-08-26,
     user-requested).** New `lib/ibanLookup.ts`: `isValidIbanFormat()` validates an IBAN's own
     mod-97 checksum locally (no network call for something obviously malformed), then
     `lookupIban()` tries a chain of live providers, returning the first real hit or `null` if
     every provider fails/has nothing for that IBAN. **Only one live provider is wired in**
     (openiban.com, a well-established free/keyless public tool) — the user asked to "utilize
     both API," but every other commonly-referenced "free" IBAN lookup service actually requires
     a registered key even on its free tier, and hardcoding an unverified second endpoint risked
     shipping a permanently-dead code path that looks like real redundancy but never fires.
     `IBAN_PROVIDERS` is an array specifically so a second confirmed provider can be added later
     without touching any caller — flagged here rather than silently claiming two working
     providers. `BankAccount` gained optional `iban`/`bankName`/`bic` fields; a new
     `IbanLookupFields` component (IBAN input + "Look up bank" button + Bank name/BIC fields,
     all three independently hand-editable regardless of lookup outcome) is wired into both the
     add-account form and `AccountDetailModal`'s detail editor. Per the user's own explicit
     wording, a failed/unsupported lookup shows exactly that: "IBAN not supported by the app (or
     the lookup service is unavailable right now) — enter the bank name manually below," never a
     silent failure or a raw error. This sandbox's own network policy blocks the live
     openiban.com call outright (`ERR_CONNECTION_RESET`, the same restriction already
     encountered for Net Worth's FX-rate fetch and the Google Fonts CDN) — so the graceful-
     failure path is what's actually verified here; the success path (a real IBAN returning a
     real bank name) is unverified in this environment and should be confirmed by a future
     session with real browser network access, same caveat pattern as those two earlier
     features. Separately, `Field` gained an optional `required` prop (a small red asterisk
     after the label) — a quick visual scan distinct from the "(optional)" suffix several fields
     already spell out in their label text — applied to Banking's add-account form's two
     genuinely required fields (Account name, Currency), with a "* Required. Everything else on
     this form is optional." legend. **Scoped to Banking's add-account form only** — the user's
     "clearly mark the required fields in the app" is a real app-wide ask (the same territory as
     Pending item 97's "every remaining unlabeled input" audit); this establishes the `Field`
     mechanism and applies it to the one form directly tied to the IBAN request, with the
     broader rollout tracked as a new Pending item rather than guessed at everywhere in one
     pass. Verified live via Playwright: the required-field asterisk and legend render; an
     invalid-checksum IBAN is caught locally with a clear message before any network attempt;
     a valid-checksum IBAN correctly shows the "not supported / unavailable" fallback message
     once the (sandbox-blocked) live call fails; Bank name/BIC stay freely editable throughout.
     New tests: `lib/__tests__/ibanLookup.test.ts` (4 cases, using real published example IBANs
     with known-valid checksums). `npx tsc -b` / `npm run test` (364 tests, 4 new) / `npm run
     build` all clean.
172. **EMI edit-form buttons moved into the card header + a balance chart added to Personal
     Loans' own loan-detail page — closes Pending items 66/99.** EMI's `LoanDetail`
     (`features/emi/pages/EMIPage.tsx`) previously swapped its entire outer `Card` body
     (title included) between a display view and an edit view, which is why Save/Cancel ended
     up below the field grid instead of the card's top-right corner like every other single-
     stranded-action card in the app (Done item 121). Restructured onto `CollapsibleCard`'s
     `title`/`headerExtra` slots instead: the header (name+details, or an "Editing NAME"
     heading) and the action buttons (Edit/Delete, or Save/Cancel) now live in a fixed position
     regardless of mode — only the field grid underneath swaps. Separately, Personal Loans'
     `LoanDetail` had no chart at all (the landing page's own Analytics tab charts, Done item
     45, are scoped across every loan, not one loan's own history) — new
     `loanBalanceHistory()` in `lib/calc/personalLoansModule.ts` (tested) returns one point per
     date something happened to that specific loan (its own start, then each repayment in
     order), rendered as a new "Balance over time" line chart (`LoanBalanceChart`) between the
     Repayments table and the Payoff Planner — kept below Repayments per Done item 100's
     already-established "real transactions before speculative content" ordering. Verified
     live via Playwright: the Personal Loans chart canvas renders once repayments exist; EMI's
     edit-mode Save button measured above the field grid's first input (was below it before
     this fix). New tests: `lib/calc/__tests__/personalLoansModule.test.ts` gained 3
     `loanBalanceHistory` cases. `npx tsc -b` / `npm run test` (367 tests, 3 new) / `npm run
     build` all clean.
173. **Compact density made genuinely more space-saving — closes Pending item 98.** Measured
     first, per this file's own established discipline (see Done item 111's identical approach
     for Console): `.btn`/form inputs/`select` were completely untouched by
     `data-density="compact"` — every card/table/stat-card rule shrank, but the two most
     visually large, most frequently-interacted controls on every page stayed at full
     Comfortable size (38px min-height) under Compact, which is the real, measurable reason it
     read as "barely different." Added `.btn`/`.btn.small`/input/`select` overrides sized
     strictly between Comfortable (38px) and Console (26px) — Compact now measures 32px,
     keeping the three tiers a genuine decreasing series (confirmed live: 38 → 32 → 26px).
     `npm run test` (367 tests, unchanged — a CSS-only fix) / `npm run build` all clean.
174. **Subscription renewal/expiry alerts, user-requested (2026-08-26).** `Subscription` gained
     `alerts?: SubscriptionAlert[]` — each alert is either a `daysBefore` lead time (re-anchored
     to the subscription's own NEXT occurrence automatically each cycle, so "3 days before"
     keeps working without re-entry) or a one-off `customAt` absolute date+time, for something
     that doesn't follow a regular billing cycle at all. New pure `alertTriggerMs()`/
     `dueSubscriptionAlerts()` in `lib/calc/subscriptionsModule.ts` (tested, 8 new cases) —
     the latter takes an injected `isDismissed` check so it stays pure, with the actual
     dismissal state living in a new small local-only `subscriptionAlertDismissalStore.ts`
     (same idiom as `appearanceStore`/`termsStore` — a UI "seen this" marker, not financial
     data, never synced to Firebase). Dismissal is keyed per-occurrence
     (`subId:alertId:occurrenceTag`), so dismissing a `daysBefore` alert only silences the
     CURRENT upcoming renewal — it re-triggers with a fresh key once that cycle passes and the
     next one comes due. Two new surfaces: `SubscriptionAlertsPopup` (mounted once at the App
     root, alongside `TermsGateModal`/`ConfirmDialogHost`, inside `HashRouter` so its
     "Manage subscriptions →" link works) shows a snapshot of due alerts on app load, auto-
     hides after 12s or on manual close, and lets each item be individually dismissed; Net
     Worth's own "homepage" gained a `Notice` listing every subscription renewing within 14
     days (a broader glance window than any one subscription's configured alert lead time, so
     it stays useful even for a subscription with no alerts configured). The Subscriptions
     page's own `SubscriptionDetail` gained a "Renewal / expiry alerts" `CollapsibleCard`:
     suggested 3/2/1-day chips (disabled once already added) plus a `datetime-local` picker for
     a custom alert, and a list of configured alerts with per-row removal. **The "custom
     subscription period as a number input" half of the request was already built** — checked
     before assuming it needed new code: `billingCycle: 'custom'` + `customDays` (an "Every N
     days" number field) already exists and covers exactly the user's own examples (a 28-day
     mobile package, a 180-day SIM validity). Verified live via Playwright: the popup correctly
     shows for a genuinely-due alert (seeded so the next occurrence IS today, well within a
     3-day lead) and correctly hides after Dismiss, with the dismissal persisted to
     localStorage; the Net Worth notice renders the seeded subscription's name/amount/date; the
     detail page's alert chips hit the real sign-in gate. `npx tsc -b` / `npm run test` (375
     tests, 8 new) / `npm run build` all clean.
175. **Credit card tracking as a Bank liability, user-requested (2026-08-26) — closes Pending
     item 105.** Per the user's own explicit design answer, a credit card is its own
     independent `BankAccount` (own balance, own transaction ledger — NOT tied to whichever
     real account happens to pay its statement, since a card can be paid from any of several
     accounts at the same bank, ad hoc each time). `BankAccount` gained `isLiability?: boolean`
     plus the full field set the user asked for: `creditLimit`, `annualFee`, `statementDate`/
     `paymentDueDate` (day-of-month), `lateFeeAfterDue`, `minPaymentAmount`, `cardNetwork`
     (free-form + a Visa/Mastercard/Amex/etc. suggestion datalist), and `cardBin` (first 6-8
     digits ONLY, never a full card number — same caution already applied to `accountNumber`).
     **A real, useful realization while implementing this**: the existing signed-transaction
     convention (negative = debit/spend, positive = credit/payment) already computes a credit
     card's balance correctly with ZERO changes to `accountBalance`/`accountRunningLedger` — a
     purchase drives the balance negative (money owed), a payment brings it back toward zero,
     exactly like a real statement; the only genuinely new logic needed was where that balance
     gets COUNTED. New `assetBalanceByCurrency()`/`creditCardLiabilityByCurrency()` in
     `lib/calc/bankModule.ts` (tested) split accounts by `isLiability` — the existing
     `totalBalanceByCurrency()` is untouched (still a blended net figure, used by Banking's own
     "Accounts in CODE" stat card) — and `useNetWorthSummary.ts` now feeds asset-only accounts
     into `bank` and card debt into a new `creditCards` field on `NetWorthInputs`
     (`lib/calc/netWorth.ts`), so a card's debt is counted exactly once, as a liability, never
     silently blended into (and understating) the asset-side "Bank" figure. Banking's accounts
     table gained a "Credit card" badge and shows a liability account's balance as "$X owed"
     instead of a confusing negative number; `AccountDetailModal` shows "Amount owed" plus
     available credit when a limit is set. **Card-network detection, per the user's own
     question**: new `lib/binLookup.ts` (same provider-chain shape as `lib/ibanLookup.ts`) —
     entering the first 6-8 digits (a BIN/IIN, never the full card number) and clicking "Detect
     network" calls the free, keyless `binlist.net` to fill in the network; same sandbox-
     network-blocked caveat as the IBAN feature applies to the live success path. **Also
     user-requested, same batch**: new `lib/bankDirectory.ts` — a prefilled suggestion list of
     common Pakistani and Qatari banks and mobile-wallet apps (JazzCash, Easypaisa, NayaPay,
     QNB, Doha Bank, etc.), wired as a datalist on the existing "Bank name" field (from Done
     item 171's IBAN feature) in both the add-account form and account detail — free-form, not
     a fixed list, exactly like every other suggestion datalist in this app. Verified live via
     Playwright: the credit-card fields stay hidden until the toggle is checked; the bank-name
     datalist includes HBL/JazzCash/QNB; an invalid BIN is caught locally before any network
     call; Net Worth correctly shows a seeded $1000 checking account + a $150-owed credit card
     as Assets 1k / Liabilities 150 / Net 850, with "Credit cards" appearing as its own
     by-module breakdown line (confirmed via the raw computed text, not a screenshot guess);
     the accounts table shows the "Credit card" badge and "150.00 USD owed"; the detail modal
     shows "Amount owed" and correctly computed available credit. New tests:
     `lib/calc/__tests__/bankModule.test.ts` (+3), `lib/calc/__tests__/netWorth.test.ts` (+1,
     plus 7 existing cases updated for the new required `creditCards` input),
     `lib/__tests__/binLookup.test.ts` (+3). `npx tsc -b` / `npm run test` (382 tests, 7 new) /
     `npm run build` all clean.
176. **Budget Planner built, user-requested (2026-08-26) — closes Pending item 106.** Asked the
     user directly (`AskUserQuestion`) whether this should unify Cash/Bank/Rentals' EXISTING
     Planning-tab planned entries into one cross-module view, or be a genuinely separate
     category-budget system — the user picked unification. New `lib/calc/budgetPlanner.ts`:
     `collectBudgetActivities()` normalizes each module's real transactions AND its own
     not-yet-executed planned entries onto one common signed shape (positive = income, negative
     = expense) — a Cash `IN`/`OUT`, a Bank signed `amount`, and a Rentals `RENT_INCOME`/
     `EXPENSE` all map onto the same convention; an already-executed plan is deliberately
     excluded (its real counterpart is already in the list, so including both would double-
     count the same money movement). `monthlyIncomeExpense()` buckets the combined list by
     calendar month per currency; `threeMonthWindow()` returns the previous/current/next month
     strings the user asked for by name. **Per the user's own follow-up clarification** ("3
     months projection is for Net worth dashboard. But it can also be reflected in the
     planner."), the projection chart's primary home is Net Worth's homepage (a new "Income vs.
     expense — previous / current / next month" `ChartCard`, right below the subscription-
     renewals notice) — the exact same numbers also render on the new dedicated
     `/budget` page, which is where the user acts on them. New `features/budget/pages/
     BudgetPlannerPage.tsx`: the 3-month chart, a cross-module "All planned financial activity"
     table (sortable, shows Module/Account-or-Property/Category/Amount/Actual-vs-Planned
     status), and an "Add a plan" FAB+popup form — picking a financial source (Cash/a specific
     Bank account/a specific Rental property) writes a real entry into THAT module's own
     already-tested `addEntry` action, exactly as if the user had added it from that module's
     own Planning tab; this page is a read+write CONVENIENCE layer, not a new parallel data
     path, and nothing about the existing Planning tabs changed. Predefined income/expense
     category suggestion lists (`PREDEFINED_INCOME_CATEGORIES`/`PREDEFINED_EXPENSE_CATEGORIES`)
     back a datalist on the category field, switching list based on the picked Income/Expense
     type — free-form, not a fixed enum, same rule as every other category field in this app.
     New nav entry in `CategoryNav.tsx` ("Budget Planner," global access per the user's own
     ask). Verified live via Playwright: the Net Worth chart and its "Open Budget Planner →"
     link render correctly with seeded Cash+Bank activity; the Budget Planner page's activity
     table correctly lists both a seeded Cash entry and a seeded Bank transaction; switching
     the add-plan form's financial source to "Bank account" correctly reveals the account
     picker (confirmed via a real select-element count check, not a label-text guess that a
     CSS uppercase transform had already broken once); submitting hits the real sign-in gate.
     New tests: `lib/calc/__tests__/budgetPlanner.test.ts` (6 cases). `npx tsc -b` / `npm run
     test` (388 tests, 6 new) / `npm run build` all clean. **Deliberately not built yet**: the
     user separately mentioned having a sample monthly-expense-tracker Excel sheet and wants
     the app to answer "all the capabilities" it provides — explicitly held off building
     anything against that ask until the real file is attached and reviewed, per this
     project's own established "work from the real file, not an assumption" lesson (see the
     Funds Daily History Import entry above for the precedent this follows).
177. **Whole-app import/export, user-requested (2026-08-26) — closes Pending item 77.** Every
     one of this app's 14 stores already exposes the exact same `{workbook, setWorkbook}`
     shape (`MinimalWorkbookStore`, see this file's own design-decisions note) purely because
     they were all built off the same two factories (`createWorkbookStore`/`createEntryStore`)
     or hand-written to match that shape deliberately — which made a whole-app export/import
     almost entirely "wiring," not new mechanics: `features/appData/pages/AppDataPage.tsx`
     (new route `/app-data`, linked from the Sidebar footer as "Backup / restore all data")
     reads `.workbook` from all 14 stores into one combined JSON object keyed by module name —
     deliberately the SAME key names (`bank`, `cash`, `emiLoans`, `funds`, `personalLoans`,
     `plannedBank`, `plannedCash`, `plannedRentals`, `psx`, `qse`, `rentals`, `subscriptions`,
     `interEntityTransfers`, `netWorthSnapshots`) this app's own Firebase RTDB structure
     already uses per account, so an exported file is directly comparable to (though not
     byte-identical to, since this omits Firebase's own `_updated` timestamp) a raw RTDB
     export for the same account. Import parses the file, confirms with the user BY NAME which
     modules it found data for (never silently importing an unrecognized/partial file), then
     calls each present module's own already-tested `setWorkbook()` — the exact same call each
     module's own per-module JSON import already makes (still there, unchanged, in each
     module's own Settings tab) — just for every module in one file instead of fourteen
     separate ones. Sign-in-gated, same as every other write in this app. Verified live via
     Playwright: exporting with seeded Bank/Subscriptions data produces a real downloaded file
     with exactly the 14 expected keys and the correct seeded values inside; re-uploading that
     same file correctly names "Banking"/"Subscriptions" in the pre-import confirm dialog and
     hits the real sign-in gate after confirming; the Sidebar link renders. `npx tsc -b` /
     `npm run test` (388 tests, unchanged — no calc logic, pure UI wiring onto already-tested
     store actions) / `npm run build` all clean.
178. **Real 2-year expense-tracker Excel + real RTDB export merged into one whole-app-import
     file for the user (2026-08-26).** The user attached their real personal
     `QR.Expense.FY20252026_For__FinanceRecorder.xlsx` (Oct.2024-Sep.2026, one sheet/month)
     plus a real production RTDB export and asked for one combined import file using item
     177's format. Full writeup, including 5 real errors found and fixed via independent
     ground-truth cross-checking against the sheet's own summary rows (2 of them self-caught
     mid-session and disclosed to the user), is in `CLAUDE.md`'s dedicated entry for this —
     read that before touching this data again. Short version: excluded the oldest sheet
     (Sept.2024) as a proven duplicate of Oct.2024's own re-logged data; recovered new "GCC"/
     "PCC" credit-card liability accounts and a new JazzCash account; recorded 6 real,
     unexplained +3000 QAR balance jumps in the source spreadsheet as explicit dated
     reconciliation transactions rather than silently absorbing them; excluded a spreadsheet
     "Total" footer row that was being imported as a fake 687,000 PKR transaction; deliberately
     excluded BOP-ASTP history from a small 2-sheet Pakistan-side ledger to avoid corrupting
     that account's real current balance with disconnected ~2-year-old data. Final numbers
     reconcile exactly to the sheet's own Sep.2026 summary (QIB Current 1928.61 QAR, QIB
     Savings 10,000 QAR, both credit cards 0, Cash 0 QAR / 30,000 PKR) — every other real
     module passes through unchanged. Delivered to the user as a downloadable file with import
     instructions, since this session cannot sign in as them to apply it directly; verified via
     Playwright that importing it through the real `/app-data` flow correctly reaches the
     sign-in gate, and that seeding the same finished file straight into the store (bypassing
     the gate) renders Bank/Cash/Net Worth with the exact reconciled figures above and zero
     console errors. **Not done as part of this**: the data was NOT committed to the repo as a
     Vitest fixture (unlike the existing QSE/PSX backups) — Bank/Cash/Subscriptions personal
     data is a new sensitivity category for this public repo, left for an explicit user
     decision rather than assumed.
179. **Critical, user-reported (2026-08-26): whole-app import silently reverted itself — "No
     transaction imported!" — a real race condition in `AppDataPage.tsx`'s import flow, not a
     data problem.** The user actually tried importing item 178's file and then re-exported
     their account to show the result: 0 bank transactions, 0 cash entries, only the original
     1 subscription — as if nothing had happened. Root cause: `useWorkbookCloudSync` (mounted
     globally for every module in `App.tsx`) keeps a LIVE Firebase `onValue` listener that
     unconditionally calls that module's `setWorkbook()` on every snapshot it reads —
     including the very first snapshot fired right after a fresh sign-in. `importAll()` calls
     `ensureSignedIn()` and then immediately calls `setWorkbook(parsed[key])` for each module —
     but that first post-sign-in cloud snapshot (the OLD real data) is an independent async
     operation racing the same auth-state-change event, and if it resolves after the import's
     own `setWorkbook()` calls, it silently clobbers the just-imported data back to whatever
     was already in the cloud. This is a real bug in the interaction between two
     already-correct pieces (the import flow, and the cloud-sync safety design), not a flaw in
     either one alone. **Fix**: after the existing local `setWorkbook()` calls, `importAll()`
     now ALSO writes each imported module directly to its own Firebase path (`users/{uid}/...`
     — same suffixes each module's own `use<Module>FirebaseSync.ts` already uses), reading
     straight from the parsed import data rather than from the store (which is exactly what
     the race can corrupt) — so even if the stale pull briefly clobbers the local view, that
     same write's own `onValue` echo re-applies the correct imported data moments later,
     self-healing instead of losing the import. `npx tsc -b` / `npm run test` (388 tests,
     unchanged) / `npm run build` all clean; verified via Playwright that the pre-import
     confirm dialog and the sign-in gate both still work correctly (unchanged behavior) — the
     actual race-condition fix itself can't be exercised by an automated test in this session
     (no real signed-in Firebase account available here, same limitation noted throughout this
     file), so the user re-trying the import is the real confirmation this needs.
180. **Critical, user-reported same day (2026-08-26): the import STILL didn't stick after item
     179's fix — the real bug, found this time.** The user tried again and re-exported: still
     0 bank transactions. Item 179's race-condition fix was real and necessary but wasn't the
     (only) blocker — diagnosed this one for certain rather than guessing again, by writing a
     small Vitest harness that imports the actual store modules directly and calls
     `setWorkbook()` on each with the real parsed file, outside any browser/Firebase
     dependency. It threw immediately on `qse` (the first module processed): `createWorkbookStore.
     ts`'s `normalize()` calls `wb.transactions.map(...)` (and the same for `transfers`/
     `adjustments`/`dividends`/`tradePlans`) with NO guard that those fields exist on `wb` —
     every OTHER caller of `setWorkbook` in this app (each module's own per-module JSON import
     in its Settings tab, and every cloud-sync pull in `useWorkbookCloudSync`) already merges
     the incoming data onto that module's own `createEmpty()` shape first, specifically because
     Firebase RTDB strips an empty array from storage entirely at any nesting depth (documented
     in this file's Design decisions) — a real production export can genuinely be missing a
     field like `tradePlans` outright. `AppDataPage.importAll()` was the ONE caller that skipped
     this merge. Since `qse` is processed first in iteration order and threw uncaught, the
     entire `foundKeys.forEach` loop aborted immediately — NOTHING imported, not just `qse`,
     exactly matching "no transaction imported" even with item 179's direct-Firebase-write
     already in place (that write also read from the un-merged `parsed[key]`, so it never even
     got a chance to run). **Fix**: `importAll()` now merges each module's parsed data onto its
     own `createEmpty*Workbook()` (all 14 imported into `AppDataPage.tsx`) before either the
     local `setWorkbook()` calls or the direct-to-cloud writes, matching the pattern every other
     caller already uses. **Verified this one for real, not just by inspection**: re-ran the
     same Vitest harness against the exact real file after the fix — all 14 modules' `setWorkbook`
     now succeed with zero errors, and the resulting store state has the exact expected counts
     (1790 bank transactions, 227 cash entries, 6 subscriptions, 39 QSE / 64 PSX transactions) —
     the strongest confirmation available without a real signed-in browser session. `npx tsc -b`
     / `npm run test` (388 tests, unchanged) / `npm run build` all clean.
181. **UI/UX batch, user-reported (2026-08-26): sidebar navigation overhaul + chart height cap.**
     Four related complaints from one message, all addressed: (1) "Nav should have proper
     buttons for account & Account backup should be a part of it" — the sign-in state and
     "Backup / restore all data" link were plain `.footer-note`-styled text; both are now real
     `.navbtn`-styled buttons, visually grouped in a bordered box so backup reads as part of
     the account section, not an unrelated footer line. (2) "Text should be pinned at the
     bottom" — `.sidebar` is now a flex column with only the nav content (`.sidebar-scroll`)
     scrolling internally; the account group + disclaimer + copyright (`.sidebar-footer`) sit
     outside that scroll region so they're always anchored at the sidebar's bottom edge instead
     of just being "the last thing in an `overflow:auto` block." (3) "Irritating to use 2 nav
     menus... always opening the popup to switch... is very hectic" — `CategoryNav.tsx`
     (README item 18's original dropdown/popover switcher across all 11 modules) is now a
     plain always-visible list using the same `.navbtn` styling as every other sidebar nav
     item, so switching modules is one click instead of open-then-click. (4) "No pie charts or
     other charts take more than 35vh" — `ChartCard` (the shared wrapper every Dashboard/
     Analytics/module chart uses) had no height cap at all, relying on Chart.js's default
     `maintainAspectRatio: true` (a fixed 2:1 ratio that, in a wide column with no explicit
     container height, could render 500px+ tall — exactly what the reported screenshot showed
     on Budget Planner). Fixed at the shared layer, not per chart: `ChartJS.defaults.
     maintainAspectRatio = false` set once in `chartSetup.ts` (same file that already sets
     `layout.padding`/`scales.linear.grace` globally), paired with a new `.chart-canvas-wrap`
     class (`height: min(35vh, 340px)`) wrapping `ChartCard`'s children in `theme.css` — every
     chart that goes through `ChartCard` (the large majority: Dashboard, Analytics ×2, Cash,
     Funds, Rentals, Banking, Personal Loans, Net Worth, Subscriptions, Budget Planner) is
     capped in one place. The handful of charts that render directly without `ChartCard`
     (QSE/PSX `PositionDetail`'s two charts, EMI's amortization chart) were checked and are
     already well under the cap via their own explicit pixel heights (115-220px) — left
     untouched. Verified live via Playwright with seeded QSE data: `chart-canvas-wrap` measured
     exactly 315px at a 900px-tall viewport (35% precisely), the persistent module list shows
     all 11 links with zero clicks needed, the account/backup group renders as real nav buttons,
     the footer sits flush at the sidebar's bottom edge, and the mobile drawer (a separate,
     pre-existing mechanism untouched by this change) still opens correctly with all 11 links
     visible inside it — zero console errors throughout. `npx tsc -b` / `npm run test` (388
     tests, unchanged — UI/CSS only) / `npm run build` all clean.

## Pending

1. QSE: H1 EPS/fundamentals data is still hard-coded in `webapp/src/lib/stockData/qseSeed.ts`
   as a fallback. The intended shared `stockData/QSE` Firebase node (finance data belonging
   to no single user) exists as a concept the app already prefers when present, but it
   hasn't actually been seeded in Firebase yet — needs real seeding, ideally via the
   scheduled-refresh-job architecture described under item 13 below, not manual entry.
12. Ability to read account statement PDFs/Excel files/images to auto-populate trade
    history — **superseded/expanded by item 25 below** (now includes CSV/JSON/PDF/image
    import across every module, not just QSE trades, and locks in a Python backend for the
    PDF/image half). See `MODULES_PLAN.md` §13.
13. Find APIs to fetch symbols, logos, stock prices, historical data, and finance news —
    **architecture constraint locked in 2026-08-23**: these must never be called live from
    the app itself (free/cheap tiers rate-limit fast). Fetch on a schedule (cron/worker)
    into our own database and serve the app from that store, same pattern already used for
    QSE's `stockData/QSE` node (item 1 above) and PSX's bundled `psxSeed.ts`.
17. ~~Charts could get more interactive beyond the ticker/month filters shipped in Done item 31
    (e.g. click-to-drill-down, hover cross-highlighting between charts).~~ **Now fully done.**
    Click-to-drill-down done (2026-08-25) — see Done items 134/137: every ticker-indexed chart
    in the app (Dashboard's Allocation/P-L-by-ticker, and Analytics' ROI%/Invested-vs-value/
    Total P&L/Holding period/Portfolio allocation/Dividend-by-ticker, on both QSE and PSX) now
    navigates to that ticker's own stock page on click. Hover cross-highlighting: first pass on
    Dashboard done (2026-08-25) — see Done item 147; **the deferred Analytics remainder (12
    charts across both exchanges) done (2026-08-26) — see Done item 155**, closing this item
    in full: every ticker-indexed chart on QSE's/PSX's Analytics pages now dims every other
    ticker across every tab section when one is hovered, the same as Dashboard's pair.
19. ~~Cross-entity transaction linking beyond v1 scope (see Done item 29): Funds/Rentals/EMI/
    Personal Loans aren't wired into the Transfers page yet — only Cash↔Bank and
    Bank↔QSE/PSX.~~ **Superseded — see item 21 below, which is now fully done (Done item
    156, 2026-08-26): every module this project supports (Cash, Bank, QSE, PSX, Funds,
    Rentals, Personal Loans, EMI/Loans) is wired into cross-entity linking.** One real gap
    from this item's original text is still genuinely open, tracked here rather than
    silently dropped: **a real signed-in browser round-trip** (create/edit/delete a link,
    confirm both sides update, across every module pair — not just the unit tests and
    signed-out sign-in-gate checks every session so far has relied on) has never actually
    been done, since every session so far has avoided creating even a throwaway account
    against the real production Firebase project, per this project's own locked cloud-sync-
    safety principle. This needs the user to either do it themselves once, or explicitly
    authorize a throwaway test account for it.

**New wave, 2026-08-23 (user-requested, full design detail in `MODULES_PLAN.md`'s "Next
wave" section)**:

21. ~~Cross-entity linking remainder: Funds needs its hidden `Transfer` field exposed in the
    UI.~~ **Done (2026-08-24) — see Done item 100.** Bank/Cash↔Funds now works, same pattern
    as every other linked module pair. ~~EMI has no repayment ledger at all to link into.~~
    **Done (2026-08-26) — see Done item 156.** A real, addressable `EMIRepayment` ledger now
    exists and EMI is a fully linkable module — every module named in this project's linking
    system is now wired in.
22. Calculator button remainder: it's module-aware now (hidden outside Stock Exchanges, see
    Done item 32) — the longer-term goal of a *relevant* calculator per module (an EMI payoff
    calculator, a Cash quick-math tool, etc.) is now largely covered by each module's own
    what-if/planner tools built during item 23's Analytics wave (EMI's extra-payment planner,
    Personal Loans' payoff planner, Cash/Banking's Planning tab) rather than a dedicated
    Calculator-button variant per module — no separate work item left here unless a module-
    specific popup calculator is explicitly requested later.
23. **Per-module Analytics for Cash/Banking/Personal Loans/EMI-Loans/Funds/Rentals — DONE
    (2026-08-24), see Done items 44/45/90/91/92/93.** Every one of the six non-exchange
    modules now has a real Analytics tab with charts, matching QSE/PSX's Analytics page in
    spirit (fewer charts per module, all fit for that module's own data shape — see
    `MODULES_PLAN.md` §11 for what each module got). Module-specific "planning" tools
    (distinct from Analytics) are tracked separately and are not all done: Cash/Banking have
    the Planning tab (item 43), EMI/Rentals have auto-generated plans (items 59/60), but QSE/
    PSX's Trade-Planner-style multi-scenario planner has no equivalent yet in Personal Loans/
    Funds — not tracked as a gap here since nothing in this wave's scope promised one.
24. ~~New Subscriptions module — recurring payments (streaming, gym, etc.) linked to a paying
    entity (a Bank account or Cash).~~ **Done (2026-08-24) — see Done item 99, MODULES_PLAN.md
    §12.** Uses the same generate-a-planned-entry pattern as EMI/Rentals rather than the
    heavier full cross-entity-link record (item 21's own remainder is unrelated/still open).
25. Import pipeline: CSV/JSON import — **✅ done for Cash, Rentals, and Personal Loans (see
    Done items 40/41)**, browser-only, no new infra. PDF/image import still needs **a
    separate Python backend service** (locked decision) for OCR/parsing, hosted on
    infrastructure the user chooses — real new infra outside a single coding session's
    control. Not started — see `MODULES_PLAN.md` §13.
26. "Only a toast shows instead of the sign-in popup" (see Done item 38) — investigated,
    couldn't reproduce locally (both primary sign-in entry points open the real modal
    correctly). Needs a specific page/button from the user to chase further if it recurs.
27. ~~Editing (not deleting) a linked record directly in its native module still doesn't
    propagate to the other side of the link or the link record itself.~~ **Warned about, not
    auto-synced — see Done item 106.** Full propagation isn't safe to do blindly (a
    cross-currency link has no live FX rate to derive one side's new amount from the other's
    edit), so every native edit-save now confirms with the user first, naming the other module
    and explaining the edit stays one-sided if they proceed. Full sync still only happens via
    the Transfers page itself.
28. **Planning v2 — real-but-pending transfers + balance reconciliation (2026-08-23,
    user-requested, design captured but explicitly NOT started).** The Planning feature
    (item 43 below) needs to also handle a second case beyond a pure hypothetical: a real
    transfer the user has already sent that takes a few business days to clear, during
    which the observed account balance doesn't yet reflect it (their own example: an
    account with a small daily profit accrual, where the app would need to tell "just
    another day's profit" apart from "my pending deposit cleared" by comparing the actual
    new balance against the expected ordinary increment). If it detects a match, it should
    suggest — never silently apply — that a specific hanging plan has settled, including
    which date profit-basis should switch on, for the user's explicit approval. **Blocked on
    the user's own sample Excel data**, which they said they'll attach in a future turn —
    per their explicit instruction, no code exists for this yet. Full design writeup,
    including the open unresolved gaps (no "expected profit rate" field exists yet, no
    single "observed balance" event exists to hook a reconciliation check into, ambiguous-
    match tolerance undesigned) is in `MODULES_PLAN.md` §15 — read that before touching this.
    **Refined same day**: the "expected ordinary increment" isn't necessarily flat every
    day — some accounts pay a noticeably larger payout on one specific weekday (the user's
    example: Friday pays 15 instead of the regular 2) — so the eventual "expected profit
    rate" field needs to support at least a day-of-week-varying rate, not just one flat
    number. Still blocked on the sample data for the exact shape.

**New batch of user feedback, 2026-08-23 (mid-session) — see Done item 51 for item (1),
already fixed; the rest tracked here**:

40. ~~Account/record detail drill-down + statement export for every module besides
    Banking.~~ **Done (2026-08-24) — see Done items 58/94/95/96.** Every module now has a
    statement export from its own primary record's detail view: Bank (accounts), Personal
    Loans (repayments), EMI/Loans (full schedule), Funds (transactions), Rentals
    (income/expenses), and QSE/PSX (trade statement + a separate price-history export, since
    those needed two distinct logs rather than one table like every other module).
39. ~~A net-worth dashboard summarizing everything across every module, with collapsible
    per-currency sections.~~ **Done — see Done item 66.** The user later overrode the
    Cloud-Function plan below ("leave blaze plan. if you have any free api, okay otherwise
    manual inputs accepted") in favor of a free client-side fetch with a manual-entry
    fallback, so the Blaze-plan Cloud Function scaffolded in `functions/index.js`
    (MODULES_PLAN.md §16) is now superseded and unused — left in the repo in case a real
    scheduled backend is wanted later, but the shipped dashboard doesn't depend on it.

41. ~~Standing instruction: "All tables should be sortable having index/id for chronological
    sorting. also, add time with all transaction dates for true chronology."~~ **Sortability
    done earlier; the time-of-day half done (2026-08-25), user-confirmed backfill/timezone
    approach — see Done item 133.** Missing time backfills to noon; a timezone selector
    prefills from the record's market (QSE/PSX) or currency, always overridable. Calc-engine
    side (real instant-based sorting) is wired in everywhere via `lib/datetime.ts`/
    `sortTransactionsChronological`/`buildCashLedger`, so every module's same-day-ordering
    already benefits regardless of whether that module's own add-form captures a time yet.
    UI capture (an actual Time+Timezone input on the add-form) shipped for QSE's/PSX's Trade
    Transactions and Cash Transfers forms — the highest-value case, since same-day ordering is
    exactly where this matters. **QSE's/PSX's Adjustments and Dividends forms also done
    (2026-08-25) — see Done item 135. Now fully done (2026-08-25) — see Done item 136**: Cash,
    Bank, Personal Loans, and Rentals' primary add-forms all have `TimeZoneFields` now, and each
    module's own running-balance/ledger calc (`cashRunningLedger`/`accountRunningLedger`/
    `repaymentRunningOutstanding`) sorts by real instant via `toInstantMs`, same upgrade pattern
    as Done item 133. Funds reuses the shared `Transaction` type (already had `time`/`timezone`
    from Done item 133), so it only needed the UI field, no type/calc change. Subscriptions is
    deliberately skipped — a `Subscription` record has only a `startDate`/`cancelledDate` on
    the subscription itself, no per-transaction dated log, so there's no same-day-ordering
    scenario for a time field to resolve. This closes Pending item 41 in full.
42. ~~Roll out `CollapsibleCard` further, including chart cards on Analytics pages.~~ **Done —
    see Done items 74, 82, 101, and 107.** Chart cards across every Dashboard/Analytics page
    are collapsible (fixed once at the shared `ChartCard` component). Portfolio's Holdings/
    History tables turned out to already be collapsible as a side effect of the later Tabs
    redesign (Done item 103) — each is rendered through the shared `Tabs` component, which now
    wraps every section in its own `CollapsibleCard`; this line was stale by the time it was
    re-checked, not actually still open. Personal Loans' `RepaymentsSection` needed a real
    split (Done item 107): the add-form stays outside any collapsible (collapsing a form
    mid-fill is a UX trap, same rule the rest of this rollout followed), and the table + export
    controls now sit inside their own "Repayment History" `CollapsibleCard`. The Trade
    Planner's per-ticker analysis table remains uncollapsed on purpose — it's already inside a
    collapsible `PlanCard`, so a second nested toggle would add clutter, not clarity.
43. ~~Roll out `StatCard`'s `hue` prop beyond QSE/PSX's Dashboard.~~ **Done — see Done items
    87/88.** StockPage's Summary tab and every non-exchange module's landing stat cards
    (Cash/Bank/Personal Loans/EMI/Funds/Rentals) now have distinct colors, backed by a shared
    `lib/statCardHues.ts`.

**User feedback, 2026-08-24 (mid-session, "preferred tasks" list) — not started yet**:

44. ~~A running-balance column for Cash's ledger and other transaction-style tables.~~ **Done
    — see Done item 84.** Cash/Bank already had one; QSE/PSX Transfers and Personal Loans
    repayments were the real gaps and now have one too.
45. ~~QSE's/PSX's Dashboard Holdings, Portfolio page, and StockPage's Summary tab should
    group related figures instead of one column/card per fact.~~ **Done (2026-08-24) — see
    Done items 85/86/87/97.** Portfolio's own closed-positions (History) table was the last
    one-fact-per-column table in QSE/PSX; every other module's own list views (Personal
    Loans, EMI, Funds, Rentals, Bank) were never part of this item's original ask and are a
    separate, much larger undertaking if wanted later — not tracked as a gap here.
46. ~~A raw-vs-concise number display toggle in Appearance settings (1,000 vs 1k).~~ **Done —
    see Done item 83.**
47. **Done — see Done items 85/89/98, plus a final audit (2026-08-26).** `components/
    Tooltip.tsx` now backs `StatCard`/`MoneyValue`/`FeeModeControl`'s tooltips, the Fee
    column's "(netted)"/"(override)" tags, the Trade Planner's sync indicators, QSE's/PSX's
    `PositionDetail` stat cards, and the per-transaction/per-repayment "Balance"/"Remaining"
    table cells. Re-grepped every remaining native `title=` attribute app-wide (2026-08-26):
    the overwhelming majority turned out to already be `Field`'s own `title` prop (which
    itself wraps the label in a real `Tooltip` — a naming coincidence, not a native-attribute
    gap) or `ChartCard`'s `title` (a plain heading string, not a tooltip at all). The genuine
    remaining native-attribute spots are all deliberate, reasoned exceptions, not oversights:
    single-word `<select>` labels and import-flow "Flip sign" checkboxes (Done item 98's own
    prior reasoning), the sidebar collapse/expand buttons (already self-explanatory one-word
    labels, not jargon needing an explanatory popup), and the Watchlist/avatar-emoji inputs
    (deliberately NOT wrapped in `Tooltip` — these are directly click-to-edit inputs, and
    `Tooltip`'s own `onClick` toggle would pop a tooltip open every time a user clicks in to
    type, a real UX regression the CollapsibleCard-header idea never had). Closing this out —
    no further native-`title` gaps remain worth converting.

**Design-system critique, remaining items (2026-08-24) — see Done item 103 for what shipped
from this same batch.** Three items deliberately not attempted in that pass, since each is a
large, subjective, high-regression-risk redesign that deserves its own scoped session rather
than a guess folded into a mixed batch:
48. ~~Body font choice for continuous reading/focus — the user's complaint was about the
    typeface itself, not size (font *size* presets already exist in Appearance). Needs an
    actual font pick (a real reading-optimized typeface, likely still from Google Fonts) and a
    visual before/after check, not a blind swap.~~ **A real bug found and fixed instead of a
    missing feature (2026-08-25) — see Done item 141.** The font pick was already made — the
    Appearance panel's font selector already offers 6 options, including two literally billed
    as reading-optimized ("Atkinson Hyperlegible (max readability)", "Lexend (reading-friendly)")
    — but none of the 6 web fonts it references (`Inter`, `Space Grotesk`, `JetBrains Mono`,
    `Atkinson Hyperlegible`, `Lexend`, `Source Serif 4`) were ever actually loaded via a
    stylesheet or `@font-face`, so every one of them silently fell back to the same generic
    system sans-serif — the "different" fonts were indistinguishable from each other and from
    the plain "system" option. Fixed by adding the missing Google Fonts `<link>` to
    `webapp/index.html`. **Verification is real but incomplete, stated rather than assumed
    complete**: confirmed via `curl` that both `fonts.googleapis.com` and the exact
    `fonts.gstatic.com` font-file URL the stylesheet references are reachable and return the
    real font data; confirmed via Playwright that the app itself has zero new regressions from
    the change. But this sandbox's own Chromium browser (not just this session's `curl`) hits a
    `net::ERR_CONNECTION_RESET` specifically fetching the Google Fonts stylesheet — the exact
    same class of sandbox-only browser-vs-curl network gap already documented for the Net Worth
    dashboard's FX-rate fetch (Done item 66) — so the actual visual font swap could not be
    screenshotted from this session. A future session with real browser access (or the user
    checking the live deployed site) should confirm the 6 font options actually render
    differently and drop this caveat once confirmed.
49. "Assess a stock in one go" — the user's complaint is that a stock's info is spread across
    Dashboard/Portfolio/StockPage/Risk Analysis with no single at-a-glance view. **Risk Analysis
    half done (2026-08-25) — see Done item 143**: the specific named gap (Risk Analysis existing
    only as a separate whole-portfolio page, unreachable from a stock's own page) is closed —
    `StockPage.tsx` gained a "Risk Analysis" tab, pre-scoped to that ticker, alongside Summary
    and Trades. **Still open**: the deeper IA question — whether Dashboard/Portfolio's own
    per-ticker views should also feed into or link from this single-stock page, and whether
    `PositionDetail`'s own information order is truly optimal for "assess in one go" — hasn't
    been attempted; that's a genuine redesign exercise, not a tab-addition.
50. "Themes and densities are deception" — the user's complaint is that switching a color theme
    or density mostly just recolors/respaces the same layout rather than being a genuinely
    different reading experience. **Density half addressed (2026-08-25) — see Done item 142**:
    Console density now hides stat cards' secondary "sub" line entirely (break-even color hint,
    avg/last sell price, etc.) rather than just shrinking it — a real "less information shown"
    difference, not only smaller text. **Still open**: the color-theme half of the complaint
    (do Material-family themes vs. the wine/ocean/forest/etc. color families need a genuinely
    different visual treatment — different shadow/elevation conventions, different component
    styling — beyond swapping CSS custom-property values?) hasn't been scoped or attempted; a
    real answer needs deciding what "meaningfully different" means for a color theme
    specifically, which is a more speculative design question than density's fairly literal
    "hide vs. show information" framing. **The user repeated this specifically about stat-card
    gradients on 2026-08-26** ("each theme should be different from other") right after the
    gradient itself was made subtler (Done item 153, item 7's "glassy" half) — the subtler-
    gradient fix is done, but it doesn't touch this still-open, larger "themes need structurally
    different treatment" question; still the same speculative design work this note has always
    described, not newly scoped by the repeat mention.

**Trade Planner follow-up, user-reported (2026-08-24, arrived mid-session right after Done
item 103) — all three now fixed, see Done item 104:**
51. ~~Every record type across every module should carry a stable, unique `id`.~~ **Partially
    done — see Done item 104.** `Adjustment`/`Dividend` retrofitted with `id?: string` (same
    pattern as `Transaction`/`Transfer`). Still open: `WatchlistItem` (has a natural key,
    `ticker`, so lower priority), `TradePlanLeg` (addressed by index within its own plan, a
    narrower scope than a top-level workbook array), Funds' own CRUD (already gets `id` for
    free since it reuses the `Transaction` shape).
52. ~~Real bug: executing a Trade Planner leg, then editing its transaction, left the plan
    showing stale data.~~ **Investigated and fixed — see Done item 104.** Root cause: the
    live-resolution mechanism itself was correct (confirmed by reading through
    `resolveExecutedTx`/`updateTransaction`'s index-based addressing — both preserve `id`
    correctly), so the user's specific report was very likely a leg executed *before* Done
    item 81's linking existed at all (no `executedTransactionId` to resolve from — a real gap
    in the fix's coverage, just not a bug in the fix itself). Added a manual "Link…" picker for
    any executed leg with no live link, and made a linked transaction directly editable inline
    from the Trade Planner.
53. ~~Trade Planner always prices a leg at full commission; summary table buried.~~ **Done —
    see Done item 104.** Every pending leg's fee now shows both the full-commission and
    same-day-netted price side by side; a row of colored summary cards sits above the detailed
    per-ticker table for an at-a-glance read.
54. "Utilize all page spaces and add useful infos on sides — fintech apps are data heavy
    rather than decorations" (2026-08-24). **Partially addressed (2026-08-25) — see Done item
    139**: the per-stock `PositionDetail` page now uses its wide-viewport space for a right-hand
    chart/Price-range stack instead of one long centered column. **A second, app-wide half done
    (2026-08-25) — see Done item 145**: `.main`'s hard `max-width:1180px` cap was measured to
    leave ~520px of dead space on a 1920px-wide viewport (sidebar 220px + content 1180px =
    1400px) on literally every page — bumped to 1600px, which the existing `repeat(auto-fit,
    minmax(...))` stat-card/chart grids already fill with extra columns for free, no per-page
    layout work needed. **A genuine right-rail content addition — first slice done (2026-08-26)
    — see Done item 164**: QSE's and PSX's Dashboard pages now have a real right-rail (a "live
    summary panel," per this item's own suggested direction) with a Net worth panel and an
    Upcoming plans panel, both pulling in cross-module data that wasn't otherwise visible from
    the Dashboard. **Still open**: this only covers Dashboard — Portfolio, module landing pages,
    and a third rail panel (e.g. a contextual glossary, or the "today's movers" among held
    positions idea considered but not built this pass) are all still a blank page each needing
    its own per-page judgment call about what actually belongs there, same as before; this also
    still ties into Pending item 49's "assess a stock in one go" IA rework for the per-stock page
    specifically.
55. Simplest-possible-language pass (2026-08-24 app-wide note, item 3 of the Risk Analysis
    batch) — Done item 105 added tooltips explaining jargon terms on the Risk Analysis page
    specifically. **First app-wide pass done (2026-08-25) — see Done item 140**: the highest-
    traffic jargon (P/L breakdown, Break-even, CGT, Outstanding, NAV, XIRR) across Dashboard/
    PositionDetail/EMI/Personal Loans/Funds now has an explanatory tooltip. **Second pass done
    (2026-08-25) — see Done item 144**: "Principal" (Personal Loans + EMI), "Amortization
    schedule" (EMI), "Total interest/markup (life)" (EMI), and "Monthly/Yearly equivalent"
    (Subscriptions) now have tooltips too. **Still open**: Bank/Cash/Rentals' own labels (their
    section headings — "By category", "Net income", "Monthly rollup" — read as plain English
    already and weren't judged to need one) and every table column header/form field hint
    across the app haven't had a dedicated audit pass — this was two real, meaningful passes on
    the terms most likely to confuse a non-trader/non-accountant, not an exhaustive audit of
    every string in the app.
56. **Portfolio page overhaul (2026-08-24, item 12 of the original screenshot batch) — a real,
    multi-part redesign; re-audited against the live page (2026-08-25), most items already
    resolved by later fixes in this same project, one real bug found and fixed — see Done item
    138.** The user's own list, verbatim, with current status: (a) "no live market data makes
    the price chart too big/almost flat" — the Daily Price chart is a compact fixed 130px height
    and already handles real multi-point price history correctly (Done item 78's raw-price-
    history fix); not reproduced against live data, no further action without a concrete repro.
    (b) "CGT shows 0" — checked live with a real open+part-sold PSX position: CGT computes and
    displays a correct non-zero value; a literal 0 only happens when the position is at a loss
    or the workbook's own CGT rate setting is 0, both correct behavior, not a bug. (c) "current-
    position card missing some attributes" — the card already shows Shares/Cost+break-even/
    Invested/CGT (PSX) or Shares/Cost+break-even/Invested (QSE); vague without a specific
    missing field named, no action taken. (d) **"chart missing sold-price and break-even
    reference labels" — a REAL bug, found and fixed, see Done item 138**: the reference-line bar
    chart already plotted all 4 bars (Buy/Sold/Current/Break-even) but Chart.js's default
    `autoSkip` silently dropped 2 of the 4 category-axis labels since the chart was too short —
    the bars were there, just visually unlabeled. (e) "chart may need resizing" — addressed as
    part of (d)'s fix (110/90px → 150/115px, just enough for 4 unskipped labels, not a broader
    resize). (f) "right-hand stack layout" — genuinely not done, still single-column
    `CollapsibleCard`s top to bottom; the real structural ask remaining from this whole item.
    (g) "current price input is full-width" — checked live: it's `width: 150`, not full-width;
    not reproduced, no action taken. (h) "colored stat cards" — done, see Done item 88 (already
    correctly noted as likely-resolved when this item was first written). **(f) done (2026-08-25)
    — see Done item 139**, closing this item and Pending item 57's identical ask in full.
57. ~~Side-by-side layout instead of vertical scrolling (2026-08-24, item 11 of the original
    screenshot batch: "We can show UI components side by side instead of scrolling to see one
    by one").~~ **Done for the per-stock page (2026-08-25) — see Done item 139, closing item 56's
    remainder too.** `PositionDetail.tsx` (QSE+PSX) now splits into a left stack (stat cards)
    and a right stack (charts + Price range) on wide viewports via a new `.position-split` CSS
    grid, collapsing to one column under 900px. **Still open**: Pending item 54's broader
    "utilize page space" ask was about *every* page, not just the per-stock one — this closes
    the one page with the clearest charts-vs-stats split; other pages (Dashboard, Portfolio,
    module landing pages) haven't been touched and would each need their own judgment call
    about what, if anything, belongs in a right rail.

**New Transfers-page feedback batch, remainder (2026-08-25) — see Done items 117-120 for
what's already shipped from this same message**:

58. ~~Card action buttons (Edit/Delete/Save/Cancel/Export/etc.) should consistently sit at the
    top-right corner of their card's header.~~ **Done (2026-08-25) — see Done items 121/132.**
    Every `CollapsibleCard` with a single stranded card-level action uses the `headerExtra`
    slot; `Tabs` itself gained the same slot per tab, closing the QSE/PSX Trades-tab and
    Rentals Income & expenses cases that needed it extended first. QSE's/PSX's PositionDetail
    "Export price history CSV" stays put on purpose — it's nested inside a native `<details>`
    *within* a `CollapsibleCard`, one level too deep for the outer card's header to correctly
    represent what it exports.
59. ~~Colored `<span>`/pill text-only backgrounds should become whole-card coloring instead.~~
    **Done (2026-08-25) — see Done item 122.** The actual bug wasn't a missing mechanism (both
    `StatCard`'s `hue` and `.pill-*` already existed and are correct) — it was roughly a dozen
    stat-cards stacking BOTH on the same element (a colored card with a redundant colored pill
    inside it), which read as "text has its own bg" even though `.pill` itself is the sanctioned
    mechanism. Fixed by making the card's own hue carry the sign and dropping the inner pill.
60. ~~Sidebar background/text contrast is reportedly still poor in some spots.~~ **Done
    (2026-08-25) — see Done item 123.** Investigated first, per this file's own standing
    practice, rather than guessing: computed real WCAG contrast ratios for the sidebar's nav
    text/active state across all 12 color themes × both light/dark — every single one already
    passed AA (4.97–16.11:1), and a pixel-level screenshot check of the Appearance/Category
    dropdown menus found their backgrounds correctly themed too. The actual bug was elsewhere:
    `color-scheme` was never set anywhere in the app, so every native browser control (a
    `<select>`'s own opened dropdown list chief among them) rendered in the browser's default
    LIGHT appearance regardless of the app's dark theme — exactly a "menu" whose bg/text
    contrast looks wrong, and it happens at literally every `<select>` in the app ("many
    places"), matching the report far better than the sidebar theory did.
61. ~~Rentals: semi-automated rent-collection cycles.~~ **Done (2026-08-25) — see Done item
    124.** Built as a genuinely separate mechanism from `generateLeaseRentPlans()` (Done item
    60), per this item's own note that it needed its own design pass rather than a bolt-on.
62. ~~"We may give the option to all entities to directly link the transfers on its page (per
    cycle, or regular, check feasibility)"~~ **Done (2026-08-25) — see Done items 125/131.**
    Built for QSE/PSX first, then Rentals/Personal Loans/Funds, each with its own "what does
    linking mean here" answer worked out. ~~EMI was the sole exception, blocked on having no
    repayment ledger to link into.~~ **Unblocked and done (2026-08-26) — see Done item 156.**
    EMI now works through the standalone Transfers page like every other linked module.
    ~~A native inline "Link this to a Bank account or Cash" shortcut... is not built for EMI
    specifically~~ **Done (2026-08-26) — see Done item 162.** The Schedule table's own
    inline pencil-editor (a different shape than a blank add-form, but still EMI's real
    "add a transaction" moment) now has the same checkbox, closing this item in full.

**2026-08-25, Net Worth page feedback batch — see Done item 148 for what shipped from this
same batch**:

63. "Cards in multiple columns (2 or 3 depending upon the amount of data) to avoid scrolling,
    rather than eating whole page width with blank spaces" (app-wide note attached to a Net
    Worth page report). Net Worth's own per-currency `<details>` cards now do this (Done item
    147, item 6) — a responsive `repeat(auto-fit, minmax(360px, 1fr))` grid instead of a
    single-column stack. Net Worth's own "Net worth summary"/"Exchange rates" pair (Done item
    153) and PSX Settings' "Fees & amounts" tab (Done item 159, 2026-08-26) followed the same
    pattern. **Still open**: a full app-wide audit — every other module's landing/Settings
    pages were checked in the Done item 159 pass and found to genuinely not fit (each card
    serves a different purpose in a form→list→Account shape, or there's only one small card
    to begin with) except PSX's, but that was one focused pass, not an exhaustive sweep of
    every page in the app — this is a real, repeatable pattern worth re-checking whenever a
    new page ships, not a one-time audit to close out.

**2026-08-26, second Net Worth feedback batch — see Done item 153 for what shipped from this
same batch**:

64. ~~"Add charts to view... worth difference by time" (item 4 of the same batch; the "capital
    split per currency" half of this item is done — see Done item 153).~~ **Done (2026-08-26)
    — see Done item 157.** Locked the three open design decisions this item named (cadence,
    storage, staleness) — an explicit on-demand "Save snapshot" button (never automatic), its
    own Firebase node kept separate from every module's workbook, and a snapshot that's a
    frozen point-in-time copy never rewritten by later backdated data — and built a real
    net-worth-over-time line chart on top, for the currently-selected preferred currency.

**2026-08-26, EMI stat-card feedback batch — see Done items 165/166 for what shipped**:

65. EMI/Loans "Overdue Balance / Penalties" — part of the user's own 3-zone stat-card request,
    explicitly deferred at the user's own choice (via AskUserQuestion) rather than built as a
    fake or inconsistent figure. This app has no missed-payment or late-payment tracking
    anywhere: every existing EMI figure (Outstanding, Paid so far, elapsed months) already
    assumes on-schedule payment regardless of whether a repayment was actually logged in the
    Repayment log. A real "Overdue" figure needs its own design pass — at minimum, deciding
    whether "overdue" means "past-due with no matching Repayment-log entry" (computable from
    existing data, but only meaningful for a user who logs repayments individually — someone
    who doesn't would see every past-due installment flagged overdue, a false positive) or
    something else. "Penalties" has no data model at all yet — not even a field to hold one.
    Not started; needs the user's own direction on what "overdue"/"penalty" should mean before
    any code, same bar this file always applies to a genuine design fork.

**2026-08-26, large cross-page UI/UX critique batch (screenshots of EMI/Net Worth/Banking) —
right after Done item 167 shipped the date-off-by-one fix + row-wrap CSS fix from the same
batch. Everything else below is tracked here per the user's own explicit "update docs and
list all these" instruction — genuinely too large for one sitting (dozens of items across
4+ pages plus several app-wide principles), so this is the full backlog, not a promise
everything below is started. Working down it in priority order across following sessions.**

66. ~~EMI: buttons (Save/Cancel on the edit-loan form, and elsewhere) should sit at the card's
    top-right corner, the same `headerExtra` pattern already used for single stranded actions
    elsewhere in the app (Done item 121).~~ **Done (2026-08-26) — see Done item 172.**
    Restructured onto `CollapsibleCard`'s `title`/`headerExtra` slots.
67. EMI: "Big EMI every N months" and "Link to bank" should be attached to the loan add/edit
    flow rather than living as separate always-visible cards on the loan-detail page. Real
    design question, not just a move: "Big EMI" needs a real schedule (with `elapsed` months
    known) to generate against, so it doesn't obviously fit an ADD-loan form for a
    brand-new loan with no elapsed history yet — plausibly this means "collapsed/tucked into
    an 'Advanced' section of the edit form" rather than literally living in the add-loan
    popup. Needs a concrete design before building, not guessed at.
68. ~~EMI: reorder the loan-detail page to Stats → Schedule → Charts → What-if.~~ **Done
    (2026-08-26) — see Done item 168.** The Amortization chart/What-if/Link-to-bank group
    moved together, right after Schedule, keeping their own relative order.
69. EMI Schedule table: reorder to `#, Due Date, Installment, (Net Paid + %), (Net Balance +
    %), Breakdown (Principal + %, Markup + %), Status, Actions` — Markup/Principal are
    "secondary info" per the user, should collapse into one "Breakdown" concept, and every
    money figure should show a percentage-of-total alongside it. Needs new percentage-of-total
    calc (paid/balance/principal/markup each as a % of `netToReturn`), not just a column
    reorder. Not started.
70. EMI: "Markup percentage" should also show the ANNUAL and MONTHLY equivalent, not just the
    one lifetime figure. Trivial for interest mode (rate IS annual; monthly = rate/12) — needs
    a real interpretation decision for fixedTotal mode first (a "monthly %" there most likely
    means markup-per-month ÷ principal, but that's an assumption, not confirmed with the user).
71. ~~EMI: add "Paid EMI count" to the Timeline zone (currently only "Remaining EMI count").~~
    **Done (2026-08-26) — see Done item 168.**
72. EMI: real charts showing loan history/progress — "multiple charts showing different
    matrix." The existing Amortization-schedule stacked-bar chart + What-if planner (Done item
    91) apparently reads as "no charts" to the user, either because it's positioned too far
    down the page to notice (ties into item 68's reorder) or because they want a genuinely
    different SET (e.g. balance-over-time line, paid-vs-remaining split) beyond the one
    existing chart. Needs the user's own confirmation of which before assuming scope.
73. Net Worth: daily snapshot should be automatic, not an on-demand button — this DIRECTLY
    REVERSES a previously locked design decision (Done item 157: "an explicit on-demand 'Save
    snapshot' button (never automatic)" was the user's own explicit choice at the time,
    specifically to avoid an accidental/unwanted history point). Per this file's own "recent
    instructions override older ones" rule, the newer ask wins — but flagging the reversal
    explicitly here rather than silently overwriting a previously-deliberate decision, per
    this file's own standing practice. A reasonable low-risk implementation: auto-save once
    per calendar day on page load if no snapshot exists yet for today (idempotent, no
    duplicate-spam risk) — not built yet, needs the "once per day, on page load" framing
    confirmed rather than assumed.
74. ~~Net Worth: the pairwise "Rates between your own currencies" table only shows one
    direction (A→B) — should show the reverse (B→A) alongside it.~~ **Done (2026-08-26) — see
    Done item 168.** `effectiveRate()` already derives either direction symmetrically, so this
    was purely a rendering change.
75. ~~Net Worth: "Net worth over time" chart should render AFTER the per-currency summary
    sections, not before them.~~ **Done (2026-08-26) — see Done item 169.**
76. Net Worth / app-wide: "Account Synced · [timestamp]" sync-status text is currently only
    shown inside a few modules' own "Account" sections, when cloud sync (and the account
    itself) is genuinely a cross-cutting, app-wide concept — should live in the sidebar/nav
    instead of being "buried in a few modules." A real structural change: today, sync status
    is computed per-module inside each page component (`syncStatus` prop threaded through
    from `App.tsx`'s per-module hooks), not as one unified app-wide value — needs a design
    decision on what "one synced/not-synced indicator for N independent per-module sync
    hooks" should actually mean (worst-of-N? most-recent? a per-module breakdown popover?)
    before it can move to the nav.
77. ~~App-wide: whole-app import/export through Settings.~~ **Done (2026-08-26) — see Done item
    177.** One combined JSON file, all 14 modules. **Still open**: every table exporting to
    Excel/HTML/PDF (only CSV/JSON exist today — see README item 40 for CSV, Done item 177 for
    whole-app JSON); this project's own "xlsx" dependency has a known unpatched advisory
    flagged at Done item 151, worth reconsidering before leaning on it further for EXPORT too.
78. Net Worth: add charts comparing the distribution of finances, both per-currency and within
    one selected currency (a "capital split by currency" doughnut already exists per Done item
    153 — this may be asking for more chart TYPES, e.g. a per-currency asset/liability
    breakdown, rather than none existing at all; needs clarifying which specific comparison is
    still missing).
79. ~~Net Worth: per-module contributions should render as small cards instead of long
    table-style rows.~~ **Done (2026-08-26) — see Done item 169.**
80. ~~Banking: the "Total balance (PKR)"/"(QAR)" stat-card labels read as if they're LIVE-
    CONVERTED figures.~~ **Done (2026-08-26) — see Done item 168.** Renamed to "Accounts in
    CODE" with an explanatory tooltip, a lighter-touch fix than the user's own literal
    "Pakistani Banks Total Balance" suggestion (which assumes currency implies country).
81. ~~Banking: "Add account" shouldn't be a permanently-visible form (same "rare operation"
    reasoning already applied to EMI's own add-loan form, Done item 166's floating-FAB
    pattern) — move to a floating "+" button + popup, mirroring EMI.~~ **Done (2026-08-26) —
    see Done item 170.**
82. ~~Banking: `BankAccount` should carry Branch and/or Account Type fields — new fields, not
    yet in the data model at all.~~ **Done (2026-08-26) — see Done item 170.**
83. Banking / app-wide: clicking a Bank account (or Cash, or a Personal Loan) row should
    navigate to that item's own detail page rather than opening a popup/modal in place —
    Banking's `AccountDetailModal` is a MODAL today, not a real routed page. A real
    architectural question: does "detail page" mean a genuine new route per account (like
    QSE/PSX's `/stock/:ticker`), or is the existing modal acceptable and just needs its
    CONTENTS reordered (see item 84)? The user's wording ("should take the user its details
    page") reads as wanting a real navigable page, not just a modal — but that's a bigger
    change than it sounds given Bank accounts don't currently have stable per-account routes
    at all.
84. Banking: `AccountDetailModal` currently shows the (rare) account-EDIT form prominently and
    has NO way to add a transaction from inside it at all — exactly backwards from what a user
    actually wants when clicking into an account. Real, concrete UX bug — the modal should
    lead with "add a transaction" (with its own FAB+popup per item 81's pattern, or at least a
    prominent inline form) and demote the edit-account-details form to a secondary/collapsed
    section. Not started.
85. Banking / app-wide: a transaction/repayment/entry conceptually belongs to its parent
    Account/Fund/Loan, so it should be logged and reviewed from THAT item's own detail
    page/view — not a separate page-level "add a transaction" flow disconnected from which
    account it's for. This is largely already true for EMI/Personal Loans/Rentals/Funds
    (their detail views already have their own transaction/repayment logs) — Banking is the
    clearest outlier (its own `AccountDetailModal` doesn't support adding one at all, see item
    84) and Cash has no per-"account" concept to attach to in the first place (Cash is a
    single ledger, not multiple accounts) — needs auditing per-module rather than assumed to
    be one uniform fix.
86. ~~App-wide: "Add a plan" (Cash/Banking's Planning-tab add-form) shouldn't be permanently
    visible either — same FAB+popup treatment as items 81/166.~~ **Done (2026-08-26) — see
    Done item 170.**
87. App-wide: the FinanceRecorder app logo isn't in the navbar/sidebar at all (only the text
    wordmark, per Done item 32's "FinanceRecorder" header) — needs an actual logo asset, which
    doesn't exist yet in this project (nothing to swap in without one being designed/sourced
    first).
88. QSE/PSX Dashboard: the new right-rail's Net worth and Upcoming-plans cards (Done item 164)
    are reported as visually CUTTING OFF/clipped — a real layout bug in the rail itself, not
    just a design preference, needs investigating (likely the `.rail-split`'s fixed 320px
    column being too narrow for some content, or a `MoneyValue`/pill overflowing its card).
    Also requested: the rail's money figures should show in the CURRENT STOCK EXCHANGE's own
    currency (QAR for QSE, PKR for PSX) rather than whatever `useNetWorthSummary()`'s
    biggest-exposure currency happens to be — and the rail itself should become a floating
    button + popup instead of a permanently-docked column (a bigger reversal of Done item
    164's own "docked right-rail" design, worth confirming intent before rebuilding it as a
    popup).
89. ~~App-wide: every tooltip-bearing label should carry a small visible icon.~~ **Done
    (2026-08-26) — see Done item 169.** Fixed once in `Tooltip.tsx` itself.
90. App-wide: "cards inside cards" — **re-audited (2026-08-26)**: checked every module's
    `Tabs`-driven tab content for the exact Done-item-114 bug (a single inner `Card` whose own
    heading duplicates its parent tab's label) — none found beyond the QSE/PSX Settings
    instance already fixed; every module's Settings tab has 2+ distinctly-headed sub-cards,
    every other single-content tab is a bare `<div>`. What's still open is the BROADER framing
    ("cards inside cards are terrible" as a general visual complaint, not just literal
    duplicate-heading text) — that's a more subjective design-judgment call (does a Card
    visually nested inside another Card's border/shadow look bad even with different headings?)
    that a code-level audit can't resolve alone; needs specific screenshot examples from the
    user of what still looks wrong, rather than guessing at a redesign.
91. App-wide: `StatCard`'s background is "still very vague" — try solid colors with a subtle
    shine/glassy effect instead. This directly follows up on Done item 153's "stat-card
    gradient softening" (16%→7% hue mix + a faint glass-sheen highlight) — the user is asking
    for the OPPOSITE direction now (more solid color, not softer) — worth confirming this is a
    genuine reversal of that recent tuning pass before re-touching the same CSS again, same
    "flag the reversal" practice as item 73.
92. App-wide: every table row / card representing a record that HAS a detail page should link
    to it (this is already true in most places — QSE/PSX Holdings→stock page, Personal
    Loans/EMI/Rentals/Funds list rows→their own detail view — Banking's account rows are the
    clearest current gap per item 83).
93. App-wide: "Plans" (the Cash/Banking Planning feature) should be part of the main nav/
    sub-nav, not buried inside each module's own tab set. A real navigation-structure
    decision: does this mean promoting Planning to its own `CategoryNav` entry (like
    "Transfers" already got, Done item 100), or just making it more visible within Cash/
    Banking's own existing nav? Needs the user's own preference before restructuring nav.
94. App-wide: "maximize space usage by using grids instead of infinite scrolling" — a broad
    principle in the same spirit as Pending item 54/63 (right-rail content, multi-column
    cards) — not a single scoped task, tracked here as a standing direction to apply
    opportunistically per-page rather than one big sweep.
95. App-wide: data import should be "a well-planned operation" with a documented/discoverable
    required file format and column-matching UI. This pattern ALREADY EXISTS for Bank/Cash/
    Rentals/Personal Loans' CSV imports (map-your-columns UI, Done items 40/41) and Funds'
    two import modes (Done items 146/151) — the gap is likely that none of these publish a
    clear "here's the expected format" reference a user can check BEFORE attempting an import
    (today they just have to try the mapper and see what happens), which is a real, addressable
    documentation/UX gap distinct from "build column-matching" (already built). Needs
    confirming which modules' import flows the user actually tried before assuming this is a
    universal gap vs. a discoverability one.
96. App-wide, reinforced instruction: autofill time/timezone/currency more aggressively.
    Time/timezone autofill already exists on every module's primary add-form (Done items
    133/135/136) and currency remembers the last pick (Done item 49) — this repeated ask
    likely means either a module this session hasn't confirmed yet, or a stronger ask (e.g.
    autofill the BROWSER's own current time as a live default, not just a remembered
    timezone) — needs a concrete "which field, which page" example from the user to act on
    precisely rather than re-guess at an already-addressed item.
97. App-wide, reinforced instruction: every remaining unlabeled input/form element. Done item
    167 fixed EMI's/Personal Loans'/Subscriptions' detail-page edit forms specifically
    (the confirmed-systemic gap found this session) — this is a repeated, broader ask that
    likely still has real remaining gaps elsewhere (e.g. table inline-add rows without a
    Field, which this session deliberately left alone as "already labeled by column header" —
    that reasoning may not hold for every such row, worth re-checking against a real
    screenshot rather than assumed correct everywhere).
98. ~~App-wide: "Compact" density should be noticeably MORE space-saving than "Comfortable".~~
    **Done (2026-08-26) — see Done item 173.** Buttons/inputs/selects were the real gap —
    completely untouched by Compact before this fix.
99. ~~Personal Loans: no analytics charts visible on a loan's own DETAIL page.~~ **Done
    (2026-08-26) — see Done item 172.** New `loanBalanceHistory()` + a "Balance over time"
    line chart on `LoanDetail`, between Repayments and the Payoff Planner. The landing page's
    own per-portfolio Analytics tab (Done item 45) is unaffected/unchanged.
100. ~~Personal Loans: the Payoff Planner should come AFTER Repayments on a loan's detail page
     (transactions are more important) — currently Payoff Planner renders above Repayments.~~
     **Done (2026-08-26) — see Done item 168.**
101. Transfers page: "terrible UI, arrange elements in grids for better UX" — a broad
     redesign ask without a specific target shape given; needs the user's own sense of what
     "better" looks like (a wireframe, or at least which specific elements feel wrong) before
     guessing at a full redesign.
102. ~~Transfers page: use info popups/tooltips to explain concepts instead of permanent
     explanatory paragraphs eating page space.~~ **Done (2026-08-26) — see Done item 169.**
     The "New linked transfer" card's own explanatory paragraph moved behind a `Tooltip`; the
     two conditional warning paragraphs (unsupported pairing, currency mismatch) were left as
     plain text since they're only shown when directly relevant, not a permanent block.
103. App-wide required-field marking rollout. `Field` gained a `required` prop (Done item 171)
     and it's applied to Banking's add-account form — every OTHER module's add/edit form across
     the app (Cash, Personal Loans, EMI, Rentals, Funds, Subscriptions, QSE/PSX trade forms,
     etc.) still needs the same audit: which fields are actually required (today only enforced
     via a toast-on-submit check, never visually marked) vs. genuinely optional, then the
     `required` prop applied per form. A real, bounded rollout — same shape as the `IconButton`/
     `CollapsibleCard`/`StatCard` hue rollouts before it — not a design decision, just needs
     doing form by form.
104. A second, real, keyless IBAN-lookup provider for `lib/ibanLookup.ts`'s `IBAN_PROVIDERS`
     chain (see Done item 171 for why only one was confidently wired in) — needs a specific
     provider confirmed to have a genuinely public, no-registration endpoint before adding, not
     a repeat of the same guessing risk. Also: the openiban.com success path itself is
     unverified in this sandbox (network blocked) — a future session with real browser access
     should confirm a real IBAN actually returns a real bank name before trusting this beyond
     the local-checksum unit tests.
105. ~~Credit card spend tracking, linked to a Bank account, so Net Worth counts it
     accurately.~~ **Done (2026-08-26) — see Done item 175.** A credit card is its own
     `BankAccount` with `isLiability: true`; Net Worth counts its debt separately from asset
     accounts. Also delivered in the same batch: card-network detection from a BIN, and a
     prefilled Pakistan/Qatar bank+wallet suggestion list.
106. ~~A cross-module "Budget Planner".~~ **Done (2026-08-26) — see Done item 176.** Unifies
     Cash/Bank/Rentals' existing planned entries into one view + a 3-month projection, with an
     add-plan shortcut writing into whichever module's own store is picked.
107. The user has a sample monthly-expense-tracker Excel sheet and wants the app to "show/
     answer all the capabilities just like this sheet is providing," on top of Net Worth being
     "capable to answer each finance's summary + user's worth in 3 months," with "detailed
     calculation" of financial activity over time available on request. The Budget Planner
     (Done item 176) and Net Worth's 3-month projection cover the general shape of this, but
     the specific capabilities the user's own real sheet demonstrates are unknown until it's
     actually attached — deliberately NOT guessed at, per this project's own established
     "work from the real file" lesson (see the Funds Daily History Import entry). Pick this up
     once the file arrives: import it into a scratch review, compare its actual columns/
     formulas/views against what's already built, and build only the concrete gaps that
     surface.

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
