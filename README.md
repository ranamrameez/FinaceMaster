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
17. Charts could get more interactive beyond the ticker/month filters shipped in Done item 31
    (e.g. click-to-drill-down, hover cross-highlighting between charts). Not started — the
    core "filterable" ask is done; this is a further-polish remainder, not a blocker.
19. Cross-entity transaction linking beyond v1 scope (see Done item 29): Funds/Rentals/EMI/
    Personal Loans aren't wired into the Transfers page yet — only Cash↔Bank and
    Bank↔QSE/PSX. A real signed-in browser round-trip (create/edit/delete a link, confirm
    both sides update) is also still needed — see item 29's verification note. **Expanded
    2026-08-23 into item 21 below** (genuine multi-currency amounts, more module pairs).

**New wave, 2026-08-23 (user-requested, full design detail in `MODULES_PLAN.md`'s "Next
wave" section)**:

21. Cross-entity linking remainder (see Done item 39): Personal Loans is now linked. Funds
    still needs its hidden `Transfer` field exposed in the UI first; EMI has no repayment
    ledger at all to link into (a data-model question). Neither of these is started.
22. Calculator button remainder: it's module-aware now (hidden outside Stock Exchanges, see
    Done item 32), but the longer-term goal — a *relevant* calculator per module (an EMI
    payoff calculator, a Cash quick-math tool, etc.) — needs those modules' own planning tools
    to exist first. Tracked together with item 23.
23. Per-module Analytics & Planning for Cash/Banking/Personal Loans/EMI-Loans/Funds/Rentals —
    each currently has just a ledger + basic totals, no charts or planning tools like
    QSE/PSX's Analytics page or Trade Planner. Largest item in this wave. **Cash and Personal
    Loans done (see Done items 44/45)**; Banking/EMI-Loans/Funds/Rentals still need it — see
    `MODULES_PLAN.md` §11 for a per-module chart/tool sketch.
24. New Subscriptions module — recurring payments (streaming, gym, etc.) linked to a paying
    entity (a Bank account or Cash), reusing the cross-entity linking mechanism from item 21
    once solid. Not started — see `MODULES_PLAN.md` §12.
25. Import pipeline: CSV/JSON import — **✅ done for Cash, Rentals, and Personal Loans (see
    Done items 40/41)**, browser-only, no new infra. PDF/image import still needs **a
    separate Python backend service** (locked decision) for OCR/parsing, hosted on
    infrastructure the user chooses — real new infra outside a single coding session's
    control. Not started — see `MODULES_PLAN.md` §13.
26. "Only a toast shows instead of the sign-in popup" (see Done item 38) — investigated,
    couldn't reproduce locally (both primary sign-in entry points open the real modal
    correctly). Needs a specific page/button from the user to chase further if it recurs.
27. Editing (not deleting) a linked record directly in its native module (Cash/Bank/QSE/
    PSX/Rentals/Personal Loans) still doesn't propagate to the other side of the link or the
    link record itself (see Done item 35's "known remaining gap"). Deletion is now safe
    (cascades correctly from any entry point); editing amounts/dates only fully stays in sync
    when done from the Transfers page.
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

36. Clicking an account (or the equivalent primary record in other modules) should open a
    detail view showing in-process, planned, and recent transactions together, plus an option
    to download a statement for a chosen period — requested across every module, not just
    Banking. Needs a design pass (what "detail view" and "statement export" mean per module
    differs) before building. Not started.
37. EMI/Loans: a link button to link a loan to a bank account and a payment date, generating a
    recurring plan (via the Planning feature) for the loan's remaining installments, with a
    possible calendar view of upcoming payments; EMI/Loans is also missing a displayed
    expected end date for a loan. Expands on item 21's EMI-linking gap with concrete UX.
    Needs a design pass (recurring-plan generation isn't something the Planning feature does
    today — it only creates one-off plans). Not started.
38. Rentals: auto-plan projected income/expenses for each billing cycle's start day directly
    from a property/lease's own details, and track security deposit info (cash, cheque, etc.)
    per property or tenancy. Needs a design pass (what "cycle" means — monthly? the lease's
    own recurrence? — and where deposit info lives in the data model). Not started.
39. A net-worth dashboard summarizing everything across every module, with collapsible
    per-currency sections. **The user also asked for a converted total at a live ("Google")
    exchange rate in the user's preferred currency — this directly conflicts with this
    project's own locked "no live FX-rate lookup, no live market-data API call" rule (see
    CLAUDE.md's Design decisions).** The rest of the dashboard (collapsible per-currency
    sections, no conversion) is buildable now; the live-rate conversion part needs to be
    raised with the user for an explicit decision before any code is written for it — do not
    silently build it (violates the locked rule) or silently drop it (wasn't asked to be
    dropped). Not started.

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
