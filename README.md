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
    QSE/PSX's Analytics page or Trade Planner. Largest item in this wave. Not started — see
    `MODULES_PLAN.md` §11 for a per-module chart/tool sketch.
24. New Subscriptions module — recurring payments (streaming, gym, etc.) linked to a paying
    entity (a Bank account or Cash), reusing the cross-entity linking mechanism from item 21
    once solid. Not started — see `MODULES_PLAN.md` §12.
25. Import pipeline: CSV/JSON import (browser-only, extends Banking's existing CSV-import
    pattern to more modules — no new infra) and PDF/image import (**locked decision: a
    separate Python backend service** for OCR/parsing, hosted on infrastructure the user
    chooses — real new infra outside a single coding session's control). Not started — see
    `MODULES_PLAN.md` §13.
26. "Only a toast shows instead of the sign-in popup" (see Done item 38) — investigated,
    couldn't reproduce locally (both primary sign-in entry points open the real modal
    correctly). Needs a specific page/button from the user to chase further if it recurs.
27. Editing (not deleting) a linked record directly in its native module (Cash/Bank/QSE/
    PSX/Rentals/Personal Loans) still doesn't propagate to the other side of the link or the
    link record itself (see Done item 35's "known remaining gap"). Deletion is now safe
    (cascades correctly from any entry point); editing amounts/dates only fully stays in sync
    when done from the Transfers page.

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
