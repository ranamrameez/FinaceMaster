# FinanceRecorder — notes for continuing this project

This file exists so a Claude Code session on *any* machine (the user works from
multiple PCs) can pick up full context immediately after `git clone` /
`git pull`, without re-deriving everything from scratch. Read this before
doing anything else in this repo.

## What this project is

`FinanceRecorder` is a React rewrite of `FinaceMaster` — a personal finance
tracker the user is turning into a public-facing multi-exchange, multi-asset
app. The **full end-state vision** (from the original README, and confirmed
directly by the user mid-project): stock tracking across **multiple
exchanges** (QSE, PSX, more later — needs an exchange selector), **mutual
funds tracking**, **bank transactions / card spending**, **cash management**,
and **rental property income tracking**. All of that is real scope, not
speculative — but only QSE is actually built so far. Design new architecture
to extend cleanly to the rest; don't build the rest speculatively.

**Standing instruction (added 2026-08-23, user-requested): always update
`README.md`'s Done/Pending sections for the latest developments and state**
whenever a feature lands, changes, or gets deferred — do this as part of
finishing the work, not as an afterthought. `README.md` is the project's
actual backlog/status doc; this file is continuity notes for an AI session
picking the project back up, not a substitute for it. Keep both current.

**Standing instruction (added 2026-08-23, user-requested): auto-commit and
push tested changes without asking first, and keep building the modules in
`MODULES_PLAN.md`'s suggested order without waiting for per-step
confirmation.** The user is this repo's sole owner (solo project, `main`
branch, no other collaborators) and explicitly asked to remove the
per-commit "should I push?" and per-module "should I start this?" checkpoints
that earlier sessions used. Still verify (tests, build, and browser-check
UI changes) before every commit — the removed friction is the human
confirmation step, not the quality bar. This does not extend to genuinely
destructive or undesigned actions (force-push, deleting real user data,
anything not already covered by a written plan) — use judgment and still
ask if something outside already-decided scope comes up. Also maintain a
**user manual** (`USER_MANUAL.md`, end-user facing — how to use the app,
not developer notes) continuously as features ship.

## Current status (as of 2026-08-23)

- **QSE module: feature-complete and polished.** Dashboard, Portfolio
  (Holdings/History tabs), per-stock dedicated pages (`/stock/:ticker`),
  Transactions (tabbed sub-sections), Watchlist, Analytics (18 charts in 4
  category tabs), Settings, sparklines, popup Trade Calculator, sign-in-gated
  writes, legal/disclaimer content. Live at the URL below.
- **QSE UI polish pass (2026-08-23):** fixed a user-reported punch list of 16
  UI/UX issues across the QSE module — sortable headers on every table (new
  shared `hooks/useSortableRows.tsx`), a real Current Price input + full
  prefill in the Trade Calculator, break-even color-coding, 5 new dashboard
  stat cards (all reusing already-computed `cashSummary()` fields, no new
  calc logic), Alerts moved to page bottom with a first-visit-per-session
  toast, smaller buttons with small inline SVG icons (new
  `components/icons.tsx` — no icon library dependency), the `Field`/
  `TextInput` components wired into the Trade Calculator and Settings forms,
  several `.row > * { flex:1 }` layout bugs (modal close button and the
  settings avatar rendering as ellipses instead of circles), and a sign-in
  success toast. Also found and fixed a real timing bug: `App.tsx` applied
  `data-theme`/`data-color`/etc to `<html>` inside a `useEffect`, which runs
  *after* child components (including chart-bearing pages) mount and read
  those CSS vars — charts could paint with the wrong theme's colors on first
  load and never update on live theme switches since Dashboard/Analytics
  weren't subscribed to appearance state. Fixed by applying the attributes
  synchronously during `App`'s render and subscribing chart-bearing pages
  to `useAppearanceStore`.
- **QSE UI polish, round 2 (2026-08-23, same day):** the user re-tested live
  and reported the chart-label fix above didn't visibly help, plus new
  issues: `.footer-note`'s base CSS class used to bake in
  `margin-top/border-top/padding-top` unconditionally, which is wrong for
  the *majority* of its ~18 usages (it's mostly used as a plain "small muted
  text" utility — inline ticker/company-name spans, empty-state `<p>`s — not
  a footer divider); simplified the class to just color+font-size and moved
  spacing to the one place (Sidebar) that actually wants it. `dlBase()` in
  `lib/chartLabels.ts` switched from a translucent `--panel + alpha-suffix`
  datalabel-box background to a **solid** `--panel-2` — alpha-blending a
  light color over a dark bar/line segment underneath can still composite
  dark/muddy, a second plausible cause of the "black box, invisible text"
  report on top of the timing bug already fixed; also added
  `chartSetup.ts`'s new `applyChartTheme()` (sets `ChartJS.defaults.color`/
  `borderColor`, since Chart.js's own legend/tick/tooltip text otherwise
  defaults to a fixed gray, not a themed color), called from every
  chart-bearing page. **Still not visually confirmed** — this dev
  environment's browser pane has a **0×0 viewport** when not actively
  displayed (`window.innerWidth`/`innerHeight` read `0`), which breaks not
  just screenshots/canvas pixel reads but *all* `getBoundingClientRect()`
  layout geometry too — so any future session hitting the same "still
  broken" report on this should treat it as genuinely unverified, not
  re-confirmed, and either get a real screenshot from the user or find an
  environment where the pane actually composites. Also: the Dashboard
  Holdings preview table (`HoldingsCard` in `DashboardPage.tsx`) now
  duplicates the Avg Cost/Break-even calculation from `PortfolioPage.tsx`'s
  `OpenPositionsTable` rather than sharing it — if that logic changes,
  update both.
- **PSX module: UI built and live, mirroring QSE (2026-08-23).** Full page
  set under `webapp/src/features/psx/` — Dashboard, Portfolio
  (Holdings/History), per-stock pages (`/psx/stock/:ticker`), Transactions
  (tabbed sub-sections incl. Dividends), Watchlist, Analytics (4 category
  tabs, same chart set as QSE minus Fundamentals — see below), Settings
  (Account/Data/Fees & CGT). Nav has a "Stocks" exchange switcher
  (`components/Sidebar.tsx`'s `ExchangeSwitcher`) with QSE/PSX chips; which
  exchange is "current" is derived from the route (`/psx/*` vs everything
  else), not stored separately. The floating Trade Calculator button
  (`components/CalculatorLauncher.tsx`, moved out of `features/qse/` and
  now route-aware) shows the QSE or PSX calculator depending on path. Both
  QSE's and PSX's Firebase syncs run unconditionally in `App.tsx` (not just
  while their routes are active), same pattern the sidebar/datalists follow.
  PSX ticker names/sectors are a static bundled seed
  (`lib/stockData/psxSeed.ts`, ported from the legacy `js/psx-symbols.json`,
  121 symbols) — unlike QSE there's no shared Firebase `stockData/PSX` node
  yet, so `usePSXStockData` doesn't attempt a fetch at all (see that file's
  comment if adding one later).
  - **README items 5/6/7 (CGT filer/non-filer, same-day fee netting) are
    now both *computed* (already true before today, in `psxFees.ts`) and
    *visible in the UI*.** The Transactions list and per-stock transaction
    list show a Fee column with a "(netted)" tag on the smaller leg of a
    detected same-day round trip (via `sameDayChargedSide`); PositionDetail
    and the PSX TradeCalculator both show an "Est. CGT if sold now" /
    "Est. CGT" stat using `calcCGT` + the Settings-configured filer status.
    New test coverage: `webapp/src/lib/calc/__tests__/psxFees.test.ts`
    (synthetic hand-traced cases) plus a real-fixture sanity pass over
    `fixtures/psx-workbook-backup.json` (copy of the repo-root PSX backup —
    see Data safety below, same caveat about not overwriting it casually).
  - **Manual same-day-trade override checkbox (README item 7, 2026-08-23):**
    added `Transaction.manualSameDay?: boolean` (`webapp/src/types/workbook.ts`,
    shared type but PSX-only in effect — QSE ignores it) and `isNettedLeg()`
    in `psxFees.ts`, the single source of truth for whether a leg is netted
    (checks the manual flag first, then falls back to the existing
    date-based `sameDayChargedSide` auto-detection). Wired into the
    add-transaction form and both edit-row forms (Transactions page and
    per-stock `StockPage.tsx`) as a "Same-day override" checkbox, and into
    the "(netted)" tag display (shows ", manual" when the override, not
    auto-detection, is why). New tests in `psxFees.test.ts` cover the
    override forcing netted treatment even when dates don't line up.
  - **Trade Planner (README item 9, 2026-08-23):** `TradePlan`/`TradePlanLeg`
    types added to `types/workbook.ts`, and `tradePlans: TradePlan[]` added
    to `BaseWorkbook` (`store/createWorkbookStore.ts`) plus both `Workbook`
    and `PSXWorkbook` — deliberately exchange-agnostic (both `createEmpty*`
    functions seed `tradePlans: []`), with generic store actions
    (`addTradePlan`/`updateTradePlan`/`deleteTradePlan`/
    `executeTradePlanLeg`) added right in the shared factory. Only PSX has
    a page for it so far (`features/psx/pages/TradePlannerPage.tsx`, route
    `/psx/trade-planner`, nav item added to `PSX_NAV_ITEMS` in
    `Sidebar.tsx`): create a named multi-leg plan, edit the plan's name/
    notes or any individual leg in place, and "Mark done" a leg to convert
    it into a real `Transaction` (via `executeTradePlanLeg`) without
    retyping it into the Transactions tab — the leg itself stays in the
    plan (flagged `executed`) as a record, independent of the transaction
    it created. QSE gets this for free at the type/store level whenever it
    gets its own page — that's intentionally left undone until asked for,
    per this file's "don't build the rest speculatively" guidance.
  - **Per-transaction fee override + FIFO lot matching (README items 11/8,
    2026-08-23):** `Transaction.feeOverride?: number` (shared type) lets a
    transaction's total fee be set manually — checked first thing in both
    `makeQSEFeeCalculator` (`lib/calc/fees.ts`) and `makePSXFeeCalculator`
    (`lib/calc/psxFees.ts`), winning outright over the normal formula and
    over same-day netting. UI: a "Fee override" input alongside the
    "Same-day override" checkbox in the PSX add-row and both edit-row forms
    (Transactions page, per-stock `StockPage.tsx`); Fee column shows
    "(override)" when set. It's a single total-fee override, not a fully
    itemized per-line-item editor — a possible future refinement, not done
    now. Separately, `lib/calc/fifoPositions.ts`'s `computeFIFOPositions`
    implements FIFO lot matching (each buy its own lot, oldest sold first)
    as an **opt-in** alternative to `computePositions`'s weighted-average —
    `PSXSettings.costBasisMethod: 'average' | 'fifo'`, defaulting to
    `'average'` (today's unchanged behavior) and switchable in PSX Settings
    → "Fees & amounts". `usePSXDerived.ts` branches positions/
    `realizedSeries` on this setting and also exposes `lots` (open FIFO
    lots per ticker) for `PositionDetail`'s new "Open lots" table.
    `cashSummary()` was refactored to take `positions` as an optional
    parameter (default: computes weighted-average itself, so QSE's call
    site and both `cashSummary` test call sites are unchanged) instead of
    always recomputing internally, specifically so PSX could pass its
    FIFO-computed positions through without a duplicate cashSummary. QSE is
    completely untouched by any of this — `computePositions` itself was
    never modified, only added-to; this was a deliberate safety choice
    since switching a real user's cost-basis method retroactively
    recomputes their entire historical P/L (nothing here is stored
    per-entry, everything is derived live from full transaction history on
    every load) and must never happen silently.
  - **First-time Terms/Disclaimer gate + app branding (README items 15/16,
    2026-08-23):** `components/TermsGateModal.tsx` + `store/termsStore.ts`
    (own localStorage key, same shape as `appearanceStore` — global, not
    per-account) blocks the whole app behind a condensed risk/liability
    disclaimer + explicit accept checkbox for every first-time visitor,
    signed in or not. Mounted at the `App.tsx` root with `zIndex: 1000` —
    **this had to be higher than the shared `.modal-overlay`'s z-index
    (100) and the floating Calculator button's `zIndex: 500`**, or the
    Calculator button would render (and be clickable) right through the
    gate, defeating it; verified this in the browser by clicking the
    button's coordinates while the gate was up and confirming nothing
    opened. Also added a "FinanceRecorder" header at the top of
    `Sidebar.tsx` and a "© {year} FinanceRecorder" line at the bottom — the
    app previously had its name in the browser tab title only, nowhere in
    the UI itself.
  - **New-modules sequencing — building now (updated 2026-08-23):** the
    original "wait until Stock Exchanges is finished" gate was lifted the
    same day by explicit user instruction ("start working on modules as
    per your recommendation without needing my consent") — QSE+PSX are
    considered finished enough for v1, and module work is now underway
    following `MODULES_PLAN.md`'s suggested build order (Cash → Personal
    Loans → Banking → EMI/Loans → Funds → Rentals) without per-module
    check-ins. Check this file's own "Current status" section (kept
    up to date) for which modules actually exist so far, since this note
    may lag reality in a fast future session — don't rely on this line
    alone to know what's built. **The proposed-features/architecture plan
    for these modules is written: see `MODULES_PLAN.md` at the repo root**
    — read that file, not just this one, before touching any of them.
    Two modules (EMI/Loans, Personal Loans) were added to the
    original four after reviewing a user-supplied reference prototype kept
    at `reference/finance-suite-prototype/` (external project, different
    tech stack — React Native/Expo/SQLite — treat its calc functions as
    algorithm reference to port, not code to import, per that folder's own
    `NOTE.md`). That review also produced three cross-cutting requirements
    now locked into `MODULES_PLAN.md` for every new module: every record
    type must be editable in place (not add/delete-only — the reference
    prototype itself lacks this everywhere), category fields must be
    free-form/user-definable (not a fixed enum — the reference prototype's
    `EXPENSE_CATEGORIES` is hardcoded), and currency should be tracked
    per-entity rather than per-module, with aggregates grouped by currency
    rather than converted (no live FX-rate source).
  - **Edit capability added to Transfers/Adjustments/Dividends/Watchlist
    (2026-08-23):** these were add/delete-only in both QSE and PSX — the
    exact gap flagged as unacceptable for new modules above, so it got
    fixed in the existing ones too. New `updateTransfer`/`updateAdjustment`/
    `updateDividend`/`updateWatchlistItem` actions added to the shared
    `createWorkbookStore.ts` (same pattern as the pre-existing
    `updateTransaction`); Transfers/Adjustments/Dividends got the same
    inline edit-row UX already used for Transactions (`editIndex`/`editRow`
    state, Edit/Save/Cancel buttons); Watchlist got always-editable Target/
    Current inputs directly in the table cells (no edit-mode toggle needed
    — they're independent numeric fields) since `WatchlistItem`'s `ticker`
    is the record's key and isn't meant to be renamed in place (remove +
    re-add covers that case). Verified live in the browser: edited a
    transfer's fee (10 → 15, persisted, "(Transfer updated.)" toast) and a
    watchlist target price (persisted to localStorage), no console errors.
  - **Cash module built (2026-08-23) — first new module, per
    `MODULES_PLAN.md`'s build order.** Real architecture addition, not just
    UI: `store/createEntryStore.ts` is a new sibling factory to
    `createWorkbookStore`, generic over `BaseEntryWorkbook<TSettings,
    TEntry> = { settings, entries }` — built because Cash's shape (one
    array of dated entries, no transactions/transfers/watchlist/etc.)
    doesn't genuinely fit the stock-exchange-specific `BaseWorkbook`, and
    forcing it through would mean carrying a pile of irrelevant empty
    arrays just to satisfy the type. `useWorkbookCloudSync`
    (`lib/firebase/useWorkbookCloudSync.ts`) had its generic constraint
    relaxed from the full `WorkbookStoreState<TWorkbook>` to a new minimal
    `MinimalWorkbookStore<TWorkbook> = { workbook, setWorkbook }` — the hook
    body only ever touched those two members at runtime anyway (verified by
    reading it), so both factories' stores now share the exact same
    cloud-sync safety logic (never-write-on-assumed-emptiness, the
    debounced-push-after-initial-pull guard, etc.) via one implementation,
    with zero behavior change for QSE/PSX (confirmed via `npm run build`
    passing unchanged before writing any Cash code). Files: `types/
    cashWorkbook.ts`, `store/{createEntryStore,defaultCashWorkbook,
    cashWorkbookStore}.ts`, `lib/firebase/useCashFirebaseSync.ts`,
    `lib/calc/cashModule.ts` (+ `__tests__/cashModule.test.ts`),
    `features/cash/pages/CashPage.tsx`, route `/cash` in `App.tsx`. Nav is
    a minimal "More → Cash" section in `Sidebar.tsx` for now — a real
    placeholder, not the category-dropdown redesign (item 18, still
    pending). New `lib/currencies.ts` (`CURRENCIES`/`currencySymbol`) for
    the per-entity currency picker — QSE/PSX keep their own free-text
    currency setting (one currency per trading account, chosen once) and
    weren't touched. Verified live in the browser: sign-in gate on add,
    edit recalculates balances/category totals correctly, multi-currency
    entries (tested USD + PKR together) stay properly separated with no
    fake conversion, no console errors. `MODULES_PLAN.md` §1 has the full
    writeup; next up per the build order was Personal Loans (now also
    built — see below).
  - **Personal Loans module built (2026-08-23) — second new module.**
    Two related arrays (`loans` + `repayments`), so it doesn't fit
    `createEntryStore`'s single-array shape either — hand-written in
    `store/personalLoansWorkbookStore.ts` following the same idiom
    (mutate/persist/localStorage, `{workbook, setWorkbook}` satisfying
    `MinimalWorkbookStore`) rather than adding a third generic factory.
    Files: `types/personalLoansWorkbook.ts`, `store/
    {personalLoansWorkbookStore,defaultPersonalLoansWorkbook}.ts`,
    `lib/firebase/usePersonalLoansFirebaseSync.ts`,
    `lib/calc/personalLoansModule.ts` (+ tests),
    `features/personalLoans/pages/PersonalLoansPage.tsx`, route
    `/personal-loans`, nav under "More" in `Sidebar.tsx`.
    **A real bug was hit and fixed here, worth remembering for any future
    module**: `RepaymentsSection` originally selected
    `(s) => s.workbook.repayments.filter((r) => r.loanId === loan.id)` —
    filtering *inside* the zustand selector callback returns a new array
    reference on every call, which `useSyncExternalStore` (zustand's hook
    is built on it) reads as "the store changed," causing a genuine
    infinite-render loop (`Maximum update depth exceeded` / "getSnapshot
    should be cached"). Fixed by selecting the raw `s.workbook.repayments`
    array and filtering it in a separate `useMemo([allRepayments,
    loan.id])` instead. **Rule for any future module's zustand selectors:
    select raw state, derive with `useMemo`, never inside the selector.**
    Debugging note for future sessions: this bug was initially very hard
    to pin down because a long-lived dev tab that had gone through many
    hot-reloads during the fix kept showing the stale error even after the
    fix was confirmed correct in the served source (checked via fetching
    the transformed module directly) — a brand new browser tab with a
    hard reload was what finally confirmed the fix actually worked. If a
    "phantom" error persists suspiciously after a code fix looks correct,
    try a fresh tab before assuming the fix is wrong.
  - **Banking module built (2026-08-23) — third new module.** Third
    distinct store shape (accounts nested under `settings`, plus a
    top-level `transactions` array) — hand-written in
    `store/bankWorkbookStore.ts` following the same idiom as Cash/Personal
    Loans. CSV statement import was built as specified, not deferred: a
    small dependency-free parser (`lib/csv.ts` — quoted fields, escaped
    `""` quotes, CRLF, blank-line skipping, all tested) plus a "map these
    columns" UI in `features/bank/pages/BankPage.tsx`'s Import tab (auto-
    picks the first 3 detected headers as a starting guess for Date/
    Description/Amount, user can remap any of them, optional "flip sign"
    for banks that export spending as positive numbers, 5-row preview
    before committing). `lib/calc/bankModule.ts` has running balance
    (`accountRunningLedger`), per-account balance, per-currency totals
    (`totalBalanceByCurrency`), and category breakdown — all tested. Files:
    `types/bankWorkbook.ts`, `store/{bankWorkbookStore,
    defaultBankWorkbook}.ts`, `lib/firebase/useBankFirebaseSync.ts`, route
    `/bank`, nav under "More". Checked every zustand selector in the new
    file against the §6 rule (raw state only, derive in `useMemo`) before
    shipping — none of them repeat the Personal Loans bug. Verified live in
    the browser (fresh tab): sign-in gate on both add-transaction and
    import, a synthetic 3-column CSV parsed and auto-mapped correctly with
    accurate preview amounts, account/transaction edits recalculated
    balances correctly, no console errors.
  - **EMI/Loans module built (2026-08-23) — fourth new module.** Only one
    array (`entries: EMILoan[]` — a computed amortization schedule, not a
    logged repayments history), so this one genuinely reuses
    `createEntryStore` (same factory as Cash) rather than a hand-written
    store — the data model's field is named `entries`, not `loans`,
    specifically so it fits that factory's shape. `lib/calc/emiModule.ts`
    (`emiSchedule`/`emiSummary`) ports the reference prototype's formulas
    for both repayment modes (reducing-balance interest, and fixed-total-
    to-return for no-interest/Sharia loans, straight-line no compounding)
    — hand-traced in tests including a 0%-rate edge case and elapsed-time
    clamping once fully repaid. Files: `types/emiWorkbook.ts`, `store/
    {emiWorkbookStore,defaultEmiWorkbook}.ts`, `lib/firebase/
    useEMIFirebaseSync.ts`, `features/emi/pages/EMIPage.tsx`, route
    `/emi-loans`, nav under "More". Every selector checked against the §6
    rule before shipping (paid off — no bug this time, unlike Personal
    Loans). Verified live in a fresh browser tab: sign-in gate on add,
    schedule/summary stats matched hand-calculated expectations for both a
    mortgage and a no-interest loan, edit recalculates immediately, delete
    confirms and removes correctly, no console errors.
  - **Funds module built (2026-08-23) — fifth new module, and the one
    that genuinely reuses the full `createWorkbookStore` factory** (not
    `createEntryStore`, not hand-written) — unlike Cash/Personal Loans/
    Banking/EMI, Funds' shape (buy/sell units at a NAV) maps onto
    QSE/PSX's exact `Transaction` shape (`Fund.id` plays `ticker`, units
    play `shares`, NAV plays `price`), so `computePositions`/`cashSummary`/
    `computeRealizedPLTimeSeries`/`marketPrices`/`priceHistory`/
    `getMarketPrice` all work with **zero changes to any shared calc
    file** — confirmed by not touching `lib/calc/positions.ts`,
    `cashSummary.ts`, `realizedPL.ts`, or `priceHistory.ts` at all during
    this build. `FundsWorkbook extends BaseWorkbook<FundsSettings>` plus
    its own `funds: Fund[]`; since the factory has no action for that
    extra field, Fund CRUD (add/update/delete a *Fund*, as opposed to a
    *Transaction*) goes through the store's already-generic `setWorkbook`
    directly in `features/funds/pages/FundsPage.tsx` rather than adding a
    new store action. `transfers`/`watchlist`/`dividends`/`tradePlans`
    inherited from `BaseWorkbook` are unused (documented in
    `types/fundsWorkbook.ts`'s own comment) — an accepted tradeoff for
    genuine factory reuse over a parallel type. No fee model (`calcFee` is
    a no-op — NAV is already net of fund fees). New `lib/calc/xirr.ts`
    (Newton-Raphson + bisection fallback, ported from the reference
    prototype) — tested against an exact-10%-one-year-return case, a
    multi-flow case, and null-for-same-sign-flows. Files: `types/
    fundsWorkbook.ts`, `store/{fundsWorkbookStore,defaultFundsWorkbook}.ts`,
    `lib/firebase/useFundsFirebaseSync.ts`,
    `features/funds/hooks/useFundsDerived.ts`,
    `features/funds/pages/FundsPage.tsx`, route `/funds`, nav under "More".
    Verified live in a fresh browser tab against the reference prototype's
    own worked example (two buys totaling $7000 invested, NAV rising to
    $214): position rollup/value/P&L%/XIRR all matched; NAV update and
    transaction edits recalculate everything live; sign-in gate fires on
    both fund-add and NAV-update; no console errors.
  - **Rentals module built (2026-08-23) — sixth and FINAL planned new
    module. All six modules from `MODULES_PLAN.md` are now built:**
    Cash, Personal Loans, Banking, EMI/Loans, Funds, Rentals. Rentals has
    the same shape as Banking (`settings.properties` + top-level
    `entries`) so `store/rentalsWorkbookStore.ts` is hand-written following
    the identical idiom as `bankWorkbookStore.ts`. `lib/calc/
    rentalsModule.ts` has per-property net income, per-currency portfolio
    totals, category breakdown, monthly rollup — all tested. Files:
    `types/rentalsWorkbook.ts`, `store/{rentalsWorkbookStore,
    defaultRentalsWorkbook}.ts`, `lib/firebase/useRentalsFirebaseSync.ts`,
    `features/rentals/pages/RentalsPage.tsx`, route `/rentals`, nav under
    "More". Verified live in a fresh browser tab: net income/category/
    monthly-rollup all correct against hand-traced numbers, property/entry
    edits recalculate live, sign-in gates fire on both property-add and
    entry-add, no console errors.
    **What's next for a future session**: `MODULES_PLAN.md`'s own
    six-module scope is complete. The user was asked what to build next
    (2026-08-23) and said to keep going module-by-module without asking
    again unless something is critical — so no more per-item check-ins
    are needed here.
  - **Sidebar category dropdown built (2026-08-23) — README item 18.** New
    `components/CategoryNav.tsx` replaces the old flat "Stocks" heading +
    "More" link list with one dropdown spanning every module (Stock
    Exchanges, Funds, Banking, Cash, Personal Loans, EMI/Loans, Rentals),
    highlighting the active category (derived from the route via
    `categoryForPath`, not stored separately — same pattern as the
    existing QSE/PSX `ExchangeSwitcher`). `Sidebar.tsx` only renders the
    QSE/PSX chip switcher + that exchange's page nav underneath the
    dropdown when the active category is `'stocks'`; every other category
    is a single page (its own internal tabs, not sidebar sub-nav), so
    picking it just navigates straight there. Follows the same
    `position:fixed`-with-no-explicit-offsets popover pattern already
    used by `AppearancePanel.tsx` (see that component's CSS comment in
    `theme.css` for why: it escapes the sidebar's `overflow:auto`
    clipping while staying visually anchored where it'd sit in normal
    flow) — new CSS is `.category-*` in `theme.css`, kept separate from
    `.appearance-*` rather than shared, since they're two independent
    trigger/panel pairs both rendered on every page.
    **Verified via a scripted Playwright pass, not manual browser
    testing** — same 0×0-viewport dev-pane limitation noted earlier in
    this file meant a real interactive check wasn't possible, so a
    throwaway Playwright script (chromium at `/opt/pw-browsers/chromium`,
    the `playwright` package resolved from the global npm root since it
    isn't a project dependency) drove the dev server directly: confirmed
    the dropdown opens, lists all 7 categories, navigates on click,
    highlights the active one with a checkmark, and that returning to
    "Stock Exchanges" restores the QSE/PSX chips and page nav — with zero
    console errors. `npm run build` and `npm run test` (76 tests) both
    pass unchanged. Treat this as a real (if narrower) verification, not
    the "still unverified" caveat attached to the earlier chart-theming
    fix — Playwright's own headless viewport isn't subject to that 0×0
    dev-pane bug.
  - **Cross-entity transaction linking, v1 scope built (2026-08-23) —
    README item 19 / MODULES_PLAN.md §7.** Before starting this, asked the
    user how to proceed on a real blocker (see AskUserQuestion in this
    session): `Transfer` (QSE/PSX) and `CashEntry` had no stable `id`,
    only array-index addressing — exactly the two record types v1 linking
    (Cash↔Bank, Bank↔QSE/PSX cash) needs to reference. User chose
    "retrofit ids first, then build linking." Did that: added
    `id: string` to both types; `createWorkbookStore.ts` and
    `createEntryStore.ts` now normalize any entry/transfer missing an id
    on every path data enters the store (local load *and* `setWorkbook`,
    which also covers the Firebase pull in `useWorkbookCloudSync`) so
    real user data written before today — which has no `id` in storage —
    keeps working without a manual migration step. `updateTransfer`/
    `deleteTransfer` and `createEntryStore`'s `updateEntry`/`deleteEntry`
    switched from index- to id-based addressing (`BankTransaction`/
    `EMILoan` already had ids, so Bank/EMI's data model didn't change).
    Left `Transaction`/`Adjustment`/`Dividend` on QSE/PSX index-based on
    purpose — linking only ever touches Transfers, not trades, so adding
    ids there would be unused surface area.
    New pure `lib/interEntityLink.ts` (`buildLinkedRecords`,
    `isSupportedLinkPair`) computes both side records + the link record
    from user input with zero store access — reused unchanged for both
    create and edit (edit just recomputes with the same three ids) —
    tested in `lib/__tests__/interEntityLink.test.ts`. The link records
    live in a new `interEntityTransfersStore.ts` (reuses
    `createEntryStore`, own Firebase path
    `users/{uid}/interEntityTransfers`). New "Transfers" category/page
    (`features/transfers/pages/TransferLinksPage.tsx`,
    `components/CategoryNav.tsx` gained an 8th entry) — picking two
    module sides, an amount, and a date creates one record on each side;
    editing or deleting the link updates or removes both. No currency
    conversion (locked cross-cutting decision, no live FX source) — the
    form resolves and shows each side's currency and warns on mismatch
    rather than blocking it.
    **Verification is narrower than usual, on purpose**: no real
    Firebase Auth account was used to test the actual signed-in write
    path, because the app's Firebase project (`qse-app`, in
    `lib/firebase/client.ts`) is the user's real production project —
    creating even a throwaway test account against it felt like the
    wrong kind of shortcut given how hard this file's cloud-sync-safety
    rules already lean against casual writes, so a future session with
    the user actually signed in should click through one real linked
    transfer (create, edit the amount, delete it) and confirm both sides
    update before trusting this beyond the unit tests. What *was*
    verified live in the browser: the Transfers page renders with no
    console errors, the unsupported-pair warning, the currency-mismatch
    warning, and the missing-bank-account guard all fire correctly for
    the inputs that should trigger them. `npm run build` and
    `npm run test` (84 tests, 8 new) both clean.
    **Still open next**: Funds/Rentals/EMI/Personal Loans aren't wired
    into linking yet (README item 19 in Pending now tracks just this
    remainder); statement PDF/Excel import (item 12) and dynamic/
    filterable charts (item 17) are the other open Pending items. Keep
    working down the README's Pending list per the user's standing
    instruction; ask first only for something genuinely ambiguous or
    destructive, same bar as before.
  - **Doc-only correction (2026-08-23): README item 14 (console-style
    compact theme) was already implemented** — the `data-density="console"`
    CSS rules in `theme.css` and the density selector's "Console (super
    compact)" option date back to the very first React-rewrite commit
    (`git log -S` confirms), not to anything built today. It had just
    never been moved out of Pending. Re-verified live (switching density
    visibly shrinks cards/tables/titles, no console errors) and moved to
    Done in README with no code change. If a future session finds another
    Pending item that looks suspiciously already-built, check git history
    before assuming it needs work — this file and the README can drift
    out of sync with what's actually shipped.
  - **Dynamic/filterable Analytics charts built (2026-08-23) — README item
    17, ticker + month-range filters for QSE and PSX.** New
    `components/ChartFilterBar.tsx` (ticker toggle-chips + a from/to
    `<input type="month">` pair) sits at the top of both Analytics pages.
    Deliberately does **not** re-derive positions/cost-basis/P&L for a
    filtered window — that would change what "current holdings" means
    (a stock bought years ago and still held would look like "no
    position" under a last-3-months filter) — so `lib/calc/
    chartFilters.ts`'s pure helpers instead post-process the *already-
    computed* per-ticker rows and per-month series each chart already
    consumed (`filterRowsByTicker`, `filterTuplesByTicker`,
    `filterMonthlySeries`, `filterMonthlyDualSeries` — tested in
    `chartFilters.test.ts`). Both `AnalyticsPage.tsx` files apply the same
    filter object to `useChartData()`'s output and to `useQSEDerived()`/
    `usePSXDerived()`'s `rows`, memoized separately per array — the
    hooks themselves are untouched, so Dashboard/Portfolio/other callers
    of the same hooks are unaffected. Whole-portfolio single-number charts
    (realized vs unrealized P/L, cash vs stocks, fees breakdown, deposits
    vs invested, and the cumulative cash-balance line) are intentionally
    left unfiltered — the filter bar's own copy explains why. The
    README item also named "category" as a filter dimension; that doesn't
    apply here since QSE/PSX trades have no category field (that belongs
    to Cash/Bank/Rentals, none of which have chart/Analytics pages yet) —
    noted as an explicit scope decision in the README, not silently
    dropped. **Verified live in the browser** with a seeded two-ticker,
    three-month workbook (`localStorage` pre-seeded via
    `page.addInitScript`, no sign-in needed since this only reads local
    state): ticker chips correctly narrow every per-ticker chart plus the
    Fundamentals table; the month-range picker correctly collapsed
    "Monthly trading activity" and "Dividend income by month" to just the
    selected month, while "Dividend income by ticker" (a lifetime total,
    not month-indexed) correctly stayed unaffected by the month filter —
    exactly the intended semantics. Zero console errors. `npm run build`
    and `npm run test` (95 tests, 11 new) both clean.
  - **Not yet restructured**: routes are still flat (`/psx/...` bolted on
    alongside QSE's root-level routes), not the `/stocks/:exchange/...`
    shape mentioned below — flat was lower-risk to add without touching
    QSE's existing (bookmarked, tested) routes. Revisit if/when mutual
    funds/banking/cash/property modules actually get built, since that's
    the point where a real shared-shell route structure starts paying off.
- **Legacy static apps** (`index.html` = QSE, `PSX_Trade_Planner.html`,
  `Risk_Analysis_Calculator.html`) still live unchanged at the repo root and
  still deploy — **do not delete these** until PSX reaches parity and the
  user explicitly approves a cutover. The Sidebar's legacy-link list now
  only links out to Risk Analysis (PSX has its own React nav item instead of
  a legacy link, now that it's live).
- **PR #1 merged 2026-08-23** (sidebar dropdown + cross-entity linking v1 +
  filterable Analytics charts, all three described above). Branch
  `claude/app-development-jnh4r9` was fast-forwarded to `main` post-merge
  (no reset needed — its own commits were already part of main's history)
  and re-pushed since GitHub auto-deleted the remote branch on merge.
- **"Next wave" requested by the user, same day, right after the merge —
  not yet built, full design detail in `MODULES_PLAN.md`'s "Next wave"
  section (§8–§13), summarized in README items 20–25**: (1) native Risk
  Calculator replacing the legacy static-page link; (2) cross-entity
  linking gains real multi-currency amounts (`fromAmount`/`toAmount`
  instead of one shared number) plus more module pairs — Personal Loans is
  tractable (needs the same id-retrofit pattern as `Transfer`/`CashEntry`),
  EMI and Funds have real structural blockers (EMI has no repayment ledger
  at all, Funds' `Transfer` field is unused/hidden) that need their own
  design decisions, not silent skipping; (3) the floating Calculator button
  is already global (not a visibility bug, confirmed by reading the code
  live with the user) but wrongly shows the QSE/PSX stock calculator on
  every page — needs to be module-aware; (4) per-module Analytics/Planning
  for all six non-exchange modules (the biggest item here — treat as
  several sessions' worth, not one sitting); (5) a brand-new Subscriptions
  module (recurring payments linked to a paying Bank/Cash entity); (6) a
  CSV/JSON/PDF/image import pipeline — CSV/JSON is buildable now with no
  new infra (same pattern as Banking's existing CSV import), but PDF/image
  parsing was explicitly decided (with the user, not assumed) to need a
  **separate Python backend service** hosted on infrastructure the user
  picks — real new infra a coding session can scaffold but not provision
  end-to-end alone.
- **Native Risk Calculator built + Calculator button fixed (2026-08-23),
  from the "next wave" above — see README Done items 32/33.** New
  `lib/calc/riskAnalysis.ts` (pure, tested) + shared `components/
  RiskCalculator.tsx` + pages at `/risk-analysis` and `/psx/risk-analysis`
  replace the legacy static-page link. Two deliberate correctness fixes
  vs. a blind port: reused the app's real iterative `breakEvenPrice`
  solver (correct under PSX's tiered fees, not just QSE's flat %) instead
  of the legacy page's closed-form formula, and included the buy-side fee
  in a hypothetical new purchase's cost basis (the legacy version omitted
  it, understating break-even). Deliberately *not* ported: a hardcoded
  "MPHC/IQCD = severe" headline special-case in the legacy page — that was
  leftover from one person's real portfolio holdings, not a generalizable
  rule. `CalculatorLauncher.tsx` now returns `null` outside Stock
  Exchanges routes instead of defaulting to the QSE calculator everywhere.
- **Cross-entity linking gains real multi-currency + Rentals (2026-08-23)
  — see README Done item 34.** `InterEntityTransferInput.amount` split
  into `fromAmount`/`toAmount` (independent numbers, no live FX lookup —
  the user enters both sides from their own real conversion); the create
  form defaults to one shared amount and reveals a second field only when
  "Different amount on the other side" is checked, keeping the common
  same-currency case simple. Separately, investigated and added Rentals as
  a linkable module: its `RentalEntry` was already id-addressed (checked
  before assuming, per this file's own standing advice), so no retrofit
  was needed — a linked transfer maps to `RENT_INCOME`/`EXPENSE` depending
  on direction. Personal Loans (needs an id retrofit) and Funds (needs its
  hidden `Transfer` field exposed in the UI) remain unlinked; EMI still
  has no repayment ledger to link into at all.
- **PR #2 code review fix + two user-reported bugs, same day (2026-08-23).**
  A real reviewer (Sourcery, on PR #2) flagged two gaps in the v1 linking
  feature: no rollback if a linked-transfer create partially fails, and
  direct deletion of a linked record from its *native* module (not the
  Transfers page) leaving a one-sided orphan. Both fixed via new
  `lib/linkCascade.ts`, which centralizes what used to be duplicated
  dispatch-switch statements in `TransferLinksPage.tsx` plus new
  `createLinkedTransfer` (rolls back the first side on a later failure —
  explicitly documented as defense-in-depth, not real DB-style atomicity,
  since a client-only app with per-store localStorage + independently-
  debounced Firebase pushes can't be made genuinely transactional),
  `updateLinkedTransfer`, `deleteLinkCascade`, `findLinkForRecord`, and
  `confirmAndDeleteLinkable` — wired into every native delete button
  across all 5 linkable modules (Cash, Bank, QSE, PSX, Rentals) so
  deleting either side of a link from *anywhere* cascades identically to
  deleting it from the Transfers page. Known, stated-not-hidden remaining
  gap: editing (not deleting) a linked record directly in its native
  module still doesn't propagate — would need every edit form to know
  it's touching a linked record, a bigger UI change not attempted here.
  Separately, same session: (1) **critical bug, user-reported** — signing
  out never actually cleared any of the 9 per-account Zustand stores (in
  memory or in localStorage), so the next person on the browser, or the
  same person switching accounts, would see the previous account's data
  and could even push it into their own new cloud path via the existing
  "upload local data" prompt. Fixed centrally in the single shared
  `useAuthState.ts` auth listener (new `lib/resetLocalData.ts`'s
  `resetAllLocalWorkbooks()`), firing only on a transition *away* from a
  previously-known signed-in uid — never on first page load, which must
  not wipe a legitimately-returning user's data. Deliberately doesn't
  touch `appearanceStore`/`termsStore` (global prefs, not per-account
  data). (2) The "Sign in with Google" button's icon was a plain blue-
  circle emoji placeholder — replaced with a real 4-color Google "G" mark
  (new `GoogleIcon` in `components/icons.tsx`). (3) A third user report —
  "only a toast shows instead of the sign-in popup" — could **not** be
  reproduced: both primary sign-in entry points (sidebar button, a gated
  write action) correctly open the real modal locally, zero console
  errors. Left as an open item needing a specific page/button to chase
  further if it recurs; see README Pending.
- **Workflow change, same day (2026-08-23): direct-to-main commits from
  now on, no more PR-based development.** The user explicitly instructed
  "commit into main directly for seamless development" mid-session, after
  PR #2's review cycle was already in flight — that PR was finished,
  merged, and local `main` fast-forwarded to match as usual, but every
  session from here on should commit straight to `main` (still verifying
  tests/build/browser-check first, per this file's existing standing
  instructions — the removed step is only the PR/review ceremony, not the
  quality bar) rather than opening a branch + PR per change.
- **Personal Loans added as a sixth linkable module (2026-08-23) — see
  README Done item 39, MODULES_PLAN.md §8.** Retrofitted
  `PersonalLoanRepayment` with a stable `id` (same pattern as `Transfer`/
  `CashEntry` before it — an `ensureRepaymentIds()` normalizer in
  `personalLoansWorkbookStore.ts`, applied on load and `setWorkbook`, so
  real pre-retrofit data keeps working) and switched
  `updateRepayment`/`deleteRepayment` from `(loanId, index)` compound
  addressing to plain `(id)`. With a stable id, Personal Loans slotted into
  the existing linking machinery exactly like Rentals did:
  `lib/interEntityLink.ts`'s `buildSideRecord` gained a `'personalLoans'`
  case (a repayment against the picked loan, always positive — the one
  side record whose amount doesn't flip sign based on link direction,
  since paying off debt and receiving a repayment both just log a positive
  `PersonalLoanRepayment`), `isSupportedLinkPair` allows Bank/Cash↔Personal
  Loans, `lib/linkCascade.ts`'s three dispatch switches got a
  `personalLoans` case, and `TransferLinksPage.tsx` gained a "Loan" picker
  mirroring the Rentals "Property" picker. `PersonalLoansPage.tsx`'s
  repayment delete button now goes through `confirmAndDeleteLinkable` like
  every other linkable module. Verified live via Playwright with seeded
  localStorage (no real sign-in — same reasoning as the rest of this
  linking feature, see README Done item 39): the loan picker lists the
  seeded loan by name/currency and the cross-currency warning fires
  correctly, zero console errors. `npm run build` / `npm run test` (119
  tests, 6 new) both clean. Funds (hidden `Transfer` field) and EMI (no
  repayment ledger) remain the only unlinked modules — see
  MODULES_PLAN.md §8 for why each needs its own design decision first.
- **Cash gained CSV import (2026-08-23) — see README Done item 40,
  MODULES_PLAN.md §13.** First module beyond Banking to get the "map these
  columns" CSV import pattern. Cash's `amount` field isn't signed like
  Bank's, so the mapped Amount column's sign (with an optional "Flip sign"
  checkbox) decides IN vs OUT and the stored amount is always the absolute
  value; Date and Amount are required, Category is optional, and one
  Currency picker applies to the whole imported batch. `CashEntry.source`
  widened to `'manual' | 'statement-import'` plus a new `statementRef?`
  (mirrors `BankTransaction`) so the ledger's new Source column can show
  which entries came from an import. Added a generic `addEntries()` bulk
  action to `createEntryStore.ts` (mirrors `bankWorkbookStore.ts`'s
  `addTransactions`) rather than looping `addEntry` and re-persisting to
  localStorage once per row — this benefits any other `createEntryStore`
  user (EMI, inter-entity transfers) that later wants bulk import too.
  Verified live via Playwright with an actual CSV file upload (not just
  seeded localStorage): the preview correctly derives Cash in/Cash out
  from the amount's sign, category mapping applies live, and clicking
  Import correctly reaches the sign-in gate — zero console errors.
  Personal Loans repayments and Rentals entries still need the same
  treatment (README item 25's remainder).
- **CSV import extended to Rentals and Personal Loans, completing README
  item 25's browser-only half (2026-08-23) — see README Done item 41.**
  Same pattern as Cash: `RentalEntry` and `PersonalLoanRepayment` both
  gained optional `source`/`statementRef` fields. Rentals' new "Import"
  tab (in `RentalsPage.tsx`) maps Date/Amount/Category for one selected
  property, with the Amount column's sign deciding RENT_INCOME vs
  EXPENSE — same convention as Cash. Personal Loans' import lives inside
  each loan's detail view instead of a separate tab (there's no
  loan-independent "all repayments" list to import into) and skips the
  sign/flip entirely, since a repayment is always a positive amount
  regardless of which way the loan runs — same reasoning already used for
  this module's linking side-record. Neither `rentalsWorkbookStore.ts`
  nor `personalLoansWorkbookStore.ts` uses `createEntryStore`, so each
  got its own hand-written bulk `addEntries()`/`addRepayments()` rather
  than reusing Cash's generic one. Verified live via Playwright with two
  real CSV file uploads — zero console errors on either. This closes out
  README item 25's CSV/JSON scope entirely; only PDF/image import (the
  separate Python backend, not yet started) remains.
- **Follow-up Sourcery finding on PR #2, fixed after merge (2026-08-23)
  — see README Done item 42.** The user pointed at a second Sourcery
  review pass on the already-merged PR #2
  (pullrequestreview-5003351872): `createLinkedTransfer`'s rollback only
  tracked `fromModule`, so a failure in the *link-store* write itself
  (after both side records had already been written) rolled back `from`
  but left `to` orphaned — a real remaining gap in what Done item 35
  believed was a complete fix. Fixed by tracking every side actually
  written (not just `from`) and rolling all of them back on any failure.
  New test in `lib/__tests__/linkCascade.test.ts` uses `vi.spyOn` to
  force the link-store write to fail after both side writes succeed,
  confirming the fix. Lesson for future sessions: a rollback that only
  tracks "the first thing written" is incomplete once there's more than
  one prior write to protect — track everything written so far, not a
  single pointer.
- **New "Planning" scenario planner for Cash and Banking (2026-08-23),
  user-requested — see README Done item 43, MODULES_PLAN.md §14.** Before
  building, asked the user two real design questions via
  AskUserQuestion: which module(s) first (answer: Cash and Banking
  together), and how a "planned" entry should relate to the real ledger
  (answer: a separate plan, "Mark as done" converts it into a real entry
  — same pattern as the existing QSE/PSX Trade Planner — rather than an
  in-place status flag on a normal entry). `PlannedCashEntry`/
  `PlannedBankTransaction` (`types/plannedCash.ts`/`types/plannedBank.ts`)
  both fit `createEntryStore`'s generic shape directly, so
  `plannedCashWorkbookStore.ts`/`plannedBankWorkbookStore.ts` are
  two-line factory calls — deliberately **separate stores** (own
  localStorage keys, own Firebase paths `users/{uid}/plannedCash`/
  `plannedBank`) from the main Cash/Bank workbooks, so this carries zero
  migration risk to real user data. New `lib/calc/plannedBalance.ts`
  (`plannedCashProjection`/`plannedBankProjection`, 8 tests) computes
  Real (actual entries) vs. Planned (Real + every not-yet-executed plan)
  balance per currency. New "Planning" tab on both `CashPage.tsx` and
  `BankPage.tsx`: a projection summary with **two checkboxes the user
  controls** ("Real balance"/"Planned balance," both default on) — per
  the user's own explicit ask to let them choose what to see rather than
  the app deciding — plus an add-plan form and a plan list with
  Edit/Delete/"Mark as done." Each Planning tab also gets its own
  "Account" cloud-sync section for the new plan stores, matching the
  standard never-auto-upload-on-empty-cloud pattern used everywhere
  else. `App.tsx` runs both new sync hooks globally (same pattern as
  every other module) and passes their status down as new props on
  `CashPage`/`BankPage`. Verified live via Playwright with seeded
  localStorage: Real/Planned numbers matched hand-calculated
  expectations for both modules, unchecking "Planned balance" hid that
  line, and "Mark as done" correctly hit the sign-in gate — zero console
  errors. `npm run build` / `npm run test` (128 tests, 8 new) both
  clean. Deliberately not done in v1: no Planning tab for Personal
  Loans/Rentals/EMI/Funds, no linking a plan into the cross-entity
  Transfers system, no reminder/notification for a plan's date arriving.
- **Planning v2 design captured, NOT built (2026-08-23) — see README
  Pending item 28, MODULES_PLAN.md §15.** Right after Planning shipped,
  the user described a second, harder case: a real (not hypothetical)
  transfer that's already been sent but takes a few business days to
  clear, during which the observed balance doesn't reflect it yet — and
  asked for balance-jump detection (comparing the actual new balance
  against the account's ordinary daily increment, e.g. a daily-profit
  accrual) to suggest that a specific hanging plan has settled, plus a
  user-confirmed decision on which date profit-basis should switch on
  for correct historical P&L. The user explicitly said they have real
  sample Excel data illustrating this from their own account and will
  attach it in a future turn, and explicitly asked to update the docs
  first and not write code until then — so this is design-only, nothing
  implemented. Real open gaps documented in MODULES_PLAN.md §15: no
  "expected profit rate" field exists anywhere in the data model yet;
  neither Cash nor Banking has a single "the bank told me my balance is
  X right now" event to hook a reconciliation check into (both compute
  balance as a derived sum today); ambiguous-match tolerance (multiple
  hanging plans that could explain one jump) is undesigned. **Do not
  guess at the algorithm** — wait for the sample data and design against
  a real worked example, per the user's own instruction.
- **Planning v2 refined, still not built (2026-08-23, same session).**
  User added: the "expected ordinary daily increment" some accounts
  isn't flat across every day — some funds pay a noticeably larger
  payout on one specific weekday (their example: Friday pays 15 instead
  of the regular 2). Folded into MODULES_PLAN.md §15's detection-logic
  and open-gaps sections — the eventual "expected profit rate" field
  needs to support at least a day-of-week-varying rate. Still no code;
  still waiting on the user's sample Excel data before designing the
  actual shape.
- **Cash Analytics tab built (2026-08-23), first module of README item
  23's "per-module Analytics" wave, see Done item 44, MODULES_PLAN.md
  §11.** Three charts (category-breakdown doughnut, income-vs-expense-
  by-month bar, balance-over-time line), all reusing already-computed
  `cashByCategory`/`cashRunningLedger` plus one new pure function,
  `cashMonthlyFlow()` in `lib/calc/cashModule.ts`. A currency picker
  shows up only when the workbook actually has more than one currency in
  it. Reused `features/qse/components/ChartCard` cross-module rather
  than duplicating it, since PSX's `AnalyticsPage.tsx` already sets that
  precedent. Verified live via Playwright with seeded multi-currency
  data (USD + PKR): all 3 canvas charts rendered, switching the currency
  picker correctly changed the charts' data, zero console errors.
  `npm run build` / `npm run test` (131 tests, 3 new) both clean.
  Next per MODULES_PLAN.md §11's suggested order: Personal Loans, then
  Banking, EMI/Loans, Funds, Rentals — this whole item is "several
  modules' worth of work," treat each module as its own pass.
- **Personal Loans Analytics tab built (2026-08-23) — second module of
  the same wave, see README Done item 45, MODULES_PLAN.md §11.**
  Outstanding-by-loan bar chart (per loan, not netted per person — a
  person with two loans in opposite directions would otherwise hide
  which is which, so this deliberately doesn't aggregate), a
  repayments-by-month bar chart, and a "payoff planner" — the last one
  lives inside a loan's own detail view (not the Analytics tab) since it
  needs that specific loan's current outstanding balance, and it's a
  live unsaved "what if" calculator, never persisted. Two new tested
  pure functions in `lib/calc/personalLoansModule.ts`:
  `outstandingByLoan()`, `repaymentsByMonth()`, plus `projectPayoff()`
  for the planner (simple linear months-to-payoff, no interest/
  compounding concept — an informal debt isn't EMI/Loans' amortization
  schedule). Verified live via Playwright: both charts rendered, and the
  payoff planner's math checked out by hand (700 outstanding at 100/
  month correctly projected 7 months) — zero console errors.
  `npm run build` / `npm run test` (138 tests, 7 new) both clean. Next:
  Banking, EMI/Loans, Funds, Rentals.
- **Critical bug fixed, user-reported (2026-08-23): Personal Loans
  cloud sync error — see README Done item 46.** Root cause was
  systemic, not specific to Personal Loans: Firebase RTDB's `set()`
  throws synchronously on a literal `undefined` anywhere in the value
  tree, and several add-forms across modules write
  `field: x?.trim() || undefined` for an empty optional field (Personal
  Loans' `note`, plus the same pattern in Bank/Cash/Rentals/PSX Trade
  Planner/Transfers) — so any record saved without that field crashed
  the next debounced push. Fixed once, centrally: new
  `stripUndefinedDeep()` in `lib/firebase/useWorkbookCloudSync.ts`
  round-trips the payload through `JSON.parse(JSON.stringify(...))`
  before every `set()` call (both the debounced auto-push and
  `uploadLocalToCloud()`), fixing every module that goes through the
  shared sync hook rather than patching each `|| undefined` call site.
  New test file `lib/firebase/__tests__/useWorkbookCloudSync.test.ts`
  (3 tests) covers the exact reported scenario. Lesson: this class of
  bug (`x || undefined` on an optional field) is easy to reintroduce in
  a new module's add-form — the fix belongs in the shared sync path,
  not in each individual call site.
- **Sorting + direct edit added to a batch of tables that lacked them
  (2026-08-23), user-reported — see README Done item 47.** Audited
  every module for the existing `useSortableRows` pattern and for
  whether records are editable at all. Added sorting to: Personal
  Loans' loan list and repayments table, EMI's loan list, Bank's
  accounts list, Rentals' properties list, the Transfers page's linked-
  transfers list, and QSE/PSX's per-stock transaction tables. Added a
  direct "Edit" button (opens the detail view already in edit mode, via
  a new `startInEditMode` prop on `LoanDetail`) to Personal Loans' and
  EMI's loan list rows, which previously only had "Open." Verified
  every other module already had edit somewhere in its flow — this
  wasn't a universal gap, just these two extra-click cases plus the
  missing sort headers.
- **Overall summary stats added to EMI/Loans and Funds landing pages
  (2026-08-23), user-reported — see README Done item 48.** Every other
  module already showed an accumulative summary on its first tab
  (Cash's balance, Bank's total balance, Personal Loans' net position,
  Rentals' net income, QSE/PSX's full Dashboard); EMI and Funds only
  had stat cards inside a per-record detail view. New
  `totalsByCurrency()` in `lib/calc/emiModule.ts` (tested) sums
  monthly-installment/outstanding/paid-so-far across every loan; Funds'
  equivalent (invested/current-value/net-profit) is computed inline in
  `FundsPage.tsx` from values `FundList` already derives, not a new
  pure function — a straightforward sum, not new calc logic. Verified
  live with seeded data for both modules, zero console errors.
- **Currency pickers remember the last one picked (2026-08-23),
  user-requested — see README Done item 49.** New
  `hooks/useLastCurrency.ts` (tiny `useState`+`localStorage` wrapper,
  tested via `@testing-library/react`'s `renderHook` — first use of
  that library in this project's tests) keyed per add-form. Wired into
  every module's add-form with a currency picker (Cash's ledger + its
  Planning form share one key on purpose; Bank/Personal Loans/EMI/
  Rentals/Funds each get their own). Edit-row currency selects
  deliberately untouched — editing an existing record's currency isn't
  "what should a new record default to."
- **Cluttered chart datalabels fixed app-wide (2026-08-23), user-
  reported — see README Done item 50.** The real cause wasn't the axis
  tick labels — it was `chartjs-plugin-datalabels`' per-point value
  labels: `display: 'auto'` only hides labels overlapping *each other*,
  so a chart with many bars/points (confirmed with a real Playwright
  screenshot on Cash's Analytics charts using 18 months of seeded data)
  could render each label without technically overlapping its neighbor
  while the whole row still looked like an unreadable wall of numbers
  hiding the axis underneath. Fixed once in `lib/chartLabels.ts`'s
  `dlBase()` (shared by every `dl*` helper, so this fixes every chart
  app-wide): `display` is now a function that hides labels entirely
  once a dataset has more than 10 points, since per-point labels stop
  being readable past that anyway and the axis + tooltip already carry
  the same information. Verified with a real before/after screenshot
  comparison, not just described intent.
- **Critical: Trade Calculator "Amount" field rejected typed input,
  user-reported from a real phone (2026-08-23) — see README Done item
  51.** The field's displayed value was fully derived from
  `(newShares * buyPrice).toFixed(2)` on every render — typing
  multi-digit amounts got stuck re-snapping to a 2-decimal-reformatted
  value after each keystroke (worse on mobile, no easy cursor
  repositioning). Fixed in both `features/qse/components/
  TradeCalculator.tsx` and the identical PSX copy by giving the Amount
  field its own local text state that holds exactly what's typed,
  never reformatted mid-typing; only the other fields ("Buy price"/
  "New shares"/the "Use" button) resync it. Verified with real
  per-character Playwright typing (not `.fill()`) in an emulated mobile
  viewport — reproduced the exact failure before the fix, confirmed
  fixed after.
- **Trade Planner crash when deleting all legs in a plan, user-reported
  (2026-08-23) — see README Done item 52. Root cause was a genuine
  Firebase RTDB gotcha, not a bug specific to the Trade Planner.**
  Firebase's Realtime Database silently strips any empty array/object
  value from a written tree at *any* nesting depth, not just the top
  level (the top level was already safe everywhere via the existing
  `{...createEmpty(), ...cloudData}` merge in both
  `loadFromLocalStorage` and `useWorkbookCloudSync`'s pull handler).
  Deleting a plan's last leg sets `legs: []`; the debounced push
  writes that to Firebase, RTDB drops the now-empty `legs` key
  entirely, and the *next* pulled snapshot's plan object has no
  `legs` key at all — `plan.legs.map/.filter/.reduce` in `PlanCard`
  (`features/psx/pages/TradePlannerPage.tsx`) then threw
  `Cannot read properties of undefined`, crashing the whole page
  (caught by the error boundary as "Something went wrong"). Static
  reading of `TradePlannerPage.tsx` alone never would have found this —
  every array read there is genuinely safe against a *local*, in-memory
  empty array; the bug only exists once a value round-trips through
  Firebase. Confirmed via Playwright by seeding a plan object with the
  `legs` key omitted outright (simulating exactly what a real pull
  would hand back) — reproduced the crash, then confirmed it gone after
  the fix. **Fix, and the reasoning for where it lives**: added to the
  one shared `normalize()` function in `store/createWorkbookStore.ts`
  (the same function that already retrofits missing `Transfer` ids) —
  restores `legs: []` on any trade plan missing that key. This runs on
  every path data enters the store (local load and `setWorkbook`, which
  covers the Firebase pull), so it protects QSE's `tradePlans` field
  too even though only PSX has a Trade Planner page today — free
  future-proofing from fixing it at the shared-factory level instead of
  patching `TradePlannerPage.tsx` itself. Audited every other workbook
  type in the codebase for the same vulnerability class (an array field
  nested *inside* another array-of-objects field, as opposed to sitting
  directly on the workbook root) — `TradePlan.legs` is the only one;
  every other module's arrays are root-level and already covered by the
  existing default-merge. **Rule for any future nested-array field**:
  if a module ever adds one, it needs the same "restore missing key on
  normalize" treatment — a root-level empty array is safe, a nested one
  is not, because RTDB's empty-value stripping doesn't care how deep it
  is. New tests: `store/__tests__/createWorkbookStore.test.ts` (4
  tests). `npm run build` / `npm run test` (150 tests, 4 new) both
  clean.
- **Chip/checkbox-chip selected-state indicator fixed app-wide,
  user-reported (2026-08-23) — see README Done item 53.** Root cause
  was two layers deep, and only the second layer was the "real" bug.
  Layer one: even under the default "wine" theme, `.chip.active`'s old
  style (a light `--accent-soft` tint) was too close in lightness to
  the inactive chip's own background — a legitimate, if mild,
  contrast problem. Layer two, the actual severe bug: **every other
  color theme in the app (ocean/forest/violet/sunset, and all seven
  `material-*` themes) had a *higher-specificity* per-theme `.chip`
  rule in `theme.css` that unconditionally set the same background/
  color properties `.chip.active` sets — with higher CSS specificity
  (an `html:not(...)`/`html[data-color^=...]` type+attribute selector
  beats a plain two-class `.chip.active` selector) — so under any
  non-wine theme, active and inactive chips rendered **completely
  identically**, regardless of state. This is exactly the kind of bug
  that's invisible reading the "obvious" rule (`.chip.active` itself
  looked fine in isolation) and only shows up once you trace which
  *other* rule in the cascade wins for a given theme — worth
  remembering the next time a chip/pill-style active-state complaint
  comes in: check every per-theme override for the same class before
  assuming the base active-state rule is broken. Confirmed via
  Playwright screenshots (before/after, three themes: wine,
  material-blue, ocean) of both the exchange-switcher chips and
  `ChartFilterBar`'s ticker chips. **Fix**: rewrote the base
  `.chip.active` rule to a solid, strongly-contrasting fill — the same
  `color-mix(in srgb, var(--accent) 65%, #000)` + white-text treatment
  the app's primary `.btn` already uses — and added `:not(.active)` to
  every per-theme `.chip` override selector in `theme.css` (two
  `:not([data-color="wine"]) .chip` blocks, the `material-*` block, and
  the explicit material-light/dark block) so none of them can clobber
  the active style regardless of theme. Also added a `CheckIcon`
  checkmark to `ChartFilterBar`'s ticker chips specifically (a genuine
  multi-select "checkbox" control, unlike the single-select exchange-
  switcher/tab-bar chips, which read fine from the fill alone) for a
  color-independent confirmation signal. No test suite coverage (a
  CSS/visual fix) — verified entirely via the before/after screenshots.
  `npm run build` / `npm run test` (150 tests, unchanged) both clean.
- **Mobile CSS pass, user-reported (2026-08-23) — see README Done item
  54. Both root causes found via real computed-style inspection in
  Playwright (`getBoundingClientRect`/`getComputedStyle`), not guessed
  from a screenshot.** Cramped-inputs report: `.row > *{flex:1}` sets
  `flex-basis:0%`, so a `.row`'s per-field `width` props are entirely
  ignored — the row just divides its actual width evenly among however
  many fields sit in it. Confirmed on the Trade Calculator's Buy
  price/New shares/Amount/Target avg cost row (4 fields, each with its
  own `width` prop) on a 390px viewport: every field measured exactly
  **74px**, not its requested width. Misaligned-inputs report, same
  inspection: those 4 fields have very different label lengths (up to
  3 wrapped lines for "Target avg cost (optional)" vs. 1 for others);
  `.row`'s default `align-items: stretch` stretches every field to a
  common height, but `Field` packed label+input at the *top* of that
  stretched box, leaving unused space *below* the input — so
  short-label fields' inputs sat 18-36px higher than long-label
  fields' inputs in the very same row. **Fix**: `Field`
  (`components/ui/Field.tsx`) now sets `justifyContent: 'flex-end'` —
  anchors every field's label+input block to the *bottom* of its
  stretched box instead, so input bottoms always line up regardless of
  label height. This required zero changes to any of the dozens of
  pages that use `Field` — it's a one-line fix in the shared component,
  the same "fix once at the shared layer" pattern already used for
  `stripUndefinedDeep` and the `createWorkbookStore` normalize fix.
  Separately added a `max-width:640px` block in `theme.css`:
  `.row{flex-wrap:wrap}` + `.row > *{min-width:140px}` so a crowded row
  wraps to 2-per-line (156px each) instead of squeezing everything onto
  one line; 16px input font-size on mobile (below that, iOS Safari
  zooms in on focus — a real usability papercut that has nothing to do
  with any app bug but reads like one); and `.stat-card .value` gets
  `overflow-wrap:anywhere` + a smaller mobile font-size, verified with
  a seeded 8-figure PKR total wrapping cleanly to a second line inside
  its card instead of overflowing (checked via a `scrollWidth >
  clientWidth` sweep across every `.stat-card .value` on the page, zero
  hits). **Pattern worth remembering for any future "things feel
  cramped/misaligned on mobile" report**: don't guess from a screenshot
  alone — pull real `getBoundingClientRect`/`getComputedStyle` values
  for the elements in question first. The visual estimate from the
  first screenshot in this investigation was actually wrong (looked
  like a 2-per-row wrap; the real numbers showed all 4 fields on one
  line, just with a tall wrapped-label cell making it look like two
  rows) — the measurements caught what eyeballing a screenshot missed.
  `npm run build` / `npm run test` (150 tests, unchanged — a CSS/layout
  fix) both clean.
- **Chart value labels clipping at the chart's edge, user-reported
  (2026-08-23) — see README Done item 55.** Distinct from the earlier
  datalabels-clutter fix (Done item 50, which *hides* labels once a
  dataset has more than 10 points) — this is about a label that *does*
  render but has nowhere to go: `chartjs-plugin-datalabels` draws a
  value label just outside its bar/point (above for `dlBarV`/`dlLine`,
  to the side for `dlBarH`), but Chart.js's own auto-ranged scale has
  no awareness that a plugin is about to draw past the data's own
  max/min — so the single tallest/rightmost value's label routinely
  got clipped right at the canvas boundary, with zero reserved
  headroom. Fixed with two Chart.js global defaults set once in
  `lib/chartSetup.ts` — `ChartJS.defaults.scales.linear.grace = '10%'`
  (pads the auto-computed numeric range past the actual data extent)
  and `ChartJS.defaults.layout.padding = {top:20, right:16, bottom:4,
  left:4}` (reserves canvas space around the plot area) — rather than
  touching each of the 8 files across the app that build their own
  Chart.js `options` object. **TS note**: `ChartJS.defaults.scale.grace`
  doesn't typecheck (the generic `scale` defaults type doesn't include
  `grace`, which is LinearScale-specific) — use
  `ChartJS.defaults.scales.linear.grace` instead, which is correctly
  typed. Verified by comparing before/after screenshots of the same
  seeded Cash "Income vs. expense by month" data: before, the y-axis
  topped out exactly at the tallest bar's own value (no headroom
  visible at all); after, the same data auto-ranges 50% higher,
  visibly making room above every bar. `npm run build` / `npm run test`
  (150 tests, unchanged — a chart-defaults change, verified visually)
  both clean.
- **Stat-card number abbreviation + tooltip, two related user-reported
  items done together (2026-08-23) — see README Done item 56.** New
  `lib/format.ts` helpers `fmtCompact`/`fmtMoneyCompact` (1,234,567 →
  "1.23M"; unabbreviated below 1,000) and a new shared `MoneyValue`
  component in `components/Card.tsx` — it renders the compact form as
  the visible text and the full-precision `fmtMoney` string as a
  native `title` attribute, needing no JS/extra markup for the
  tooltip. Rather than touch each hand-rolled stat card's JSX with a
  one-off `fmtMoneyCompact`+`title` combo, `MoneyValue` is a drop-in
  replacement for `<div className="value">{fmtMoney(n, currency)}</div>`
  wherever that exact pattern appeared — QSE/PSX Dashboard's shared
  `StatCard` component also gained a `title` prop for the same purpose.
  **Nine call sites across six files** ended up needing this pattern
  once actually audited (`grep -rn "stat-card"`): Cash's balance card,
  Bank's total-balance card, Personal Loans' net-position and per-loan
  principal/outstanding cards, EMI's per-loan and overall-summary
  cards, Funds' per-currency and per-fund cards, Rentals' net-income
  card — a good example of why "round the stat cards" sounds like a
  one-file fix but isn't, in an app with six independently hand-rolled
  module pages instead of one shared dashboard. Deliberately left
  alone: the Cash/Bank Planning tabs' "Real: X / Planned: X" projection
  cards (a differently-shaped, prefixed display, not a plain `.value`
  div — `MoneyValue` doesn't fit them without a "before" slot it
  doesn't have yet) and every non-money stat (share counts,
  percentages, XIRR — nothing to abbreviate). New tests:
  `lib/__tests__/format.test.ts` (6 tests). Verified live: a seeded
  8-figure PKR deposit displays as "12.35M PKR" with
  "12,345,678.90 PKR" confirmed present in the DOM's `title` attribute
  (checked via `getAttribute`, not just visually). `npm run build` /
  `npm run test` (156 tests, 6 new) both clean.
- **Upcoming/in-process planned payments surfaced in module stats,
  user-reported (2026-08-23) — see README Done item 57.** Ties into
  the existing Planning feature (Done item 43), which only Cash and
  Banking have. Cash's `BalancesSummary` and Bank's `TotalBalances` —
  both already rendered on each module's default/landing tab, not
  buried inside the Planning tab — now also read the not-yet-executed
  entries straight from `usePlannedCashWorkbookStore`/
  `usePlannedBankWorkbookStore` and add a `sub` line under the
  relevant currency's Balance card (e.g. "2 upcoming plans (net -250
  USD)"), shown only when that currency actually has a pending plan.
  Bank's version needed one extra step Cash didn't: a planned bank
  transaction has no currency of its own, only an `accountId`, so it
  maps account → currency the same way `plannedBankProjection` already
  does internally — reused that same mapping logic rather than
  duplicating it. No new calc code or tests needed since both
  `plannedCashProjection`/`plannedBankProjection` (Done item 43) were
  already covered; this is purely surfacing data that already existed
  one tab away. Verified live with seeded pending plans on both
  modules — Cash: "1k USD" / "2 upcoming plans (net -250 USD)"; Bank:
  "500 USD" / "1 upcoming plan (net -300 USD)" — both visible without
  navigating into Planning. `npm run build` / `npm run test` (156
  tests, unchanged) both clean.
- **Account detail drill-down + statement export, v1 for Banking only
  (2026-08-23) — see README Done item 58, Pending item 40 for the
  remaining modules.** User asked for this across every module
  ("clicking an account should open its details... same features for
  other modules and their items"), but each module's "primary record"
  and what a "statement" even means for it differs enough (a stock
  position's statement is its transaction history; a loan's is its
  repayment history) that building all of them in one pass risked
  doing each shallowly — shipped Banking first as the template instead,
  since "account" maps onto it most literally. New `AccountDetailModal`
  in `features/bank/pages/BankPage.tsx` (opened via a "Details" button
  per account row): current balance, upcoming not-yet-executed plans
  for that account, the 20 most recent real transactions with running
  balance (reuses the already-existing `accountRunningLedger`), and a
  from/to date-range "Export CSV" button. New `toCSV()` in `lib/csv.ts`
  — the inverse of the existing `parseCSV()` (statement import already
  had a parser; nothing generated CSV text before this) — is
  deliberately module-agnostic so any other module's future detail view
  reuses the same helper instead of rolling its own serialization.
  Verified with a real Playwright download (not just a code read): the
  actual downloaded file's content was read off disk and confirmed
  correct (header row, both transactions, correct running balance).
  New tests: `lib/__tests__/csv.test.ts` gained 4 `toCSV` cases. `npm
  run build` / `npm run test` (160 tests, 4 new) both clean. **The
  reusable pieces for extending this to QSE/PSX/Personal Loans/EMI/
  Funds/Rentals are already in place** (`Modal`, `toCSV`, the
  date-range-filter pattern) — what's left per module is deciding what
  "statement" and "recent activity" mean for that module's own record
  type, not new infrastructure.
- **EMI-to-Bank linking + Expected end date, user-reported (2026-08-23)
  — see README Done item 59.** `LoanDetail`
  (`features/emi/pages/EMIPage.tsx`) gained a "Link to bank" card: pick
  a Banking account, click **Link to bank**, and it generates one
  `PlannedBankTransaction` per *remaining* (not-yet-paid) installment
  in that account's Planning feature — dated via two new pure
  functions in `lib/calc/emiModule.ts`, `installmentDueDate(loan,
  month)` and `expectedEndDate(loan)` (both `startDate` + N months,
  reusing the exact `setMonth` pattern already used by
  `personalLoansModule.ts`'s `projectPayoff` rather than inventing a
  new date-math approach). **Re-linking needed real design thought, not
  just "generate again"**: `EMILoan.linkedBankAccountId?` tracks which
  account a loan is linked to (so the UI can show "Linked to X" and
  switch the button to "Re-link"), and `PlannedBankTransaction.
  sourceEmiLoanId?` tags every auto-generated plan so a re-link can
  find and delete *only this loan's own still-pending* generated plans
  before creating fresh ones — critically, a plan already marked
  "Done" (`executed: true`) is left alone even on re-link, since that's
  a real transaction record now, not a projection. Without
  `sourceEmiLoanId`, re-linking would either orphan the old plans
  (duplicates piling up) or risk deleting plans that happen to share an
  account with a different loan. Also added the "Expected end date"
  stat card next to "Months remaining" — the same `expectedEndDate()`
  used for both is what keeps the two internally consistent. New
  tests: 2 cases in `lib/calc/__tests__/emiModule.test.ts`. Verified
  live: expected-end-date stat renders correctly, and clicking "Link to
  bank" correctly hits the sign-in gate with the right message — same
  verification depth as every other sign-in-gated write in this
  project; a real authenticated round-trip (confirming the plans
  actually land in Bank's Planning tab) needs a human with a real
  account, not a throwaway one against the production Firebase
  project. `npm run build` / `npm run test` (162 tests, 2 new) both
  clean. **Not built**: the optional calendar view (README's own
  wording said "maybe" — a plain sorted list already exists in Bank's
  Planning tab, so this is a nice-to-have left for later, not a gap).
- **Rentals auto-planning from lease info + security deposit/tenant
  tracking (2026-08-23) — see README Done item 60, the sixth and final
  item in this feedback round.** `Property` gained a batch of optional
  lease/tenant/deposit fields — all optional so every existing
  property keeps working unchanged, same "retrofit-safe" approach used
  throughout this project. A new "Details" button per property
  (`PropertyDetailModal`) is the third module now using the Bank-
  account-Details drill-down pattern from Done item 58 (Bank
  → EMI's "Link to bank" card reused its sign-in+regenerate structure
  → now Rentals' property details) — worth noting as a real, repeating
  pattern rather than three independent inventions. New pure
  `generateLeaseRentPlans()` in `lib/calc/rentalPlanning.ts` computes
  projected rent cycles: starts from whichever is later of the lease
  start and today (skips cycles already in the past even when resuming
  a lease that started long ago — the function's own tests specifically
  cover this, since it was the one subtle date-math case worth getting
  wrong), caps at the lease's own end date or a 12-month horizon for an
  open-ended lease, and clamps a cycle day past a short month to that
  month's last day (day 31 in February → 28th/29th), same accepted
  simplification as EMI's `installmentDueDate`. **One real off-by-one
  bug found and fixed while writing this**: the initial "12-month
  horizon" implementation used `today + 12 months` as an *inclusive*
  cutoff, which generated 13 cycles, not 12, because a cycle exactly
  on that 13th-month boundary date still satisfied `<= cutoff`. Fixed
  by pulling the cutoff back one day (`horizonEnd.setDate(...− 1)`) —
  caught by the test suite, not a manual eyeball. New store/type files
  mirror `plannedBank`'s exactly (`types/plannedRentals.ts`,
  `plannedRentalsWorkbookStore.ts` via `createEntryStore`, own
  Firebase path `plannedRentals`); `PlannedRentalEntry.
  sourceLeasePropertyId?` is the same "so regeneration only touches
  its own still-pending plans" mechanism as EMI's `sourceEmiLoanId`,
  applied by literal copy-paste of the reasoning, not a new pattern.
  **Deliberately scoped down from the request**: only rent income is
  auto-planned, not expenses (recurring maintenance/tax is too
  irregular to project safely, and utilities are a lump included/not
  flag per this file's own earlier note, not itemized recurring
  costs); and there's no Real-vs-Planned net-income projection UI like
  Cash/Bank's Planning tab — `PlannedRentalSettings` is an empty
  placeholder type for now, just a plan list. New tests:
  `lib/calc/__tests__/rentalPlanning.test.ts` (5 cases, including the
  off-by-one regression above). Verified live: filled in lease details
  in the modal, confirmed clicking "Generate projected rent" correctly
  hits the sign-in gate. **Debugging note worth remembering**: initial
  verification looked like a genuine bug (button click did nothing
  visible) until adding temporary debug logging showed the sign-in
  modal WAS opening — the test script's own selector
  (`input[type=email]`) was wrong, since `SignInModal.tsx` uses a
  plain `<input placeholder="Email">` with no `type=email` attribute.
  Switching the selector to match the placeholder confirmed the
  feature was correct all along. `npm run build` / `npm run test`
  (167 tests, 5 new) both clean.
- **Critical, user-flagged urgent (2026-08-23, arrived mid-turn while
  answering an unrelated question): PSX Trade Planner couldn't add a
  new leg to an already-saved plan — see README Done item 61.**
  `PlanCard` already had Edit/Remove per leg, but the only way to add
  a leg at all was `NewPlanForm`, which only creates a *new* plan —
  once saved, a plan was stuck at whatever legs it started with.
  Fixed by adding an "+ Add leg" button under a saved plan's table
  that opens an inline form row (mirrors `NewPlanForm`'s own leg row
  exactly: date/ticker/action/shares/price, PSX ticker datalist), and
  appends it via the existing `updateTradePlan` action on **Add**
  (same validation as a new plan: ticker+shares+price required) or
  discards it on **Cancel**. Verified live via Playwright with a real
  persistence check (not just a visual one): seeded a saved single-leg
  plan, added a second leg through the UI, then read `localStorage`
  directly afterward and confirmed both legs were actually stored —
  a UI-only check could have missed a bug where the leg *appeared* to
  save but didn't actually persist to the store. `npm run build` /
  `npm run test` (167 tests, unchanged — UI wiring onto an
  already-tested store action) both clean.
- **PSX Trade Planner per-ticker analysis, user-prioritized mid-session
  (2026-08-23) — see README Done item 62.** The user explicitly
  restated the tool's purpose while asking for this: "find the buy
  avg, break-even, PL per each trade and collectively to plan and run
  profitable trade cycle" — a signal that the leg table alone (each
  leg's own amount/fee) wasn't meeting the actual point of a
  *planner*, as opposed to a plain multi-row form. New
  `lib/calc/tradePlanAnalysis.ts`'s `analyzeTradePlanByTicker()` is
  the core addition: per ticker in a plan, it blends the plan's own
  buy legs with whatever you *already* hold (via `usePSXDerived()`'s
  `rows`) into one average cost — this was a deliberate design choice,
  not the simpler "just use this plan's own legs": a sell-only plan
  (no buy legs at all, just "I want to sell part of what I already
  own") needs to know your *real* cost basis to mean anything, and
  ignoring the real holding would silently show a nonsensical 0
  average cost for the single most common planning case (selling
  existing stock). Reuses the exact same `breakEvenPrice` solver
  already used by the Trade Calculator/Portfolio/Dashboard rather than
  a new formula — one fee-aware break-even implementation for the
  whole app. New tests: `lib/calc/__tests__/tradePlanAnalysis.test.ts`
  (6 cases). **A debugging note worth remembering, again**: verifying
  this live in Playwright first showed every value as "—" (looked like
  a real bug — avg cost/break-even/P/L all blank) until adding
  temporary debug logging revealed the seeded test fixture itself was
  wrong twice over: the PSX `settings` object was missing most of its
  required fields (a shallow top-level merge in `loadFromLocalStorage`
  means a partial `settings` object *replaces* the complete default
  wholesale, not merges into it — so `calcFee` silently computed `NaN`
  throughout), and separately the seeded `Transaction` used a `type`
  field instead of the real `action` field, so the "real holding" came
  back as an empty `rows` array with zero error. Neither was a product
  bug; both were test-fixture mistakes that produced exactly the
  symptom a real bug would — the fix each time was building a
  complete, schema-accurate fixture (borrowed directly from
  `defaultPsxWorkbook.ts`'s own `DEFAULT_PSX_SETTINGS`) rather than a
  hand-typed partial one. `npm run build` / `npm run test` (173 tests,
  6 new) both clean.
- **PSX Trade Planner: default ticker auto-fill, immediate follow-up
  request (2026-08-23) — see README Done item 63.** `TradePlan` gained
  `defaultTicker?: string`; setting it in `NewPlanForm` backfills any
  leg whose ticker is still blank (never clobbers one the user already
  typed something different into) and every subsequent "Add leg" 
  pre-fills from it; a saved plan (`PlanCard`) shows and edits its own
  default ticker the same way, with its own "+ Add leg" also
  pre-filling from it. Deliberately still allows mixed tickers in one
  plan — the user's own words were explicit about that ("1 plan may
  have different trade tickers"), so this is a convenience default,
  not a constraint. Verified live via Playwright, including checking
  the actual `inputValue()` of a newly-added leg's ticker field (not
  just a screenshot) — the field's own narrow width visually clips a
  4-letter ticker, which could otherwise look like a truncation bug
  when it's actually just CSS. `npm run build` / `npm run test` (173
  tests, unchanged) both clean.
- **PSX Trade Planner: sortable legs table + a real double-counting
  bug found and fixed while separating planned/executed + a "what if
  exit" sandbox — three related requests (2026-08-23), see README
  Done item 64.** The user asked for the legs table to be sortable
  (`useSortableRows`, display-only reordering — every action still
  addresses a leg by its captured original array index, same pattern
  already used for QSE/PSX's per-stock transaction tables, verified by
  editing the first row after a descending sort and confirming the
  *correct* leg opened). While building the "clearly separate planned
  vs. executed" part of the same request, found that
  `analyzeTradePlanByTicker` (added earlier this session) counted
  *every* leg regardless of its `executed` flag — but an executed leg
  already created a real Transaction, so it's already baked into the
  real holding passed in from `usePSXDerived()`. Every executed leg
  was silently double-counted into the average cost. This is worth
  remembering as a general shape of bug: **when blending "real, already-
  happened data" with "a plan describing hypothetical future data,"
  any record in the plan that has *already* transitioned into being
  real needs to be excluded from the hypothetical side, or its effect
  counts twice.** Fixed by splitting each ticker's legs into
  executed/not-yet-executed and excluding executed ones from
  `avgCost`/`breakEven`/`plannedBought`/`plannedSold`/`realizedPL`
  entirely, surfacing them instead as separate `executedBought`/
  `executedSold` figures. New `whatIfExit()` answers "what would
  exiting at price X actually net" for a given share count/cost basis;
  the new `WhatIfExitCalculator` component runs it two ways per ticker
  (just what's left after the plan's own pending sells, and the full
  position as if those sells hadn't happened) — directly matching the
  user's own framing of the planner as "a trade sandbox for testing
  different trade combos for profitable exit," not just a form that
  records legs. New tests: `lib/calc/__tests__/tradePlanAnalysis.test.ts`
  grew to 10 cases, two specifically regression-testing the
  double-counting fix. Verified live: a plan with one executed buy
  (matching a seeded real Transaction), one pending buy, one pending
  sell — confirmed the table split them correctly and the resulting
  average cost was NOT doubled, plus the what-if calculator gave
  sensible numbers for both scenarios. `npm run build` / `npm run
  test` (178 tests, 5 new) both clean.
- **Large batch of user feedback received 2026-08-23, mid-session —
  most items handled, some still open (check README Done/Pending for
  current per-item status, this is a snapshot at time of receipt).**
  Verbatim-ish list, for full context if a future session needs it:
  (1) Trade Calculator amount input bug — fixed, see above. (2) Trade
  Planner error deleting all trades in a plan — fixed, see above (a
  Firebase RTDB empty-nested-array gotcha, see README Done item 52).
  (3) Checkbox/chip selected-state unclear — fixed, see below (README
  Done item 53). (4) Inputs/
  selects should be a bit larger on mobile to avoid cutting — fixed,
  see below (README Done item 54). (5)
  Inputs should align to the bottom with labels directly above,
  consistently — long labels currently push some inputs down while
  others stay up — fixed, see below (README Done item 54, same fix as
  (4)). (6) Some chart labels cut off at chart edges — fixed, see
  below (README Done item 55). (7)
  Mobile: stat card amount text overflowing — fixed, see below (README
  Done item 54). (8) Round stat-card
  numbers for a cleaner look, show the real precise number as a
  tooltip — fixed together with (10), see below (README Done item 56).
  (9) Stats should surface in-process/upcoming planned
  payments (ties into the Planning feature) — fixed, see below
  (README Done item 57). (10) Shorten large
  numbers in display (10,000 → 10k) where reasonable — fixed, see
  below (README Done item 56). (11) EMI: a link
  button to link an EMI loan to a bank + a payment date, generating a
  recurring plan for the remaining installments, maybe a calendar
  view; EMI is also missing a displayed expected end date — fixed
  (except the optional calendar view), see below (README Done item
  59). (12)
  Rentals: auto-plan income/expenses per billing cycle from rental
  agreement details, plus track security deposit info (cash/cheque) —
  fixed (income only, not expenses — see below, README Done item 60).
  (13) A net-worth dashboard summing everything up, collapsible
  per-currency sections, **plus a converted total at a live ("Google")
  exchange rate in the user's preferred currency** — this last part
  directly conflicts with this project's own locked "no live FX-rate
  lookup, no live market-data API calls" rule (see Design decisions
  above) and needs to be raised with the user before any code is
  written for it, not silently built or silently dropped.
- **Trade Planner full-screen/collapse + app-wide collapsible sidebar
  (2026-08-23), same batch — user request: "full screen button to view
  a plan with high focus. plans should be collapsible. sidebar also
  collapsible to save space and focus." See README Done item 65.**
  Each `PlanCard` (`features/psx/pages/TradePlannerPage.tsx`) gained
  independent `fullscreen`/`collapsed` states — full-screen renders the
  card `position:fixed;inset:12px` above a dimmed `.modal-overlay`
  backdrop; collapsed hides the legs table/analysis/what-if calculator
  down to just the header. Separately, `AppShell.tsx` gained a
  **desktop-only** sidebar collapse, deliberately distinct from the
  existing sub-860px mobile drawer (which is closed by default, opened
  by a hamburger button, and unaffected by this change): above 860px
  the sidebar is open by default and can be slid off-screen via a new
  `«` button (`Sidebar.tsx`'s `.sidebar-title-row`/
  `.sidebar-collapse-btn`, next to the "FinanceRecorder" title), leaving
  a small floating `»` tab (`.sidebar-expand-tab`, `@media(min-width:
  861px)`-gated so it never appears on mobile) to bring it back — state
  persists across reloads via `localStorage` key
  `financerecorder_sidebar_collapsed_v1`. Uses a CSS
  `transform:translateX(-100%)` on `.sidebar.desktop-collapsed` (not
  `display:none`) so the `.18s` slide transition animates, with
  `.main.sidebar-collapsed{margin-left:0}` so content reflows into the
  freed space. Verified live via Playwright: collapsing slides the
  sidebar to `x:-220` and shows the expand tab; `localStorage` reads
  back `"true"`; a full page reload still shows the sidebar collapsed
  (confirms the persisted-state read on mount works, not just the
  toggle); clicking the expand tab restores `x:0` — zero console errors
  at every step. `npx tsc -b` / `npm run test` (178 tests, unchanged —
  UI-only) / `npm run build` all clean.
- **Net Worth dashboard built (2026-08-24), user redirected the FX
  approach away from the scaffolded Cloud Function — see README Done
  item 66.** The user's exact instruction: "leave blaze plan. if you
  have any free api, okay otherwise manual inputs accepted. continue."
  This supersedes (doesn't delete) the `functions/index.js` Cloud
  Function scaffolded earlier the same project — it's still in the
  repo, just unused by the shipped feature. New `lib/fx.ts` fetches
  from `open.er-api.com` (free, no key) at most once a day, caches the
  result in `localStorage` with a timestamp, and — critically — never
  lets a failed fetch block or crash the page: it falls back to
  whatever's cached, or to a manual "1 USD = X" entry field the user
  fills in themselves. **This dev sandbox's own outbound network policy
  blocks arbitrary hosts** (confirmed via `$HTTPS_PROXY/__agentproxy/status`
  showing `connect_rejected` for `open.er-api.com`), so the auto-fetch
  actually succeeding in a real browser is unverified from this
  session — what *was* verified is that the failure path degrades
  correctly (no crash, manual entry works, math is right once a rate is
  entered). A future session with real browser access should confirm
  the live fetch actually works and drop this caveat once confirmed.
  `/net-worth` (new `features/netWorth/pages/NetWorthPage.tsx`) sums
  Cash/Bank/QSE/PSX/Funds as assets, nets Personal Loans by sign, and
  always subtracts EMI outstanding as a liability — combined per
  currency by new pure `lib/calc/netWorth.ts`. Rentals is shown
  separately as informational-only net income, never summed into net
  worth (property values aren't tracked, and the income already landed
  in Cash/Bank once — summing it again would double-count it). A real
  bug found during verification, not a design decision: an untouched
  QSE or PSX workbook was contributing a spurious "0" row in its
  default currency (QAR/PKR) even for a user who's never touched that
  exchange — fixed by only including an exchange's contribution when
  its workbook actually has at least one transaction/transfer/
  adjustment. Verified live via Playwright: Cash(500 USD)+Bank(250 USD)
  correctly summed to 750 USD in one section, QSE's QAR stayed
  separate, and after manually entering a QAR rate the grand total
  updated correctly (750 + 1000/3.64 ≈ 1024.73 → "1.02k USD") — zero
  console errors. `npx tsc -b` / `npm run test` (197 tests, 19 new) /
  `npm run build` all clean.
- **Critical, user-reported, same day (2026-08-24): PSX same-day
  (intraday) buys were charged full commission with no way to net
  until a matching sell was logged the same day — see README Done item
  67.** The user's own framing: "we are trying to do same day trade."
  The underlying fee-netting calc (`sameDayChargedSide()` in
  `psxFees.ts`) was already correct — it just has no way to net a lone
  buy against a sell that doesn't exist yet. Fixed at the UI-default
  layer instead: a new BUY dated today now has the existing "Same-day
  override" checkbox (`manualSameDay`) pre-checked automatically in
  both `TransactionsPage.tsx`'s add-row form (new `autoSameDay()`
  helper) and `StockPage.tsx`'s per-stock add form (which previously
  had **no** same-day control on add at all — a real gap, only its
  edit-row had one). **Design rule worth remembering for any future
  "smart default" checkbox**: the nudge only ever turns the flag ON
  when the row matches the target condition, never forces it OFF — so
  a manual override a user set for something else (here: a genuinely
  backdated trade, the checkbox's other real use case) survives editing
  an unrelated field instead of silently getting clobbered. Verified
  live via Playwright: fresh row pre-checks; switching action to SELL
  leaves a manual check alone; switching back to BUY (still dated
  today) re-checks it; unchecking then backdating the date does *not*
  force it back on. Zero console errors.
- **Critical, user-reported, same day (2026-08-24): prices displayed
  with fewer decimals than what was actually entered — see README Done
  item 68.** `fmtPrice()`'s 4-significant-figure rule (README item 3,
  still right for very cheap stocks) had a real side effect once a
  price cleared 3 digits: 123.456 displayed as "123.5" (1 decimal),
  1234.5 as "1235" (0 decimals) — a real entered buy price looking
  *less* precise on screen than what was typed, which is a trust
  problem for a finance app, not just a cosmetic one. Fixed with a
  floor: `Math.max(2, 4 - magnitude - 1)` instead of `Math.max(0, ...)`
  — never below 2 displayed decimals, small (sub-1) prices still get
  extra decimals via the same sig-fig logic as before. Since ~20 files
  across the app all route through this one shared `fmtPrice()` (Avg
  Cost, Break-even, Trade Calculator, etc.), fixing it once fixed all
  of them. Verified live via Playwright with a seeded 123.456 buy
  price: Avg Cost/Break-even both rendered with 2 decimals instead of
  the previous 1. `npx tsc -b` / `npm run test` (201 tests, 4 new) /
  `npm run build` all clean.
- **User-reported (repeated, same day 2026-08-24): more tables still
  missing sortable headers, "like Holdings in dashboard" — see README
  Done item 69.** Audited every `<table>` in the app for
  `useSortableRows` usage rather than trusting memory of what was
  already covered. Real gaps found and fixed: QSE/PSX Dashboard's
  Holdings preview table (the one named — was hardcoded to sort by P/L
  descending only), PSX's per-stock "Open lots (FIFO)" table, QSE's and
  PSX's per-stock "Recent updates" price-history table, and QSE's/PSX's
  Dividends "Yearly projection" table. All wired to the existing
  `useSortableRows` hook — no new component needed. Deliberately left
  alone: the Trade Calculator/Risk Analysis what-if ladders (a computed
  progression, not reorderable user data) and two tables that already
  had their own working sort before this pass (Dividends history's own
  hand-rolled `toggleSort`, PSX Trade Planner's legs table). **Lesson
  for future "is X still missing" reports**: grep for the actual
  pattern (`<table` without `useSortableRows` in the same file) rather
  than relying on what a past session's notes claimed was already
  done — this is the second time in this project a "surely that's
  already fixed" assumption turned out to have real gaps once actually
  checked.
- **Batch of live-testing feedback while the user was actively using
  PSX (2026-08-24) — see README Done items 70-72.** (1) Blank "Daily
  price" chart: `pointRadius:0` plus exactly one price-history point
  meant nothing was drawn at all (no line to connect, no dot to show)
  — fixed in both QSE's and PSX's `PositionDetail.tsx` by showing a
  dot when there's only one point. Verified via an actual canvas pixel
  read in Playwright, not just "no console error." (2) Trade
  Calculator now auto-selects the ticker from `/stock/:ticker` or
  `/psx/stock/:ticker` when opened from that page (`CalculatorLauncher.tsx`
  parses it from the route, passes a new `initialTicker` prop). (3) New
  shared `.price-input` CSS class (`theme.css`) fixes every narrow
  editable price field app-wide (Trade Calculator, Dashboard/Portfolio
  Holdings inline price cells, Watchlist target/current columns) —
  the base input's padding plus the browser's native number spinner
  left almost no room for digits in a ~80-110px box. Also confirmed
  (rather than assumed) that editable current-price inputs already
  exist in every relevant table the user asked about — nothing new
  needed there, just the sizing fix.
- **Transactions list split into Open/Closed sections + CollapsibleCard
  component built (2026-08-24) — see README Done items 73/74.**
  `TransactionsPage.tsx` (QSE and PSX) now splits its transaction table
  into two `<details>` sections by whether that ticker currently has
  `shares > 0` (via `positions` from `useQSEDerived()`/
  `usePSXDerived()`) — the existing ticker filter/group-by/sort all
  still apply first, then the result is split, so nothing about how
  filtering/sorting works changed, just how it's displayed. Refactored
  the shared table JSX into a local `renderTable()` function called
  twice (once per section) rather than duplicating ~90 lines of markup.
  Separately, new `CollapsibleCard` (`components/Card.tsx`) wraps a
  `Card` with a clickable, chevron-toggled header — a `headerExtra`
  slot (its own `stopPropagation`) keeps things like the Holdings
  card's "Full portfolio →" link independently clickable even while
  collapsed. Applied to QSE's and PSX's Dashboard Holdings and Alerts
  cards only, as a working vertical slice — **deliberately not rolled
  out to every Card in the app** in this pass (Portfolio, StockPage's
  Summary tab, chart cards, other modules) given the sheer number of
  call sites and the value of shipping something verified over
  something broad and untested; the component itself is ready to drop
  into any of them next (see README Pending item 42). Verified live
  via Playwright: transactions split correctly by real open/closed
  status with correct per-section counts and working Edit; collapsible
  headers toggle `aria-expanded` and hide/show body content, with the
  Holdings card's link staying visible/clickable while collapsed.
  `npx tsc -b` / `npm run test` (201 tests, unchanged — UI
  restructuring, no calc logic touched) / `npm run build` all clean.
- **Trade Planner "Clear plan" + collapsed-by-default + colorful
  stat cards + darker/greyer page background (2026-08-24) — see
  README Done items 75/76.** Trade Planner: a "Clear plan" button
  (shown only when a plan has legs) removes every leg for a fresh
  start without deleting the plan record itself; `PlanCard`'s
  `collapsed` state now defaults `true`; saved plans get 28px spacing
  instead of 16px. Separately, a real gap was found (not a design
  decision): `.stat-card`'s CSS in `theme.css` already read a
  `--card-hue` variable for its colored left-border/tint, but nothing
  anywhere ever set it, so every stat card silently rendered the same
  flat color regardless of what it showed — exactly matching a
  user report that the dashboard felt monochrome/hard to visually
  parse. Fixed by adding a `hue` prop to `StatCard` and assigning each
  Dashboard stat a distinct color (reusing the same `INVEST_PALETTE`
  hexes the charts already use for non-P/L stats, `var(--profit)`/
  `var(--loss)` sign-driven for P/L stats). Also lifted the dark
  theme's `--bg`/`--panel`/`--panel-2` (they sat too close in
  lightness — genuinely flat, not just a taste call) and nudged the
  light theme's `--bg` greyer, keeping the same relative ordering.
  Verified via actual before/after screenshots in both themes, not
  just described intent — every stat card now shows a distinct color,
  panels visibly separate from the page background in both light and
  dark mode. **Not yet applied beyond QSE/PSX's Dashboard** (Portfolio,
  StockPage, other modules' stat cards) — the `hue` prop and
  `CollapsibleCard` component are both ready to reuse; rollout tracked
  as separate Pending items rather than done blind everywhere in one
  pass.
- **Critical regression fixed same day (2026-08-24), self-inflicted by
  an earlier fix this session — see README Done item 77.** The
  same-day auto-check fix (Done item 67) only ever nudged
  `manualSameDay` ON, per its own explicit design ("never forces it
  off, so a manual override... survives editing an unrelated field")
  — but that rule was wrong for one specific transition: a fresh row
  defaults to BUY+today (auto-checked), and switching that *same row's*
  action to SELL (instead of adding a new row) left the stale `true`
  in place, since the helper only skipped setting `true`, never reset
  to `false`. `isNettedLeg()` trusts a manual flag unconditionally by
  design, so once both legs of a real pair carried it, both came out
  netted — the user's exact report: "buy and sell both have 0 fee."
  **Lesson**: a "only ever nudge forward, never backward" default rule
  needs to identify precisely which state transitions genuinely call
  for forward-only, since here the BUY→SELL transition on a same-day
  row needed an explicit reset, not just "don't set true." Fixed in
  `TransactionsPage.tsx`'s `autoSameDay()` and `StockPage.tsx`'s
  inline equivalent: for a today-dated row, SELL now explicitly resets
  to `false` (BUY still defaults `true`); a non-today date is left
  exactly as the user set it, either direction. New regression test in
  `psxFees.test.ts` documents the exact failure at the calc-engine
  boundary (both legs netted when both wrongly carry the flag) — the
  calc engine itself was never wrong, this was purely a UI-defaulting
  bug. Verified live via Playwright: switching a fresh BUY-today row's
  action to SELL now correctly unchecks the box.
- **Critical, root-caused against the user's own real uploaded workbook
  backup (2026-08-24) — see README Done item 78.** "I have entered
  today's prices but graph isn't picking them." `computePriceStats()`
  built min/max/median and the trend chart's data from
  `getDailyPriceHistory()`'s day-collapsed series (one point per
  calendar day, last update wins) — so a ticker updated several times
  in one trading day had all but the final update silently discarded.
  Confirmed directly with the user's real OGDC data (8+ intraday
  updates that day): Lowest/Median/Highest all read the identical
  collapsed value, and the chart plotted one flat point. Fixed by
  computing those from the **raw** per-update log (sorted by real
  timestamp) instead — a once-a-day ticker is unaffected (raw ==
  daily in that case), a many-updates-a-day ticker now shows genuine
  movement. **Lesson for future "X isn't working" reports where the
  user can attach a real data file**: seed the exact uploaded JSON
  into a local Playwright session and read the real computed output
  (DOM text, canvas pixel counts) rather than reasoning about a
  synthetic case — this bug was invisible with a single seeded price
  point (which is what earlier verification in this session used) and
  only showed up once multiple same-day updates were actually present.
  Verified before/after against the real file: Price Range went from
  all-three-identical with a near-blank chart (63 non-transparent
  canvas pixels) to three genuinely different values with a real
  visible trend line (35,804 non-transparent pixels).
- **Same-day/fee UI consolidated into a three-mode selector (2026-08-24)
  — see README Done item 79.** User complaint: "Same-day override" and
  "Fee override" were two independent controls shown at once with no
  indication that setting one made the other pointless. Before
  building, web-researched PSX's real same-day-square-off convention
  (confirmed: one side only pays commission, the larger-quantity side
  — matching the app's existing rule and the user's own report about
  their broker, "Zindagi"). New `components/ui/FeeModeControl.tsx`:
  a single Auto/Semi/Manual selector whose mode is *derived* from
  which of `manualSameDay`/`feeOverride` is set (never stored
  separately), so switching modes clears the field the new mode
  doesn't use — the two can't conflict again. Wired into all four PSX
  fee-entry locations (`TransactionsPage` add-row + edit-row,
  `StockPage` add-form + edit-row). Verified live: fresh row starts in
  Semi with "Netted" pre-checked; Manual/Auto correctly show/hide the
  right control; zero console errors.
- **Sold-price stats + "fair value" labeling on the per-stock page
  (2026-08-24) — see README Done item 80.** User asked for a sold price
  to be visible and for a way to "find fair market value" from their own
  data. Trade history already existed (StockPage's Transactions tab);
  added **Avg sell price**/**Last sell price** stat cards to "All-time
  stats" (shown only when the ticker has a sell) and relabeled the
  existing Price-range "Median" stat to "Median (fair value)" with a
  tooltip — it was already computing correctly (fixed the same session,
  see the raw-price-history fix above) but wasn't described as what it
  is. No new calc logic, just surfacing already-available transaction
  data. Applied identically to QSE's and PSX's `PositionDetail.tsx`.
  Verified live: seeded two-buy/two-sell OGDC position showed Avg sell
  125.00, Last sell 130.00, Median (fair value) 120.00 — all correct,
  zero console errors.
- **Trade Planner leg/transaction sync + same-day fee linking + fee-mode
  labels, three related fixes (2026-08-24) — see README Done item 81.**
  (a) "Mark as done" copied a leg's data into a new Transaction but never
  linked the two records again, so editing the transaction afterward
  never showed up back in the plan — a real, reported sync bug. Fixed by
  retrofitting a stable `id` onto `Transaction` (same pattern as
  `Transfer.id`, backfilled by `createWorkbookStore.ts`'s `normalize()`)
  and a new `TradePlanLeg.executedTransactionId`; the Trade Planner now
  resolves an executed leg's displayed values from the **live** linked
  transaction, falling back to the leg's own snapshot only if unlinked or
  the transaction was deleted. (b) Separately, `analyzeTradePlanByTicker`'s
  per-leg fee estimate had no awareness of a plan's *other* legs, so a
  same-day BUY+SELL pair within one plan (the core "trade cycle" use case)
  was charged full commission on both legs instead of PSX's real
  same-day-netting rule. Fixed with a new `calcLegFee` parameter
  (defaults to the old behavior) — `TradePlannerPage.tsx` builds a
  same-day-aware fee calculator from the plan's own pending legs layered
  on the real transaction log. (c) `FeeModeControl`'s fields relied only
  on hover `title` tooltips — invisible on mobile — now have visible
  `Field` labels. Verified live via Playwright: same-day BUY(100)/SELL(50)
  correctly showed BUY charged 23.00 PKR and SELL netted to 0.00 PKR;
  editing a marked-done leg's linked transaction (100→150 shares,
  100→110 price) correctly updated the plan's row on next view. Zero
  console errors.
- **Accordion (CollapsibleCard) rollout, round 2 (2026-08-24) — see
  README Done item 82.** User repeated the "cards should be
  collapsible" request after round 1 (Done item 74) only covered
  Dashboard's Holdings/Alerts. This pass wrapped QSE's/PSX's
  `PositionDetail.tsx` (all 4 sections — previously plain `<h4>` blocks
  with no Card at all) and every non-exchange module's display-only
  landing sections: Cash/Bank's "By category"/"Balance projection"/
  "Plans", Rentals' "By category"/"Monthly rollup", EMI's per-loan
  "Schedule," Funds' "Transactions," Transfers' "Linked transfers."
  Deliberately skipped: input forms (collapsing mid-fill is a UX trap)
  and Personal Loans' `RepaymentsSection` (form+list are one combined
  component, no clean seam). Verified live via Playwright across every
  touched page — zero console errors, headers actually toggle
  (`aria-expanded` flips on click).
- **Raw-vs-concise number toggle + running-balance columns where genuinely
  missing (2026-08-24) — see README Done items 83/84.** New Appearance →
  "Number display" setting (`compact`/`raw`, default `compact` — no
  behavior change unless the user opts in) backed by a shared
  `hooks/useAmountFormat.ts` hook, wired into `MoneyValue`, both
  Dashboards' 9 stat cards each, and Cash/Bank's "upcoming plans"
  sub-lines — replacing every direct `fmtMoneyCompact`/`fmtCompact` call
  at those sites. Separately, audited every transaction-style table for
  a running balance rather than assuming — Cash/Bank already had one;
  QSE's/PSX's Transfers section (deposits/withdrawals) and Personal
  Loans' repayments list did not. New `lib/calc/transferBalance.ts`
  and `personalLoansModule.ts`'s `repaymentRunningOutstanding()` add a
  "Balance"/"Remaining" column to each, computed independent of the
  table's current sort (same pattern as the Trade Planner's leg-value
  resolution). Verified live: number toggle switched and persisted
  correctly across reload; both new balance columns matched
  hand-calculated running totals exactly on seeded multi-entry data.
- **Real popup tooltips + grouped-column Holdings redesign (2026-08-24) —
  user posted a direct screenshot comparison against a competitor stock
  page ("clean, compact info rich UI... you are making useless UI") — see
  README Done item 85.** Two concrete fixes from that comparison: (a) the
  PSX add-transaction form's permanent 4-line explanatory paragraph
  became one sentence + a new `InfoIcon` that opens a real tooltip on
  demand; (b) QSE's/PSX's Dashboard Holdings table columns were regrouped
  from five one-fact columns into four grouped ones — Stock (ticker+
  name), Cost (avg+break-even), Value (worth+invested+▲/▼), P/L
  (amount+%) — directly matching the user's own earlier example. New
  shared `components/Tooltip.tsx` backs `StatCard`/`MoneyValue`/
  `FeeModeControl`'s tooltips instead of native `title`. **Real bug found
  while verifying, not assumed away**: a naive "always above the
  trigger" tooltip clipped off-screen for a long tooltip near the top of
  a page — confirmed via an actual screenshot, fixed with a two-pass
  measure-then-place approach (mount hidden, measure real height, place
  above only if it fits, else below), using `position: fixed` so a
  trigger inside a scrollable table never gets clipped by the
  container's own overflow either. A 23-page Playwright sweep found zero
  new console errors. Scope: covers Dashboard + the add-transaction
  form; Portfolio's tables, StockPage, and other modules still use the
  old layout/tooltips — tracked as Pending, not silently dropped.
- **Portfolio page columns regrouped (2026-08-24), continuing the same
  pattern — see README Done item 86.** The Portfolio Holdings table
  (QSE+PSX) was the densest table in the app at 11 columns; regrouped to
  8 by merging Avg Cost+Break-even into "Cost", adding a P/L percentage
  next to the amount, and collapsing the three separate +1%/+2%/+5%
  exit-target columns into one stacked "Exit targets" cell. Verified via
  screenshot with a seeded up/down pair of positions — zero console
  errors.
- **StockPage/PositionDetail regrouped + colorized (2026-08-24), same
  continuation — see README Done item 87.** The per-stock page's stat
  cards were still flat single-color, one-fact-each. Merged Avg cost +
  Break-even into one "Cost" card (BE colored against current price,
  matching Dashboard/Portfolio), Total bought/sold into "Bought / Sold",
  Avg/Last sell price into "Sell price", First/Last trade into "Trade
  dates", and gave every stat card on the page (Current position,
  All-time stats, Price range) a distinct `--card-hue` color — StockPage
  had never gotten the colored-stat-card treatment Dashboard got earlier.
  Verified via screenshot with a real multi-buy/multi-sell position —
  zero console errors.
- **StatCard hue rollout finished for every module (2026-08-24), closes
  README item 43 — see Done item 88.** Extracted the hue palette/helper
  (previously copy-pasted per file starting with Dashboard, then again
  for StockPage) into a shared `lib/statCardHues.ts`, and colored Cash's/
  Bank's balance cards, Personal Loans' net position, EMI's monthly/
  outstanding/paid, Funds' invested/value/profit, and Rentals' net
  income — every module's landing summary now has the same colored
  stat-card treatment Dashboard originally got. Verified via a 6-page
  Playwright sweep with seeded data (zero console errors) plus
  screenshots confirming colors render.
- **Table-cell tooltip sweep (2026-08-24) — see README Done item 89.**
  Converted the remaining scattered native `title=` spots the earlier
  Tooltip rollout (Done item 85) had left unswept: PSX's Fee column
  "(netted)"/"(override)" tags in `TransactionsPage.tsx`/`StockPage.tsx`,
  and the Trade Planner's stale-snapshot `*` marker / "Executed" sync
  indicator. Verified live: hovering a seeded same-day BUY/SELL pair's
  "(netted)" tag shows a real `role="tooltip"` popup, zero console
  errors.
- **Banking Analytics tab built (2026-08-24), third module of README
  item 23's "per-module Analytics" wave — see MODULES_PLAN.md §11.**
  An account picker (per-account data, not per-currency
  like Cash) scopes Balance-over-time (Line), Category breakdown
  (Doughnut, spend-only), and Income-vs-spend-by-month (new
  `bankMonthlyFlow()`). Also a budget tool: new `BankSettings.budgets`
  (category -> monthly target, optional field) + `setBudget` action,
  compared against actual spend via new `budgetVsActual()` — a category
  with spend but no target still shows (target reads "—"). Verified
  live via Playwright with a seeded account: balance/category/flow
  charts all matched hand-calculated numbers, budget table correctly
  flagged an over-budget category in red, "Add budget category" hit
  the sign-in gate. `npm run test` (224 tests, 5 new) clean. Next per
  MODULES_PLAN.md §11: EMI/Loans, then Funds, then Rentals.
- **EMI/Loans Analytics built (2026-08-24), fourth module of the same
  wave — see README Done item 91, MODULES_PLAN.md §11.** Both live
  inside a loan's own `LoanDetail` view (`EMIPage.tsx`), not a separate
  tab: an "Amortization schedule" stacked bar chart (Principal vs.
  Interest/Markup per month, from the already-existing `emiSchedule()`
  — no new calc needed) and a "What if: extra payment" live planner —
  new `whatIfExtraPayment()` in `lib/calc/emiModule.ts` handling both
  repayment modes (`interest`: reruns the reducing-balance formula with
  a larger monthly payment until the balance clears, capped at the
  original tenure; `fixedTotal`: `Math.ceil(principal /
  (principalPerMonth + extra))` months, markup prorated by the new
  month count — documented as a simplification, not a claim about any
  specific lender's real early-payoff terms). Both the page's existing
  7 stat cards and the what-if planner's 3 result cards got the
  `--card-hue` colored treatment (same rollout as Done item 88).
  Verified live via Playwright with a seeded $10,000/12mo/12%-p.a.
  loan: amortization chart correctly showed principal rising/interest
  falling month-to-month, and a $100/month extra payment correctly
  projected 11 months (1 sooner), new end date 2026-12-01, $65 interest
  saved — matching the unit tests exactly. `npx tsc -b` / `npm run
  test` (228 tests, 4 new) / `npm run build` all clean. Next per
  MODULES_PLAN.md §11: Funds, then Rentals.
- **Funds Analytics built (2026-08-24), fifth module of the same wave —
  see README Done item 92, MODULES_PLAN.md §11.** New Analytics tab on
  `FundsPage.tsx`: a currency picker (multi-currency only) plus a fund
  picker scope three charts. "Allocation by category" (Doughnut, new
  `allocationByCategory()` in `lib/calc/fundsModule.ts`) sums current
  value per category across every fund in the picked currency, omitting
  a fund with zero current value. "NAV over time" (Line) reuses the
  already-existing `getDailyPriceHistory()` as-is. "Contribution vs.
  value" (Line, two series) is the new piece worth remembering: new
  `contributionVsValueSeries()` walks every date something is known (a
  transaction or a NAV update) and tracks cumulative net invested next
  to actual position value — **deliberately treats each transaction's
  own price as an implicit NAV observation** when no explicit "Update
  NAV" exists for that date (same fallback idea as `getMarketPrice`'s
  "last BUY price" rule), so a fund with zero manual NAV updates still
  gets a meaningful value line instead of a flat zero. Verified live
  via Playwright with two seeded USD funds (one with NAV history, one
  without): allocation doughnut correct, NAV-over-time traced its price
  history correctly, contribution-vs-value showed Invested/Value
  diverging correctly for the fund with history — and switching to the
  NAV-less fund correctly emptied only that one chart while
  contribution-vs-value still plotted its one known point from the
  implicit buy-price fallback. `npx tsc -b` / `npm run test` (234
  tests, 6 new) / `npm run build` all clean. Next per MODULES_PLAN.md
  §11: Rentals — the last module in this wave.
- **Rentals Analytics built (2026-08-24), sixth and final module of the
  per-module Analytics wave — see README Done item 93,
  MODULES_PLAN.md §11. This closes out README item 23 in full: every
  one of the six non-exchange modules now has an Analytics tab.** A
  currency picker (multi-currency only) plus a property picker scope
  three charts: "Net income by property" (horizontal Bar, new
  `netIncomeByProperty()` in `lib/calc/rentalsModule.ts` — portfolio-
  wide, one row per property in the picked currency, mirroring Personal
  Loans' "Outstanding by loan" chart) is the only genuinely new
  portfolio-wide view; "By category" (Doughnut) and "Monthly rollup"
  (Bar) for the selected property just chart the already-existing
  `propertyByCategory()`/`propertyMonthlyRollup()` that already fed
  plain tables in the Entries tab — this adds a charted view alongside
  them, doesn't replace the tables. Verified live via Playwright with
  two seeded USD properties (Apartment 4B net +2,800, Studio 2A net
  -100): the property bar chart correctly color-coded the negative
  property red, and switching the property picker correctly updated
  both other charts to that property's own numbers. `npx tsc -b` /
  `npm run test` (235 tests, 1 new) / `npm run build` all clean.
- **Statement CSV export extended to Personal Loans and EMI/Loans
  (2026-08-24) — see README Done item 94, extending Banking's pattern
  from Done item 58.** Personal Loans' `LoanDetail` gets a from/to
  date-range "Export CSV" button next to its repayments table
  (Date/Amount/Remaining/Source, reusing the same running-outstanding
  map the table already shows). EMI's `LoanDetail` gets an "Export
  full schedule CSV" button under its Schedule card, exporting every
  remaining installment (not just the next-12 slice on screen) with
  its due date via `installmentDueDate()`. Both reuse the existing
  `toCSV()` helper, no new export logic. Verified live via Playwright
  with a real file download read off disk: Personal Loans' Remaining
  column matched hand-calculated running balances, EMI's CSV had
  exactly 13 rows (header + 12 months). `npx tsc -b` / `npm run test`
  (235 tests, unchanged) / `npm run build` all clean. Still open per
  README item 40: QSE/PSX positions, Funds, Rentals don't have this
  export yet.
- **Statement CSV export extended to Funds and Rentals (2026-08-24) —
  see README Done item 95, completing item 40 for every module except
  QSE/PSX.** Funds' `FundDetail` gets the same from/to date-range
  "Export CSV" button below its Transactions table; Rentals' per-
  property `EntriesList` (Income & expenses tab) gets it below its
  entry table. Both reuse `toCSV()`, no new logic. Verified live via
  Playwright with real file downloads read off disk, matching seeded
  data exactly. `npx tsc -b` / `npm run test` (235 tests, unchanged) /
  `npm run build` all clean. **Only QSE/PSX positions remain for item
  40** — needs its own short design pass since a stock statement
  plausibly wants both the trade log and price-history log, not just
  one table.
- **Statement CSV export extended to QSE and PSX, completing README
  item 40 for every module (2026-08-24).** Exported the two logs
  separately rather than merging them: each stock's Transactions tab
  (`TickerTransactions` in both QSE's and PSX's `StockPage.tsx`) gets
  the same from/to date-range "Export CSV" button as every other
  module (PSX's also includes a Fee column, since its fees are
  variable unlike QSE's flat rate); `PositionDetail.tsx`'s "Recent
  updates" section gets a separate "Export price history CSV" button
  exporting the full raw price log (`stats.chronological`), not just
  the 8-row "recent" slice shown on screen. Verified live via
  Playwright with real file downloads for all four combinations
  (QSE/PSX × trade statement/price history) — each matched seeded
  data exactly, including PSX's computed per-row fee. `npx tsc -b` /
  `npm run test` (235 tests, unchanged) / `npm run build` all clean.
  **README item 40 is now fully done** — every module has a statement
  export from its own primary record's detail view.
- **Portfolio's closed-positions (History) table regrouped, completing
  README item 45 (2026-08-24).** QSE's/PSX's `ClosedPositionsTable`
  went from 8 one-fact columns to 4 grouped ones — Stock (ticker+
  name), Bought / Sold, P/L (realized amount + fees paid as a
  sub-line), Trade dates (first → last) — the same grouping pattern
  already used for the Holdings table and StockPage's stat cards.
  Verified via screenshot with two seeded closed positions (one
  profit, one loss) — all 4 columns render correctly, P/L
  color-coded. `npx tsc -b` / `npm run test` (235 tests, unchanged —
  UI-only) / `npm run build` all clean. This closes out README item
  45 in full.
- **Further tooltip sweep, continuing README item 47's remainder
  (2026-08-24).** Converted the highest-value remaining native
  `title=` spots to the real `Tooltip` component: QSE's/PSX's
  `PositionDetail.tsx` "Sell price"/"Median (fair value)" stat cards
  (these predate `StatCard`'s own built-in `title`-to-`Tooltip`
  wiring, so an earlier rollout missed them), Personal Loans'
  repayments "Remaining" column, and QSE's/PSX's Transactions
  "Balance" column — the latter two are exactly the "per-transaction
  table cells" item 47 named as unswept. Deliberately left as native
  `title`: single-word `<select>` labels (Appearance pickers — option
  text already self-explanatory) and import-flow "Flip sign"
  checkboxes (an explanatory paragraph already sits above them) —
  lower value, more invasive to convert, not overlooked. Verified via
  Playwright **hover** (not click, since click toggles state): all 3
  conversions showed a real `role="tooltip"` popup with correct text,
  zero console errors. `npx tsc -b` / `npm run test` (235 tests,
  unchanged) / `npm run build` all clean.
- **New Subscriptions module built (2026-08-24) — README item 24,
  seventh module beyond the original six, per MODULES_PLAN.md §12.**
  Tracks recurring payments (streaming, gym, software, memberships)
  independently, with an optional link to whichever Bank account or
  Cash pays them. Reuses `createEntryStore` (same shape as EMI/Cash),
  own Firebase path `users/{uid}/subscriptions`. Cancelling sets
  `active: false` + `cancelledDate` instead of deleting, so spend
  history survives. **Resolved MODULES_PLAN.md §12's open design
  question** ("auto-generate a linked transaction, or just track
  existence/cost?") in favor of the lighter generate-a-planned-entry
  pattern EMI/Loans' "Link to bank" and Rentals' lease-projection
  already shipped, rather than the heavier full bidirectional
  cross-entity-link record — "Generate renewal plans" creates a
  `PlannedBankTransaction`/`PlannedCashEntry` per upcoming occurrence
  (new `sourceSubscriptionId` field on both types, mirroring EMI's
  `sourceEmiLoanId` for safe re-linking). New `lib/calc/
  subscriptionsModule.ts`: `nextBillingDate()`/`monthlyEquivalent()`
  (normalizes monthly/yearly/weekly/custom-days cycles to a comparable
  per-month figure), `totalMonthlySpendByCurrency()`,
  `upcomingRenewals()`, `spendByCategory()`, and
  `generateRenewalOccurrences()` (12-month horizon, same "12 means 12
  points not 13" off-by-one fix already applied in `rentalPlanning.ts`).
  Analytics tab covers all four items the plan named: monthly/yearly
  spend, upcoming renewals (30 days), spend by category, spend by
  paying account. New tests: `subscriptionsModule.test.ts` (14 cases).
  Verified live via Playwright with two active + one cancelled seeded
  subscription: landing list, Monthly recurring spend total, the
  "Generate renewal plans" flow (12 correct monthly occurrences, hit
  the sign-in gate), and all three Analytics charts matched
  hand-calculated numbers — zero console errors. `npx tsc -b` / `npm
  run test` (249 tests, 14 new) / `npm run build` all clean.
- **Funds added as a cross-entity-linking module — README item 21's
  remainder (2026-08-24), see Done item 100.** Exposed Funds' hidden
  `Transfer` field (inherited unused from `createWorkbookStore`) in
  the Transfers page — since `FundsWorkbook` already uses the exact
  same `Transfer` type as QSE/PSX, `lib/interEntityLink.ts`'s
  `buildSideRecord` just folds `'funds'` into the existing `case
  'qse': case 'psx':` branch (DEPOSIT/WITHDRAWAL, zero fee), and
  `lib/linkCascade.ts`'s three dispatch switches gained a `funds` case
  using `useFundsWorkbookStore`'s existing `addTransfer`/
  `updateTransfer`/`deleteTransfer`. `isSupportedLinkPair` allows
  Bank/Cash↔Funds only (same "hub modules only" rule every other
  linked module follows). **One real design call**: Funds has no
  single portfolio currency (funds can be added in different
  currencies) — `TransferLinksPage.tsx` uses `settings.defaultCurrency`
  as the Funds side's display currency, matching the same implicit
  single-currency assumption `useFundsDerived`'s own already-unused
  `cashSummary`/`buildCashLedger` calls already made. New tests:
  `interEntityLink.test.ts` gained 2 `buildLinkedRecords` cases plus
  extended `isSupportedLinkPair` coverage. Verified live via
  Playwright (same reduced-verification precedent as Rentals/Personal
  Loans linking — no real signed-in round-trip against the production
  Firebase project): selecting Funds as either side shows the correct
  currency, no unsupported-pair warning fires, zero console errors.
  `npx tsc -b` / `npm run test` (251 tests, 2 new) / `npm run build`
  all clean. **EMI is now the only unlinked module** — it has no
  repayment ledger at all to link into, a data-model question, not a
  UI gap.
- **Chart cards made collapsible app-wide — README item 42's
  remainder (2026-08-24).** Every module's Dashboard/Analytics charts
  render through one shared `features/qse/components/ChartCard.tsx` —
  changing that single component to build on `CollapsibleCard`
  instead of a plain `Card` made every chart in the app collapsible
  in one place (same fix-once-at-the-shared-layer pattern as
  `MoneyValue`/`StatCard`/`Field`). Defaults open, so no chart's
  default visibility changed. Verified live via Playwright with a
  real canvas-count check on the QSE Dashboard: collapsing one chart
  dropped canvas count 2→1, reopening restored 2→2, confirming the
  chart genuinely unmounts/remounts cleanly (same mechanism already
  proven for EMI's Amortization chart). `npx tsc -b` / `npm run test`
  (251 tests, unchanged) / `npm run build` all clean. Still not
  collapsible, deliberately: Portfolio's Holdings/History tables and
  Personal Loans' `RepaymentsSection` (see README item 42).
- **PSX Trade Planner's Saved Plans made into a real accordion header,
  user-reported (2026-08-24) — see README Done item 102.** Two
  complaints: clicking the card header did nothing (a separate
  "Expand"/"Collapse" button did the actual toggling), and the action
  buttons sat "hanging in between" instead of staying right-aligned.
  Root cause: `PlanCard` hand-rolled its own header instead of using
  the `CollapsibleCard` component already used everywhere else for
  this exact pattern. Rewired onto `CollapsibleCard`: the plan name/
  meta (or, mid-edit, the rename form) is the `title` (clicking it
  toggles the accordion); the four action buttons move into
  `headerExtra`, which already renders right-aligned and stops click
  propagation so those buttons never also toggle the accordion. The
  rename form's own container gets an explicit `stopPropagation` too,
  so its inputs/Save/Cancel don't double-fire the toggle. Full-screen
  mode is untouched (a fixed-overlay view that always shows everything,
  never had its own collapse toggle). Verified live via Playwright:
  header click correctly toggled `aria-expanded` true↔false, clicking
  "Edit" opened the rename form while staying expanded and the button
  row stayed right-aligned, full-screen mode unaffected — zero console
  errors. `npx tsc -b` / `npm run test` (251 tests, unchanged) / `npm
  run build` all clean.
- **Design-system critique, 11-item batch fixed (2026-08-24) — see README Done item 103.**
  User posted a screenshot of PSX Risk Analysis plus 11 cross-cutting UI/UX complaints.
  Root-caused several as genuine, confirmable defects rather than taste calls: `theme.css`'s
  base `a{color:inherit;}` never reset `text-decoration`, so every `<Link>`/`<a>` app-wide
  rendered underlined (one-line fix); the exact same ad hoc
  `borderLeft:'3px solid var(--warn, orange)'` "warning" `<div className="card">` was
  copy-pasted across **15 call sites in 13 files** (12 identical cloud-sync-empty warnings
  plus 2 in `RiskCalculator.tsx`) — replaced with a new `components/Notice.tsx` (tone: info/
  warning/danger/success, full tinted background + border, no left bar, a leading icon) and
  matching `.notice`/`.notice-*` CSS; `theme.css`'s `.card`/`.card.stat-card`/
  `.card.chart-card` box-shadow and border-left rules had **3-4 competing definitions**
  accumulated from repeated "add an override further down so it wins" patches — confirmed
  which one actually won (same-specificity, later-in-file wins) and deleted the dead losers,
  replacing the survivors with new `--shadow-card`/`--shadow-lg`/`--radius-lg` tokens so every
  card-family shadow references one of two named values instead of inventing its own numbers.
  `RiskCalculator.tsx`'s stat cards had been missed by the earlier app-wide `StatCard` `hue`
  rollout (README Done item 88) — added `hueStyle()` there too (profit/loss-driven for P/L
  cards). **The biggest structural fix**: the shared `components/Tabs.tsx` (used by Analytics/
  Transactions/Settings/every tabbed sub-page in the app) fully unmounted every non-active
  tab's content, which is exactly the "keep pressing chips just to view a small piece of
  info" the user described — rewrote it so every section renders as its own
  `CollapsibleCard` (only the first one open by default, same as before) and a chip click now
  scrolls to + force-opens that section instead of hiding the others; nothing is ever
  unreachable, just further down the page. This needed `CollapsibleCard` itself to gain an
  optional controlled `open`/`onToggle` pair — additive, so its ~30 existing call sites keep
  their original self-contained-state behavior untouched. Also added a small
  "(whole portfolio — not filtered)" badge (new `ChartCard` `unfiltered` prop) to the 5
  whole-portfolio Analytics charts that intentionally ignore the ticker/month filter — the
  user's own concrete example of "filters work on some charts and not others" was exactly
  this, previously explained only in a filter-bar paragraph easy to scroll past.
  **Verified live via Playwright, not just described**: Avg buy price showed exactly 2
  decimals against a real fee-inclusive cost basis (was previously an unrounded division
  result); every `<a>` on the Dashboard read `text-decoration-line: none`; the two
  `RiskCalculator` `Notice` boxes rendered as a green banner and a gold box with no left bar
  (screenshot-confirmed); the Transactions page's Tabs redesign showed `aria-expanded` go
  from `[true,false,false,false,false,false]` to `[true,true,false,false,false,false]` after
  clicking the second chip — both sections visibly open, the other 4 visible-but-collapsed on
  the same page; Analytics showed the same pattern plus the new unfiltered badge; zero
  console errors smoke-checked separately across Settings/PSX Settings/Bank/Subscriptions.
  `npx tsc -b` / `npm run test` (251 tests, unchanged — no calc logic touched) / `npm run
  build` all clean. **Deliberately deferred** (see README Pending items 48-50): body font
  choice for continuous-reading legibility, a genuine "assess a stock in one go" information-
  architecture redesign, and making themes/densities structurally different rather than
  color/spacing swaps — all three are large, subjective, high-regression-risk redesigns that
  need their own scoped session.
- **Trade Planner follow-up, user-reported mid-session right after the batch above
  (2026-08-24) — NOT yet investigated/fixed, see README Pending items 51-53.** (1) Every
  record type should carry a stable unique id "like a good RDBMS ERD" — several types were
  only retrofitted with ids as-needed for cross-entity linking (`Transfer`/`CashEntry`/
  `PersonalLoanRepayment`/`RentalEntry`/`Transaction`), not as a general audit; `Adjustment`/
  `Dividend`/`WatchlistItem`/`TradePlanLeg`/Funds' own CRUD remain index-addressed. (2) Real
  bug report: editing an already-executed Trade Planner leg's linked Transaction (correcting a
  share count) didn't update the plan's displayed figures, even though README Done item 81's
  design was specifically meant to resolve an executed leg's display from the *live* linked
  transaction via `TradePlanLeg.executedTransactionId` — needs investigation into why that
  resolution isn't reflecting the edit (could be the specific display the user checked doesn't
  route through it, the id isn't surviving the edit flow, or something else not yet found).
  User also wants the linked transaction directly editable from the Trade Planner itself, not
  just cross-referenced. (3) Real design gap: the planner always prices a leg at full
  commission, hiding the cheaper same-day-round-trip price a Transaction itself would get
  automatically — user wants both the same-day and non-same-day price/fee shown side by side.
  Also flagged as UX: the per-ticker summary table is visually buried under the leg-editing UI
  and easy to miss — suggested colored summary cards. None of this is built yet; do NOT assume
  Done item 81 already covers it just because it sounds related — the user is reporting these
  as currently-broken/currently-missing against the live app.
- **Trade Planner follow-up batch fixed (2026-08-24) — see README Done item 104, closes
  Pending items 51-53.** (1) `Adjustment`/`Dividend` gained `id?: string` (same optional-
  retrofit pattern as `Transaction`/`Transfer`, backfilled by `createWorkbookStore.ts`'s
  `normalize()`) — a partial answer to the id-audit ask, not a full addressing switch (their
  update/remove actions stay index-based since nothing needs to reference one specifically
  yet). (2) **Traced the "stale after edit" bug end to end and found the live-resolution
  mechanism itself was already correct** — `TransactionsPage.tsx`'s and `StockPage.tsx`'s edit
  flows both preserve the real global array index (and therefore the transaction's `id`)
  through filtering/sorting/grouping, confirmed by reading the code, not assumed. The much
  more likely explanation: the user's specific leg was executed *before* Done item 81's link
  existed at all (same very long session — easily older test data), so it simply had no
  `executedTransactionId` to resolve from and silently fell back to its frozen snapshot with
  only a barely-visible "*" as a clue. **Lesson for any future "the linking feature doesn't
  work" report**: check whether the record predates the linking feature before assuming the
  resolver itself is broken — a resolver with nothing to resolve from isn't a bug in the
  resolver. Fixed the actual gap: a stale/unlinked executed leg now shows a red "Executed
  (unlinked)" status and a "Link…" button opens an inline picker to manually establish the
  missing link (deliberately manual, not a fuzzy auto-match, since guessing wrong would link
  the wrong transaction). Also built the user's second ask: a linked leg's transaction is now
  directly editable inline from the Trade Planner (looks up the transaction's current array
  index by its stable id right before saving, not a captured-up-front index that could go
  stale). (3) New `feeScenarios()` in `psxFees.ts` (pure, tested) shows both the full-
  commission and same-day-netted fee for every pending leg side by side, independent of what
  else is in the plan — shown *alongside*, not replacing, the existing automatic best-guess
  fee. Added a row of colored `StatCard`-style summary cards (avg cost/break-even/shares-
  after-plan/planned P&L per ticker) above the detailed table for an at-a-glance read.
  **Verified live via Playwright**: seeded a stale unlinked leg, linked it through the picker,
  edited its now-linked transaction's shares inline, and confirmed both the UI and
  `localStorage` reflected the change; confirmed the fee-scenario note is a genuine second
  DOM line via `getComputedStyle` (a screenshot at test resolution made it look squeezed
  together, which would have been a false "bug" if trusted without the layout check) — zero
  console errors. New tests: `psxFees.test.ts` gained 2 cases. `npx tsc -b` / `npm run test`
  (253 tests, 2 new) / `npm run build` all clean.
- **PSX Risk Analysis 7-item feedback batch + single-ticker Trade Plans (2026-08-24) — see
  README Done item 105.** Replaced RiskCalculator's "Additional capital" field with a 3-way
  linked Target buy price/Target shares to buy/Target amount calculator (confirmed the exact
  design via AskUserQuestion first, since the request was genuinely ambiguous) — also fixes a
  real modeling gap, since the old field always priced every scenario at the live Current
  price with no way to model a different (e.g. limit-order) buy price. Collapsed the
  Dashboard's Alerts card by default (it had no `defaultOpen` prop, so silently defaulted
  open — a real "eating space" bug, not a subjective complaint). Added `Field`'s `title` prop
  and `StatCard`'s new `labelTitle` prop (see the dedicated bullet above on why that's a
  separate prop from `title`) to explain jargon terms across the page. Signal column now uses
  colored `.pill` badges with icons instead of plain text (two new CSS variants, `.pill-warn`/
  `.pill-info`). `theme.css` gained `.card h3, .card h4{text-transform:capitalize;}` for
  title-case section headings app-wide. **Right after this batch, same day**: the user
  reversed an earlier same-project decision and asked that a Trade Plan be scoped to exactly
  one ticker — see the dedicated "Trade Plan is scoped to exactly one ticker" bullet above.
  Verified live via Playwright throughout; one real test-methodology bug caught and fixed
  during verification, not an app bug: an initial `.click()`-based tooltip check read as
  "tooltip broken" because Playwright's `.click()` fires hover-then-click, and `Tooltip`'s own
  `onClick` toggles state — so a click opens then immediately re-closes it. Switching to
  `.hover()` confirmed the tooltips work correctly. `npx tsc -b` / `npm run test` (253 tests,
  unchanged) / `npm run build` all clean.
- **Editing a linked record now warns instead of silently going one-sided (2026-08-24) — see
  README Done item 106, closes Pending item 27.** Deleting either side of a cross-entity link
  already cascaded correctly; editing one side directly in its native module (not via the
  Transfers page) still silently updated only that side. Didn't attempt auto-propagation —
  `InterEntityTransferInput.fromAmount`/`toAmount` are independently entered on purpose (no
  live FX rate to derive a cross-currency link's other side from), so blindly copying an
  edited amount over would be wrong for exactly the links most likely to trigger this. New
  `warnIfLinked(module, id)` in `lib/linkCascade.ts` checks `findLinkForRecord` and, if linked,
  confirms with the user (naming the other module) before letting the native edit save at all
  — cancelling aborts the save entirely, proceeding is an informed one-sided edit rather than
  a silent one. Wired into all 6 native edit-save handlers that touch a linkable record type:
  Cash ledger, Bank transactions, QSE/PSX Transfers, Rentals entries, Personal Loans
  repayments (Funds has no native edit/delete UI for its `Transfer` field at all — nothing to
  wire there). Verified live via Playwright with a seeded Cash↔Bank link: editing the Cash
  side surfaced the warning naming Banking, and clicking Cancel left the stored amount
  unchanged (confirmed via `localStorage`) — zero console errors. New tests:
  `linkCascade.test.ts` gained a `warnIfLinked` block (2 cases, using a mocked
  `confirmDialog`). `npx tsc -b` / `npm run test` (255 tests, 2 new) / `npm run build` all
  clean.
- **CollapsibleCard rollout remainder closed (2026-08-24) — see README Done item 107, closes
  Pending item 42.** Portfolio's Holdings/History tables turned out to already be collapsible
  — a side effect of the earlier `Tabs` rewrite (Done item 103), which wraps every tab section
  in its own `CollapsibleCard`; Portfolio just renders through `Tabs` like everything else, so
  this needed zero code changes, only re-checking a stale README line. **Lesson**: when a
  Pending item says something "needs a different UI shape," re-verify against current code
  before assuming it's still true — a shared-component fix elsewhere in the same project can
  silently resolve an old note. Personal Loans' `RepaymentsSection` genuinely needed a change:
  split so the add-repayment form stays outside any collapsible (collapsing a form mid-fill is
  a UX trap) while the table + export controls moved into a new "Repayment History"
  `CollapsibleCard`. Verified live via Playwright — zero console errors. `npx tsc -b` / `npm
  run test` (255 tests, unchanged) / `npm run build` all clean.
- **New 18-item UI/UX critique batch, IN PROGRESS (2026-08-24) — see README Done item 108 for
  what's fixed so far.** User posted a screenshot of PSX Transactions plus two follow-up
  messages, 18 numbered items total. First four fixed + verified (see README item 108 for
  full detail): (a) sticky subnav overlapping the page title (measured 10px overlap via
  Playwright, fixed a stray `margin-top:-14px`); (b) tooltip text rendering all-caps when
  nested inside a `<th>` (CSS inheritance, not position — `position:fixed` doesn't detach from
  the DOM tree it inherits from); (c) Trade Calculator's unexplained "Current price *" —
  added a tooltip and a real "Save as market price" button; (d) inconsistent input/button
  row heights — root cause was `.row`'s flexbox `align-items:stretch` default stretching bare
  inputs/buttons to match a taller `Field`-wrapped sibling (e.g. `FeeModeControl`'s
  label+select); fixed by switching `.row` to `align-items:flex-end` app-wide (confirmed via
  grep that no `.row` wraps a Card/ChartCard directly, so no card-grid regression risk) plus
  `min-height`/`min-width` on `.btn`/inputs/selects, with matching relaxed overrides for
  `.btn.small` and the `console` density so it stays genuinely more compact than default.
  **While verifying (d) via Playwright, found and fixed a related unreported bug of the same
  class as (b)**: a checkbox's own inline label text (e.g. "Netted (levies only)") rendered
  ALL CAPS because it's wrapped in a real `<label>` for click-target semantics, and the base
  `label{text-transform:uppercase}` rule (meant for a small caption *above* a Field's input)
  doesn't distinguish that from inline description text sitting *beside* a checkbox — fixed
  once with `label:has(> input[type=checkbox]), label:has(> input[type=radio])
  {text-transform:none}` rather than patching the 6 files using this pattern. **Rule worth
  repeating for future "why is this text uppercase/styled oddly" reports: check what a shared
  base-element selector (`label`, `<th>`, etc.) is doing before assuming a component-specific
  bug** — this is the second time this exact class of bug (an app-wide base-tag style rule
  catching an element used for an unrelated purpose) has been the real cause this session.
  `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run build` all clean; a 23-page
  console-error sweep found zero regressions.
- **Same batch, continued (2026-08-24) — see README Done item 109.** (e) Table Edit/Delete/
  Save/Cancel buttons right-pinned via one `tbody td:last-child:has(button){text-align:right}`
  rule (every such row across the app puts its buttons in the row's last `<td>`, confirmed by
  reading the JSX, not assumed). (f) "Transactions" renamed to "Trade Transactions" on the
  QSE/PSX sidebar nav item, page title, and tab labels (plus the per-stock "Transactions" tab
  → "Trades") to disambiguate from Bank's own "Transactions" tab, which really is money
  transactions, not stock trades, and was left untouched. `npx tsc -b` / `npm run test` (255
  tests, unchanged) / `npm run build` all clean.
- **Chip contrast fixed on all 7 Material themes (2026-08-24) — see README Done item 110.**
  Real root cause, not a design tweak: one `html[data-color^="material-"] .chip{...}` rule
  (no `data-theme` in its selector) was missed when `:not(.active)` exclusions were added to
  its sibling rules in an earlier session — its extra `html` type selector still out-specifies
  `.chip.active`'s plain two-class selector (a tied class-count is broken by type-selector
  count), so it silently clobbered the active fill back to the inactive tint on every Material
  theme. **Lesson for any future "I added `:not(.active)` and it's still broken" moment: grep
  for every rule setting the same property on the same base selector, not just the ones that
  look obviously related** — this is the second time a same-shaped bug (a base-selector rule
  the earlier fix pass didn't know about) was the real cause this session (see the checkbox-
  label uppercase bug above). Verified via Playwright computed-style checks across 3 themes
  (light/dark Material Blue, light Material Crimson), not just a screenshot. `npx tsc -b` /
  `npm run test` (255 tests, unchanged) / `npm run build` all clean.
- **Console density fixed to actually be the densest tier (2026-08-24) — see README Done item
  111, closes items 1-9 of the original screenshot report.** Real, measurable bug, confirmed
  via Playwright before touching anything: a table row's font-size/padding was IDENTICAL
  between "Comfortable" and "Console" (Console's `table{font-size:...}` rule could never
  out-specify the base ruleset's own `tbody td{font-size:14px}`, and Console never overrode
  `tbody td` padding at all, unlike Compact) — so Console was measurably *less* dense than
  Compact for the densest, most information-heavy element type in a finance app. Rewrote
  Console's density block to mirror every property Compact overrides, using the same selector
  specificity, with tighter values throughout — row height now goes 54.5px → 46.5px → 38.5px
  across Comfortable → Compact → Console, a genuine strictly-decreasing series. `npx tsc -b` /
  `npm run test` (255 tests, unchanged) / `npm run build` all clean.
- **Toast hidden behind the Calculator button, fixed (2026-08-24) — see README Done item 112,
  first item of the follow-up batch.** The toast (`bottom:20/right:20/z-index:50`) and the
  floating Calculator button (`bottom:24/right:24/z-index:500`) sat in almost the exact same
  screen position with the button's z-index 10x higher, so a toast rendered genuinely hidden
  behind it, not just visually close. Fixed by shrinking the Calculator button to a round
  52px icon-only FAB (label moved into a real `Tooltip` popup) and moving `.toast` up to
  `bottom:92px`, clear of the button's full height. **One non-obvious implementation detail
  worth remembering for any future fixed-position + Tooltip combination**: `position:fixed`
  has to live on a wrapper OUTSIDE `Tooltip`'s own trigger span, never on the element `Tooltip`
  wraps directly — `Tooltip`'s trigger span is normally positioned, so a `fixed` child inside
  it paints at the viewport corner while the span itself stays wherever it fell in document
  flow (fixed elements are removed from flow), breaking both hover detection and the tooltip's
  own `getBoundingClientRect()` positioning math, which reads the parent span's now-wrong,
  empty rect. Verified via Playwright bounding-box overlap check (not just a screenshot) with
  a real triggered toast — zero overlap. `npx tsc -b` / `npm run test` (255 tests, unchanged) /
  `npm run build` all clean.
- **Icon-only Edit/Delete/Save/Cancel/Export/Clear buttons on QSE/PSX Trade Transactions
  (2026-08-24) — see README Done item 113.** New shared `components/ui/IconButton.tsx`
  (button + real `Tooltip` instead of a native `title`) plus two new icons (`EditIcon`,
  `ExportIcon`) applied to every repeated table-row action and the two toolbar utilities on
  both exchanges' Transactions pages — exactly the page the user's screenshot showed. Kept
  "Add row"/"Save transaction" as visible-text buttons on purpose (primary CTAs, not repeated
  utilities). **Small lesson**: first tried a rotated `CheckIcon` as a makeshift Cancel "X" —
  looked wrong, a real new `XIcon` was the right call instead of bending an existing icon into
  a shape it wasn't drawn for. `IconButton` is now a ready-made block for the broader
  "app-wide" version of this ask, not yet applied beyond Transactions. `npx tsc -b` /
  `npm run test` (255 tests, unchanged) / `npm run build` all clean.
- **Single-child card nesting removed from QSE/PSX Settings (2026-08-24) — see README Done
  item 114, closes out the ENTIRE 18-item batch (original screenshot + both follow-ups).**
  `Tabs` already wraps each tab's content in its own `CollapsibleCard` titled with that tab's
  label; `AccountSection`/`DataManagement` (both exchanges) and QSE's `AmountSettings` each
  also wrapped their own content in a second inner `<Card>` with a matching `<h3>`, so
  "Account" (e.g.) rendered twice — once as the real accordion header, once as a redundant
  heading one level in. Fixed by dropping the inner `<Card>`/`<h3>` from all three. Left PSX's
  "Fees & amounts" tab alone on purpose — its content is 4 real sub-cards with distinct
  headings ("Commission & fees", "Capital gains tax", etc.), not the "only child repeating the
  parent's title" pattern being fixed. Verified via an `h3`-text sweep (each label now appears
  exactly once) plus a screenshot confirming the multi-card section is unflattened. `npx tsc
  -b` / `npm run test` (255 tests, unchanged) / `npm run build` all clean.
- **"Colour cards only belong to one theme" fixed — a real bug, not a design tweak
  (2026-08-24) — see README Done item 115.** Confirmed via a before/after screenshot across 4
  themes first: every Dashboard stat card in every non-wine theme rendered the exact same
  near-flat tint, zero visible difference between cards. Root cause: a later
  `html:not([data-color="wine"]) .card.stat-card, .card.chart-card{background:...
  --accent-soft...}` rule (added to tone down an earlier, more saturated per-theme treatment)
  applied one flat, hue-blind gradient to every stat card in every non-wine theme, completely
  overriding the `--card-hue`-driven per-card coloring `StatCard`'s `hue` prop already
  provides everywhere else — wine was the only theme that never went through this override,
  so it was the only one where the existing hue rollout (Done items 32/38/43/88) was actually
  visible. Fixed by splitting `.card.stat-card` out from `.card.chart-card` (no per-card hue,
  keeps the old flat tint) in both this rule and its Material light/dark duplicate, giving
  stat-card the same `--card-hue` gradient formula the base rule already used. **Third
  instance this session of the same bug class**: a later, broader CSS rule silently
  overriding an earlier, more specific feature because nobody reconciled the two when the
  later one was added (see the chip-contrast and checkbox-label-uppercase fixes above) — worth
  treating as a standing suspicion whenever a "should be working but isn't" visual report
  comes in: grep for every rule touching the same property on the same selector, not just the
  one that looks most related. `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run
  build` all clean.
- **Remaining deferred items documented in README (2026-08-24) — see README Pending items
  56/57, item 64 of this batch.** Item 12 (a real, multi-part Portfolio page redesign — CGT
  showing 0, missing chart labels, layout restructuring into left/right stacks, full-width
  price input) and item 11 (side-by-side layout instead of scrolling, overlapping with the
  existing "utilize page space" item 54) are now real Pending entries with their own numbers
  rather than only living in this file's prose. **This closes the entire 18-item UI/UX
  feedback batch** — every item from the original screenshot and both follow-up messages is
  now either shipped (see Done items 108-115) or a scoped Pending entry ready for its own
  session.
- **`IconButton` rolled out to every other module's Edit/Delete/Save/Cancel buttons
  (2026-08-24) — see README Done item 116, done on this session's own initiative per the
  standing "keep working down the Pending list" instruction, not a new user report.** 13
  files: QSE/PSX per-stock Transactions, Personal Loans, Rentals, Banking, Cash, EMI, Funds,
  Transfers, Subscriptions, and both `DividendsSection` components. New `EditIcon`/`XIcon`
  added to `icons.tsx`. Deliberately scoped down in `TradePlannerPage.tsx` (already the most
  bug-fixed file this session) — only its two unambiguous per-leg "Edit" buttons converted,
  its several single-instance form-Cancel buttons left as text rather than risk a subtle
  breakage in an already-fragile file for low marginal value. **A real dangling-`</button>`
  bug was caught mid-edit in `BankPage.tsx`** (the old wrapping tag's closer had nothing left
  to match once the new `IconButton` self-closed) — caught by re-reading the surrounding JSX
  right after the edit, before running `tsc`, which is why running `tsc -b` after every single
  file (not batched at the end) mattered here: it would have caught it eventually, but the
  read-immediately-after-editing habit caught it before even needing to. Verified via `npx tsc
  -b` per file, `npm run test` (255 tests, unchanged), `npm run build`, a 23-page console-error
  sweep, and a live Playwright functional test on Personal Loans confirming the Edit button's
  tooltip and click behavior actually work, not just render.
- **New Transfers-page feedback batch, IN PROGRESS (2026-08-25) — see README Done item 117 for
  what's fixed so far.** User posted a Transfers-page screenshot plus a 10-item list. First two
  fixed: (a) added a "Total Withdrawals" stat card to QSE/PSX Dashboard next to "Total
  Deposits" — `summary.totalOutward` was already computed in `cashSummary.ts` but never shown
  anywhere, so a user who both deposited and withdrew only saw the gross deposit figure. (b) A
  real shared-component bug: `Field`'s wrapping `<label>` inherited the base
  `label{margin-bottom:5px}` rule, and since `align-items:flex-end` aligns flex children by
  their margin box, that inherited margin pushed every `Field` 5px above a bare (non-Field)
  sibling in the same row — confirmed via Playwright measurement (a Field's label carried
  `margin: 0px 0px 5px` computed) before fixing. Fixed with `marginBottom: 0` directly on
  `Field`'s wrapping label — a one-line shared-component fix that corrects this wherever a
  `Field` shares a row with a bare control, not just the Transfers page it was reported on.
  **"All" chip added to `Tabs` (2026-08-25) — see README Done item 118.** A page with many
  sub-sections needed one click per section to see everything since the earlier `Tabs` redesign
  made each section its own collapsible card. New leading "All" chip in the single shared
  `Tabs.tsx` opens every section at once, so every page using `Tabs` gets it for free. Verified
  via Playwright: clicking it flipped every section from mixed open/closed to all-open.
  **Bank account number + SMS sender metadata (2026-08-25) — see README Done item 119.**
  `BankAccount` gained three optional fields (`accountNumber`, `smsSenderId`,
  `smsSenderNumber`) for a future SMS-based transaction-import feature the user is planning —
  nothing reads them yet. Added to `AddAccountForm` for new accounts and to
  `AccountDetailModal` for existing ones via local-draft-state + an explicit "Save details"
  button (same pattern as Rentals' `PropertyDetailModal`, since the modal's `account` prop is
  a point-in-time snapshot, not a live subscription). Deliberately not new table columns —
  supplementary setup-time metadata, not at-a-glance data.
  **Per-entity default transfer source remembered + prefilled (2026-08-25) — see README Done
  item 120, closes the concrete half of this batch.** New `hooks/useLastTransferSource.ts`
  remembers which "From" entity was used the last time a link was created INTO a given "To"
  entity, keyed by `module(:ref)` so e.g. two different Rentals properties each remember their
  own usual funding source independently — the user's own example was "PSX can only use Zindagi
  for deposits/withdrawals, while I can collect rent through a different source each month...
  prefill the last used source." Wired into `TransferLinksPage.tsx`'s `CreateLinkForm`: changing
  "To" prefills "From" from whatever's remembered (still just a default, freely overridable), and
  a successful link-creation updates the remembered value for next time. **Test-script debugging
  note worth remembering for future Playwright verification on this page**: `getByText()` matches
  *rendered* text, so a label under `text-transform:uppercase` CSS won't match its literal DOM
  string, and even a case-insensitive regex can fail if the label element's `innerText` also
  concatenates a nested `<select>`'s own option text. Positional (`nth()`) selectors are also
  unreliable here since `SideFields` conditionally renders an extra "Account"/"Property"/"Loan"
  `<select>` depending on which module is picked for that side — a fixed index silently points at
  a different control once module selection changes the element count. The reliable check that
  finally worked: read every select's live *value* on the form
  (`locator('select').evaluateAll(...)`) and confirm the expected value's presence, rather than
  trying to address "the right" element by text or position. Verified this way: selecting PSX as
  "To" correctly prefilled "From" as Banking with the exact remembered account (`zindagi1`)
  restored, not just the module. `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run
  build` all clean.
  **Still open from this batch, tracked as README Pending items 58-62** (all real, several large
  enough to need their own scoped pass): card-header action-button alignment (top-right),
  whole-card coloring instead of colored text/pill backgrounds, sidebar menu contrast, Rentals
  semi-automated rent collection (choose a cycle, propose a transaction for approval, track
  partial payment), and the broader "link a transfer directly from each entity's own page"
  feasibility question (distinct from the prefill feature just shipped — this is a per-module
  shortcut UI, not the Transfers page itself). Continue down this list per the standing
  auto-commit instruction — the user explicitly asked to keep going until nothing is pending.
  **Card action buttons moved to header top-right, first pass (2026-08-25) — see README Done
  item 121, partially closes Pending item 58.** `CollapsibleCard` already had a `headerExtra`
  slot (only used by Dashboard's Holdings/Alerts cards and the Trade Planner before this) — used
  it for every card with a single stranded action button below its content: Bank's
  `AccountDetailModal` (Save details, Export CSV — previously plain `<h4>`s with the button
  stuck below several fields), Personal Loans' "Repayment History", EMI's "Schedule", Funds'
  "Transactions". **Two categories deliberately left alone, not overlooked**: per-row Edit/
  Delete buttons (already correctly right-aligned in their own table column, a different
  convention that was already right — see Done item 109) and primary-CTA form-submit buttons
  ("Add row", "Generate renewal plans") that cap off a fill-in-the-fields flow, per Done item
  113's established rule that those stay as visible-text buttons in natural form position, not
  header actions. **Two real remaining gaps, tracked in Pending item 58, not silently dropped**:
  QSE's/PSX's per-stock Trades tab and Rentals' Income & expenses tab both have an Export CSV
  button buried inside a `Tabs`-rendered section — `Tabs`/`TabDef` has no per-tab `headerExtra`
  slot today, and each button's date-range state lives locally in its own component rather than
  at the tab-definition call site, so hoisting it needs `Tabs` extended first (a real, separate
  structural change, not attempted in this pass to avoid touching the heavily-used shared `Tabs`
  component alongside several other file edits at once). QSE's/PSX's PositionDetail "Export
  price history CSV" also stays — it sits inside a native `<details>` nested *within* a
  `CollapsibleCard`, one level too deep for the outer card's header to correctly represent what
  it actually exports. Verified live via Playwright with seeded data for all four fixed modules
  (screenshots of Bank's account modal, Personal Loans' and EMI's loan detail, Funds' fund
  detail all confirmed the button now sits top-right of its heading) — zero console errors.
  `npx tsc -b` / `npm run test` (255 tests, unchanged) / `npm run build` all clean.
  **Whole-card coloring instead of a redundant inner pill (2026-08-25) — see README Done item
  122, closes Pending item 59.** Root cause wasn't a missing mechanism — `StatCard`'s
  `--card-hue` and `.pill-*` badges are both already sanctioned, correct ways to color a whole
  element. The actual bug was roughly a dozen stat-cards doing BOTH at once: `hueStyle(...)` on
  the card (often an arbitrary rotating per-currency color, unrelated to the value's own sign)
  PLUS `pill-buy`/`pill-sell` on the value text inside that same card — a colored badge floating
  inside an already-differently-colored card, which is exactly what reads as "text has its own
  red/green background" even though `.pill` itself is fine. Fixed by making the card's hue
  itself carry the sign (`var(--profit)`/`var(--loss)`) and dropping the now-redundant pill:
  Cash/Bank Balance cards, Personal Loans' Net position + Outstanding, Rentals' Net income,
  Subscriptions' Monthly spend + Status, EMI's Outstanding (×2) + Interest-saved, Funds' Net
  profit (×2), QSE/PSX Trade Calculator's Break-even/Current P/L (now colored only once a
  current price is entered — nothing signed to color before that), and `RiskCalculator`'s
  Current-net-P/L + stress-test cards (already correctly hued, just had the redundant pill).
  **Left alone on purpose**: `.pill-buy`/`.pill-sell` inside actual table cells (Bank/Cash
  ledgers, Subscriptions' Status column, etc.) — a colored badge in an otherwise-plain table row
  is the correct, established use of `.pill`, not the "double-colored card" bug being fixed
  here. Several files lost their now-unused `HUES` import as a result (`CashPage.tsx`,
  `BankPage.tsx`, `PersonalLoansPage.tsx`, `RentalsPage.tsx`) — checked each for other `HUES[`
  usages before removing the import; several (EMI, Funds, Subscriptions) still needed it for
  unrelated cards and kept it. Verified live via Playwright across 6 modules plus a seeded QSE
  position for the Trade Calculator/Risk Analysis cards — zero console errors. `npx tsc -b` /
  `npm run test` (255 tests, unchanged) / `npm run build` all clean.
  **Sidebar menu contrast investigated + real bug fixed (2026-08-25) — see README Done item
  123, closes Pending item 60.** Measured first, per this file's own "measure before fixing"
  discipline: computed real WCAG contrast ratios for the sidebar's nav text across all 12 color
  themes × light/dark (24 combos) — every one already passed AA (4.97–16.11:1), so the sidebar
  itself was never the bug. A pixel-sampled screenshot check of the Appearance/Category dropdown
  panels also confirmed correct theming — one screenshot's *visual* read looked wrong (panel
  looked white in dark mode) but `PIL.Image.getpixel()` on the actual PNG proved it was the
  correct dark navy, an optical illusion from sitting next to a near-black page background, not
  a real bug. **The actual bug, found by checking what the app's own CSS can't reach**:
  `color-scheme` was never set anywhere (`grep -r color-scheme` came back empty), so every
  native browser-drawn control — a `<select>`'s own opened dropdown list chief among them —
  rendered in the browser's default LIGHT palette regardless of this app's dark theme. That's a
  real "menu" (literally a browser-native popup) with wrong contrast, at every single `<select>`
  in the app — matches "many places" far better than a sidebar-specific theory the numbers had
  already ruled out. Fixed with one CSS property each on `:root` (dark, the un-overridden
  default) and `:root[data-theme="light"]`. **Lesson for any future "X still looks wrong"
  report after the obvious CSS rule already checks out**: consider what the app's CSS
  *structurally cannot* style at all — native browser chrome (`<select>` popups, date/number
  spinners, scrollbars) needs `color-scheme`, not a color override, since the app has no DOM
  access to that popup's own rendering.
  **Rentals semi-automated rent collection built (2026-08-25) — see README Done item 124,
  closes Pending item 61 and this file's own "New-modules sequencing" note above about the
  original request being deferred.** A genuinely separate mechanism from the existing lease-
  based `generateLeaseRentPlans()` (bulk-projects a whole lease up front): `Property` gained
  `collectionCycle`/`lastCollectionDate`/`pendingRentBalance` (the last one a carried-forward
  partial-payment shortfall, never negative on an overpayment), and new
  `proposeRentCollection()`/`nextPendingBalance()` in `lib/calc/rentalPlanning.ts` compute just
  the ONE next-due collection from the anchor + cycle — deliberately advancing only one cycle
  per call (never looping ahead through multiple missed ones), so a missed collection surfaces
  as a single overdue proposal the user approves, which becomes the new anchor for next time.
  `PropertyDetailModal`'s new "Rent collection" card shows the computed due date/amount
  (editable) with an "Approve & log" button; entering a lower amount than proposed IS how a
  partial payment gets recorded — `pendingRentBalance` recomputes from whatever was actually
  entered, no separate partial-payment UI needed. **See this file's own Design decisions section
  for a real, previously-undiscovered `Modal`/`confirmDialog`/`ensureSignedIn` z-index bug found
  and fixed while verifying this feature** — worth reading if touching any page-level Modal that
  calls either of those from inside itself. `npx tsc -b` / `npm run test` (264 tests, 9 new) /
  `npm run build` all clean.
  **Direct transfer-link shortcut built for PSX then QSE (2026-08-25) — see README Done item
  125, partially closes Pending item 62.** New `LinkedTransferFields` component inside each
  exchange's own `TransactionsPage.tsx` `TransferForm` — a "Link this to a Bank account or Cash"
  checkbox swaps the plain Fee/Add controls for a module picker + "Link & add" button calling the
  exact same `createLinkedTransfer()`/`useLastTransferSource` the Transfers page uses, no
  parallel implementation. Deliberately simpler than the full Transfers page: both sides always
  share one amount, no cross-currency "different amount" toggle (that still belongs on the full
  page). Built on PSX first, then copied near-verbatim onto QSE once the prototype checked out —
  not extracted into a shared component since the two pages' `TransferForm`s weren't shared to
  begin with either. Verified live on both: checking the box correctly pre-selected the
  remembered Bank account, "Link & add" hit the sign-in gate — zero console errors on either.
  **Rentals/Personal Loans/Funds/EMI remain open** — each needs its own short design pass since
  none of them has a plain deposit/withdrawal record like QSE/PSX's `Transfer`.
  **CRITICAL, real financial-correctness bug found and fixed while designing the above
  (2026-08-25) — see README Done item 126, flagged prominently for the user since it can't be
  silently auto-corrected.** Bank/Cash↔Rentals linked transfers had an INVERTED RENT_INCOME/
  EXPENSE sign since this pairing first shipped (Done item 34) — every other linkable pairing
  is between two modules holding a REAL balance, where the shared `from`='out'/`to`='in'
  convention is correct (conservation of money: one side falls exactly as the other rises), but
  Rentals holds no real balance of its own — `RentalEntry.type` just categorizes what a REAL
  Bank/Cash event meant for the property's performance tracking, so applying the generic
  opposite-polarity convention got it backwards in both of the pairing's real use cases ("rent
  received" and "an expense paid"). Same class of issue the `personalLoans` case already had a
  documented exception for — Rentals needed the identical exception and didn't have one. Fixed
  in `lib/interEntityLink.ts`'s `buildSideRecord` (swapped the ternary); both existing tests
  (which encoded the wrong behavior as correct) were corrected. **Any Bank/Cash↔Rentals linked
  transfer created before this fix has the wrong income/expense type on the Rentals side** —
  this was NOT auto-corrected (no safe way to guess which past records to touch, per this
  file's own cloud-sync-safety principle), so it needs the user's manual review. New links from
  this point on are correct.
- **CRITICAL, root-caused against a real user-uploaded PSX workbook backup (2026-08-25) — see
  README Done item 127, REVERTS Done item 67.** User reported app Cash Balance 471.42 PKR /
  Portfolio Value 39,310.63 PKR vs. their real broker's Balance 442.47 / Portfolio 39,401.
  Seeded the exact uploaded JSON into the app (Cash Balance matched exactly; Portfolio Value
  had drifted slightly from the user's screenshot due to this session's own earlier unrelated
  fixes) and ran the real calc engine against it directly via a scratch Vitest test to inspect
  every computed fee, rather than guessing. **Portfolio Value's remaining gap is benign** —
  `cashSummary.ts` deliberately nets an *estimated* sell fee off market value, while a broker's
  own figure typically doesn't; the residual is ordinary price drift given this app's locked
  no-live-market-data design. **Cash Balance's gap was a real, significant bug**: Done item 67
  (2026-08-24) pre-checked "Same-day override" (`manualSameDay: true`) on every fresh BUY dated
  today, on the theory it's probably about to close same-day. This is provably wrong —
  PSX's real same-day rule (confirmed against a real broker, Done item 79) says the
  LARGER-quantity side pays full commission with ties going to BUY, so the single most common
  same-day round trip (buy X, later sell all X — a tie) needs the BUY to be the CHARGED side,
  not the netted one — but the checkbox pre-checked the buy's override before the matching sell
  even existed, and `isNettedLeg()` trusts an explicit `manualSameDay: true` unconditionally by
  design (correct for its real, narrower purpose: a deliberate manual correction, not a
  predictive default). Net effect once the sell was logged: BOTH legs came out netted (zero
  commission on either), and an isolated same-day buy with no matching sell at all was also
  wrongly zero-fee. Verified the exact magnitude by recomputing the user's real ledger with
  every `manualSameDay` flag stripped to pure auto-detection: balance dropped 471.42 → 446.73
  (a 24.69 PKR under-charge from 5 real transactions), closing the large majority of the 28.95
  PKR gap to the broker's 442.47 — the small remainder is plausibly this profile's
  NCCPL/SECP/PSX/CDC levy settings all being 0, a settings question for the user, not a code
  bug. **Fix: reverted Done item 67's default entirely** — `TransactionsPage.tsx`'s
  `emptyRow()` and the action/date `onChange` handlers no longer touch `manualSameDay` at all;
  `StockPage.tsx`'s add form now starts in Fee Mode "Auto" (`feeMode` default changed
  `'semi'`→`'auto'`, `manualSameDay` default `true`→`false`) with the `setManualSameDay` nudges
  removed from its action-select/date-input/submit handlers. **Lesson for any future "smart
  default" checkbox on a not-yet-fully-known outcome**: if the correct answer depends on data
  that doesn't exist yet (here: the matching sell's eventual quantity), don't pre-set the flag
  at all — let the real auto-detection run once both sides exist, exactly like this always
  worked before Done item 67 tried to "help." **Not silently fixed — flagged for the user's
  manual review, per this file's own locked cloud-sync-safety principle (never guess-correct
  real financial data)**: any transaction that already has `manualSameDay: true` baked in from
  the old default needs checking — in the user's own uploaded backup, specifically the BUY legs
  of OGDC 1@330.5, OGDC 1@331.46, PPL 1@242.5, SNGP 1@102.61, and the isolated PSO 26@374 buy.
  `npx tsc -b` / `npm run test` (264 tests, unchanged — a UI-default change, not a calc-engine
  change) / `npm run build` all clean; verified live via Playwright that a fresh row on both
  pages now starts in Fee Mode "Auto" with nothing pre-checked, zero console errors.
- **User immediately followed up (2026-08-25), same discrepancy investigation, with a new
  real broker statement (24-08-2026, JS Global Capital Limited / JSBL-ZINDIGI) plus three more
  asks — IN PROGRESS, not yet done as of this note**: (1) extract that statement's rows and
  append them to the repo's existing broker-statement artifacts — found via search:
  `./psx/trades/trades.html` (406 lines) and `./psx/trades/trades_all.html` (136 lines, HTML
  tables matching the real contract-note schema: Contract #/Market/Sett. Date/Symbol/Quantity/
  Rate/Brok. Rate/Brok. Amount/Net Rate/SST Amount/Levies Charges/Amount, with per-symbol
  "Total :" rows and a final `<tfoot>` grand-total row) and `./JS_Zindigi_SNGP_Trading_
  Analysis.xlsx` (not yet inspected); (2) use this real data to cross-validate/calibrate the
  exact fee formula in `lib/calc/psxFees.ts`'s `calcFeeBreakdown()` — user confirmed
  `feePct=0.2`/`lowPriceFee=0.05` are the right commission rates, wants the SST/levies formula
  checked against real per-transaction numbers; (3) already-covered by Done item 127 above —
  user independently flagged the same same-day-netting bug as "most critical," confirming (not
  newly reporting) what was already found and fixed; (4) a genuinely new, not-yet-investigated
  bug report: "I bought and sell 2 shares same on 24-Aug, those transactions should marked as
  closed trades rather than cause the available stocks to miscalculate" — same-day round-trip
  trades (buy N, sell N of the same ticker, same day) should be recognized as a closed trade,
  and something about trade ordering/timing is currently causing open-share-count
  (`computePositions`) to miscalculate for this case. Root cause not yet found — candidates to
  check: same-day transaction sort/tie-breaking order in `computePositions`, the Open/Closed
  split logic (README Done item 73) keying off `shares > 0` at a stale snapshot, or whether
  this only manifests under FIFO lot matching (though the user's own settings show
  `costBasisMethod: 'average'`, not `'fifo'`). **Do not assume Done item 81 or any other
  same-day-related past fix already covers this** — the user is reporting it as currently
  broken against the live app with real, freshly-logged 24-08-2026 data.

- **Critical, user-reported (2026-08-25): same-day buy+sell of equal quantity showed spurious
  open shares — see README Done item 128.** `Transaction` has no time-of-day, only a date, so
  `computePositions`/`computeFIFOPositions`/`computeRealizedPLTimeSeries` all sorted same-day
  transactions by date string alone, relying on `Array.prototype.sort`'s stability to fall back
  to array/entry order for ties. A same-day SELL landing before its matching BUY in that array
  got processed against a not-yet-existent position: shares went negative and were silently
  clamped/dropped, then the later BUY re-opened a position that should already have closed —
  exactly the user's "bought and sell 2 shares same on 24-Aug... should be marked as closed
  trades." Fixed with a new shared `lib/calc/sortTransactions.ts`'s
  `sortTransactionsChronological()` (date, then BUY before SELL on a tie) wired into all three
  functions — safe in general since a same-day sell can never legitimately precede the buy that
  supplies its shares, and every other same-day ordering produces the same final totals either
  way. **Rule for any future function that processes transactions in date order**: use this
  shared helper, not a bare `.sort((a,b) => a.date.localeCompare(b.date))` — that bare pattern
  is exactly what caused this bug three times over (once per function) before being fixed.
  Verified against the user's own real 24-08-2026 OGDC data (2 buys + a matching 2-share sell,
  entered sell-first) via Playwright: Portfolio now correctly shows "No open positions" instead
  of a phantom 2-share OGDC holding. New tests in `calc.test.ts`/`fifoPositions.test.ts`
  reproduce the exact scenario. `npx tsc -b` / `npm run test` (267 tests, 3 new) / `npm run
  build` all clean.
- **Critical, user-reported (2026-08-25): "I updated price from Calculator but it didn't
  reflect on dashboard until i refresh" — see README Done item 129.** Dashboard's/Portfolio's
  inline "Current price" cell (QSE+PSX, 4 files) is `<input defaultValue={r.mp || ''} .../>` —
  deliberately uncontrolled so typing doesn't fight a controlled value re-snapping mid-
  keystroke. `defaultValue` only sets the *initial* DOM value and never re-applies on a later
  re-render, so a price saved elsewhere (the floating Trade Calculator, in this report) updated
  the store and every other reactive stat immediately but left this one input stuck on its old
  value until a full reload force-remounted it. Fixed with `key={r.mp}` on each of the 4 inputs
  — forces a remount (picking up the new `defaultValue`) exactly when the price changes for a
  reason other than the user's own typing. **Verification note, worth remembering for any
  future sign-in-gated write bug**: writing a market price requires sign-in, and this project's
  locked policy forbids creating even a throwaway account against the real production Firebase
  project — confirmed this live in Playwright first (screenshotted the real Sign-in modal
  appearing when the Calculator's "Save as market price" was clicked while signed out), then
  fell back to a targeted regression test instead: `components/__tests__/
  priceInputRemount.test.tsx` (the project's first `.tsx` test file, using
  `@testing-library/react`) isolates the exact `defaultValue`+`key` pattern in a minimal
  component and proves both the bug (without `key`, a rerender with a new price leaves the DOM
  stale) and the fix (with `key`, it updates), plus that an unrelated same-price rerender
  doesn't disturb in-progress typing. `npx tsc -b` / `npm run test` (270 tests, 3 new) / `npm
  run build` all clean; a live Playwright sweep of all 4 affected pages showed correct seeded
  values with zero console errors.

- **Real 24-08-2026 broker statement extracted + PSX fee formula calibrated against it
  (2026-08-25) — see README Done item 130.** User attached two contract-note images (JS Global
  Capital / JSBL-ZINDIGI, Trade Date 24/08/2026) — the images themselves weren't retrievable
  from the live conversation after a context-compaction boundary, but were recovered by
  grepping the raw session JSONL transcript (`/root/.claude/projects/.../*.jsonl`) for the
  message and base64-decoding the attached `source.data` fields; **worth remembering for any
  future session that needs to re-examine an image the user sent earlier in a long session**:
  the transcript file persists the full base64 image data even after a summary drops it from
  visible context. Appended the extracted data to all three existing trade-log artifacts:
  `psx/trades/trades.html` (new per-statement `<table>`, same Purchase/Sale-section format),
  `psx/trades/trades_all.html` (17 new flat rows, meta line updated), and
  `JS_Zindigi_SNGP_Trading_Analysis.xlsx` (one new SNGP row — that workbook is scoped to SNGP
  only, per its own filename). **LibreOffice recalculation of the xlsx timed out repeatedly in
  this sandbox** (confirmed via direct `soffice`/`run_soffice` testing that even a trivial
  3-cell macro-based recalc hangs indefinitely here — a genuine environment limitation, not
  something wrong with the file) — checked the file's own git history first and confirmed it
  already ships with NO cached formula values even in its original, pre-existing form, so this
  doesn't introduce a new inconsistency; a real Excel/Sheets session recalculates on open
  regardless. **Fee calibration** (the substantial part): cross-checked `calcFeeBreakdown()`
  against the real statement's Brok. Amount/SST/Levies columns — commission (`feePct=0.2%`/
  `lowPriceFee=PKR0.05`) and SST (`sstPct=15%`) already matched every row exactly, but the
  combined government-levies bucket (`nccplFeePct`, standing in for PSX+NCCPL+SECP+CDC since
  the broker's own statement doesn't itemize them separately either) was an uncalibrated guess
  at 0.011% — the real data (13 rows from this statement + 4 spot-checks from an earlier one)
  only reconciles exactly at 0.0119% (fitted valid range 0.01185%-0.01202%). Updated
  `DEFAULT_PSX_SETTINGS.nccplFeePct` to 0.0119, added a permanent regression test in
  `psxFees.test.ts` pinning the real numbers. **Does not retroactively touch any existing
  user's own saved settings** — the investigating user's own real workbook has
  `nccplFeePct: 0` (confirmed in Done item 127's investigation) and stays that way unless they
  manually update it themselves; this only changes what a brand-new workbook starts with.
  **The user's 4th ask ("same-day trades should be marked as closed") needed no separate
  fix** — re-read `TransactionsPage.tsx`'s existing Open/Closed split (Done item 73) and
  confirmed it already derives from `computePositions`'s `shares > 0`, so Done item 128's
  same-day-ordering fix alone makes a closed round-trip correctly classify as "Closed" too.
  `npx tsc -b` / `npm run test` (271 tests, 1 new) / `npm run build` all clean.

- **Direct transfer-link shortcut extended to Rentals, Personal Loans, and Funds (2026-08-25)
  — see README Done item 131, closes Pending item 62.** Reused `createLinkedTransfer`/
  `useLastTransferSource` directly (no parallel implementation) via the same "Link this to a
  Bank account or Cash" checkbox pattern QSE/PSX already had (Done item 125). Each module
  needed its own short "what does linking mean here" answer: Rentals' `from`/`to` depends on
  the entry's `type` (RENT_INCOME → Rentals is `from`, EXPENSE → Rentals is `to`, per the
  already-documented no-real-balance exception in `interEntityLink.ts`); Personal Loans'
  `PersonalLoanRepayment` itself ignores direction, but which side the real Bank/Cash account
  occupies depends on the loan's own `direction` field (`owed_to_me` → Bank/Cash is `to`,
  `i_owe` → Bank/Cash is `from`). **Funds needed more than a checkbox** — it had no native
  add-form for its `transfers` field at all (confirmed via Done item 106's own note), only the
  standalone Transfers page's generic form could create one. Built a new "Transfers" tab on
  `FundsPage.tsx` (plain add/edit/delete list, near-verbatim copy of QSE/PSX's `TransferForm`/
  `TransfersSection` since Funds reuses the exact same `Transfer` type via the shared
  `createWorkbookStore` factory) with the link-checkbox built in from the start — closing the
  standing gap and the linking ask in one change, since the shortcut needs a native form to
  attach to. **EMI remains the only unlinkable module** (see Pending item 21) — no repayment
  ledger exists there at all, a data-model gap. Verified live via Playwright across all three:
  link-mode fields render correctly with a seeded Bank account selectable in each, plus a full
  end-to-end check on Rentals (checkbox → amount → Link & add → real sign-in modal appears) —
  zero console errors throughout. `npx tsc -b` / `npm run test` (271 tests, unchanged) / `npm
  run build` all clean.

- **`Tabs` gained a per-tab `headerExtra` slot, closing Pending item 58's remainder
  (2026-08-25) — see README Done item 132.** `TabDef.headerExtra` passes straight through to
  the underlying `CollapsibleCard`'s own `headerExtra` prop — same mechanism as everywhere else
  (Done item 121), just not reachable from inside a `Tabs` section before this. Used it for
  QSE's/PSX's per-stock Trades tab (extracted a `useTickerExport(ticker)` hook so `StockPage`
  builds the header control once, `TickerTransactions` untouched) and Rentals' Income &
  expenses tab — the harder case, since the export scope depends on which property is picked,
  and that picker lived inside `EntriesTab`'s own `usePropertyPicker()` call, invisible from
  `RentalsPage` where `Tabs` is defined. Lifted `usePropertyPicker()` up to `RentalsPage`,
  passed the picker state down into `EntriesTab` as props, added a matching
  `useEntriesExport(property)` hook at the `RentalsPage` level. **Pattern worth repeating for
  any future per-tab header control that depends on a sub-selection inside that tab's own
  content**: the selection state has to live at the same level as the `Tabs` call, not inside
  the tab's content component, or the header can't see it. Verified live via Playwright on all
  three pages — Export CSV now sits top-right of its own section header instead of buried in
  the content, zero console errors; PSX's Trades tab also confirmed Done item 130's fee
  calibration live (10 shares @ 300 PKR showed Fee 7.26 PKR, matching 6.00 commission + 0.90
  SST + 0.36 levies by hand). `npx tsc -b` / `npm run test` (271 tests, unchanged) / `npm run
  build` all clean.

- **Real time-of-day + timezone support built (2026-08-25) — see README Done item 133, closes
  the second half of Pending item 41.** User's own design answers when asked: backfill missing
  time to noon, prefill a timezone selector linked to the record's market/currency (not force
  a manual pick every time). New `lib/datetime.ts`: `toInstantMs(date, time?, timezone?)`
  combines them into a real comparable epoch-ms instant — dependency-free, DST-aware via one
  `Intl.DateTimeFormat` correction pass rather than pulling in date-fns-tz/luxon (consistent
  with this project's existing "small hand-rolled utility over a new dependency" bias — see
  Sparkline/csv.ts/xirr.ts). Missing `time` defaults to `'12:00'`, missing `timezone` defaults
  to `'UTC'` — chosen deliberately (not the viewer's own local timezone) so two different
  sessions looking at the same untimed old record always compute the identical instant; a
  per-viewer fallback would make sort order viewer-dependent, which is worse than a fixed,
  arbitrary-but-consistent one. `defaultTimezoneForMarket('QSE'|'PSX')` returns
  `Asia/Qatar`/`Asia/Karachi`; `defaultTimezoneForCurrency(code)` maps ~25 common currencies to
  a representative financial-center timezone, falling back to the browser's own timezone for
  anything unlisted. **Rule for any future module wiring this in**: use `toInstantMs` for
  sorting, never re-derive date math by hand — it's the one place that gets timezone offsets
  right. `Transaction`/`Transfer`/`Adjustment`/`Dividend` gained optional `time`/`timezone`;
  `sortTransactionsChronological` (positions/FIFO/realizedPL) and `buildCashLedger`'s own sort
  both switched from date-string+heuristic to real-instant+heuristic-on-exact-tie — since two
  untimed records always tie at the identical noon-UTC instant, every existing correct sort
  order (including the same-day BUY-before-SELL fix from Done item 128) is preserved bit-for-
  bit; confirmed by the full 280-test suite passing completely unchanged before any UI was
  touched. New shared `components/ui/TimeZoneFields.tsx` (time input + timezone datalist field,
  `commonTimezones()` sourced from the same lookup tables) rolled out to QSE's/PSX's Trade
  Transactions add-forms (both the multi-row page and the per-stock `StockPage` add form) and
  both exchanges' Cash Transfers form — deliberately the highest-value subset first, since
  same-day ordering is exactly where a real time matters; Adjustments/Dividends and the six
  non-exchange modules are a clearly-scoped mechanical follow-up (the hard design/engine
  decisions are already made, just needs the same `TimeZoneFields` wiring repeated). Verified
  live via Playwright: QSE prefills "Asia/Qatar", PSX prefills "Asia/Karachi", QSE's Transfer
  form prefills "Asia/Qatar" from its QAR currency — zero console errors throughout. `npx tsc
  -b` / `npm run test` (280 tests, 9 new) / `npm run build` all clean.
- **Dashboard chart click-to-drill-down (2026-08-25) — see README Done item 134, partial
  start on Pending item 17.** QSE's/PSX's Dashboard "Allocation by ticker (cost basis)"
  Doughnut and "P/L by ticker" Bar charts now navigate to `/stock/:ticker` (or
  `/psx/stock/:ticker`) on click, cursor turns to a pointer on hover so it's discoverable —
  just `onClick`/`onHover` in each chart's Chart.js `options`, mapping the clicked element's
  index back into the same `rows` array the chart's own data already came from. **Small
  scoping trap worth remembering for this specific file**: `DashboardPage.tsx` (both
  exchanges) has two separate top-level functions — `HoldingsCard()` (had its own
  `useNavigate()` already, for the Holdings table's row click) and `DashboardPage()` itself,
  where these two charts actually render — a hook declared in one function isn't visible in a
  sibling function in the same file, so `DashboardPage()` needed its own `useNavigate()` call
  too; caught immediately by `tsc -b` (`Cannot find name 'navigate'`), fixed in both files
  before running the test suite. **Verification note on clicking a Chart.js canvas
  correctly**: a first Playwright attempt aimed at a coordinate just inside the doughnut
  canvas's bounding box silently did nothing — not a bug, just a miss, since a doughnut's own
  ring only occupies a fraction of its canvas (there's a hole in the middle and legend/
  padding around the edge). Confirmed the ring's real on-screen bounds by reading the canvas's
  own pixel data (`getImageData` along a horizontal scanline, looking for the ring's fill
  color vs. transparent background) rather than eyeballing a screenshot, then clicked inside
  the confirmed ring pixels — worth repeating this pixel-sampling approach for any future
  Chart.js click-target verification instead of guessing coordinates from a screenshot, which
  is exactly the kind of false negative that's easy to misdiagnose as "the feature doesn't
  work." Verified both exchanges' both charts this way (QSE→`/stock/QIBK`, PSX→
  `/psx/stock/OGDC`) — zero console errors. `npx tsc -b` / `npm run test` (280 tests,
  unchanged) / `npm run build` all clean. **Deliberately scoped down**: Analytics page's ~18
  charts (mostly month-indexed or whole-portfolio-wide, lower drill-down value than a
  ticker-indexed chart) and hover cross-highlighting between charts are still open.
- **Time+Timezone fields rolled out to QSE/PSX Adjustments and Dividends forms (2026-08-25) —
  see README Done item 135, continuing Pending item 41's remainder.** Purely mechanical UI
  wiring — `Adjustment`/`Dividend` already had optional `time`/`timezone` from Done item 133's
  type changes, so this just dropped the existing `TimeZoneFields` component + currency-based
  prefill into `AdjustmentForm` and `AddDividendForm` (both exchanges, 4 forms total). Verified
  live via Playwright: each form's timezone field correctly prefilled from workbook currency,
  zero console errors. `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm run build`
  all clean. **Next in this same rollout**: the six non-exchange modules' own add-forms (Cash,
  Bank, Personal Loans, Rentals, Funds, Subscriptions) still don't capture a time — same
  mechanical wiring, not yet done.
- **Time+Timezone rollout completed for the remaining five non-exchange modules (2026-08-25) —
  see README Done item 136, fully closes Pending item 41.** `CashEntry`/`BankTransaction`/
  `PersonalLoanRepayment`/`RentalEntry` all gained optional `time`/`timezone`; `cashRunningLedger`/
  `accountRunningLedger`/`repaymentRunningOutstanding` switched to `toInstantMs`-based sorting
  (same backward-compatible pattern as Done item 133 — untimed records tie at noon-UTC, so
  nothing's existing sort order changed). `TimeZoneFields` wired into Cash/Bank/Personal Loans/
  Rentals/Funds' primary add-forms; Bank's `AddTransactionsForm` and Rentals' `AddEntryForm`
  both needed a new `currencyCode` prop threaded from the selected account/property so the
  timezone prefill has something to key off (a bank account or rental property's currency isn't
  a single workbook-wide setting the way Cash/Personal Loans/Funds' is). Funds needed no type
  change — it reuses the shared `Transaction` type, which already had these fields. **Rule
  reinforced**: before adding a time field to a new record type, check whether it actually has
  a per-entry chronology concern — Subscriptions was skipped because a `Subscription` is a
  single object with a `startDate`, not a dated transaction log, so there's no same-day-ordering
  scenario for a time to resolve; forcing the field on anyway would just be inert UI. Verified
  live via Playwright with seeded data across all five modules — zero console errors. `npx tsc
  -b` / `npm run test` (280 tests, unchanged) / `npm run build` all clean.
- **Click-to-drill-down extended to every ticker-indexed Analytics chart (2026-08-25) — see
  README Done item 137, closes Pending item 17's click-navigation half.** Same idea as the
  Dashboard version (Done item 134's `onClick`/`onHover` on the chart's `options`), factored
  into a `tickerClickOptions(tickers, navigate)` helper duplicated once per exchange's own
  `AnalyticsPage.tsx`, spread into 6 charts each: ROI %, Invested-vs-value, Total P/L, Holding
  period, Portfolio allocation, Dividend-by-ticker. **TS gotcha worth remembering**: this
  helper's `onClick`/`onHover` params needed `any`, not Chart.js's real `ChartEvent`/
  `ActiveElement[]` types — those only resolve through `react-chartjs-2`'s contextual inference
  when the handler is written inline in the `options` JSX prop (as Done item 134 did); a
  standalone function outside that context loses the inference and throws real type errors.
  Verified live via Playwright, including a precise canvas pixel-scan (same technique
  Done item 134 established) to confirm a doughnut's actual ring — not a guessed screenshot
  coordinate — navigates correctly. `npx tsc -b` / `npm run test` (280 tests, unchanged) /
  `npm run build` all clean. Deliberately not done: hover cross-highlighting between separate
  charts, a materially bigger feature than click-navigation.
- **Portfolio page overhaul (Pending item 56) re-audited against the live app, one real bug
  found and fixed (2026-08-25) — see README Done item 138.** This 8-item complaint list from
  2026-08-24 was written against a version of the app several fix-rounds behind current — a
  live re-check found most of it already resolved (colored stat cards from Done item 88, a
  correctly non-zero CGT figure, a current-position card already showing its documented
  fields, a price input that was never actually full-width) and one genuinely still-live bug:
  the "Current position" reference-line bar chart (Buy/Sold/Current/Break-even,
  `PositionDetail.tsx` both exchanges) always drew all 4 bars correctly, but Chart.js's
  `ticks.autoSkip` — which applies to a category y-axis too, not just linear/time scales —
  silently dropped 2 of the 4 axis labels at the chart's original 110/90px height. Fixed with
  `scales: { y: { ticks: { autoSkip: false } } }` plus a small height bump. **Lesson worth
  repeating for any future "is this still a real complaint" check**: a batched user complaint
  list can go stale fast in a project this actively worked — re-verify each sub-item against
  the live page rather than assuming the original report is still accurate, since several
  unrelated fixes in between (Done items 78, 88, 109) had already resolved most of this one
  without anyone tracking it back to this specific Pending item. **Remaining real scope**: the
  right-hand-stack layout ask (moving charts/Price-range to a right column) is genuine and
  unaddressed — folds into Pending item 57's identical structural request, not yet attempted.
  Verified via real before/after screenshots (not assumed) showing all 4 bar labels rendering
  correctly. `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm run build` all clean.
- **Right-hand-stack layout built for PositionDetail, closing Pending items 56/57's remainder
  (2026-08-25) — see README Done item 139.** New `.position-split` CSS grid (`theme.css`,
  1fr + 380px, collapsing to one column under 900px) restructures QSE's/PSX's
  `PositionDetail.tsx`: left column = stat-card sections (Current Position, Open lots for PSX,
  All-time stats), right column = every chart (Daily Price line chart, the Buy/Sold/Current/
  Break-even reference bars — pulled out of the Current Position card into its own small card
  so charts all live together — and Price range). **Accepted tradeoff, not silently dropped**:
  the mobile single-column fallback shows left-column content before right-column content
  (Current Position, then All-time stats, then Daily Price, then Price range) rather than the
  original top-to-bottom order (Daily Price first) — reordering this with flex `order` for a
  mobile-only nicety wasn't judged worth the added complexity. Verified live via Playwright at
  both a wide (1400px, confirms the split) and narrow (500px, confirms the collapse) viewport,
  plus the "All" tab that renders every section on one page at once. **`PositionModal.tsx`**
  (an alternate popup wrapper around the same component, presumably for a quick-glance use case)
  has no live caller anywhere in the app currently — checked before assuming it needed separate
  verification. `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm run build` all clean.
- **First app-wide plain-language copy pass (2026-08-25) — see README Done item 140.**
  Surveyed every stat-card label app-wide and added an explanatory `Tooltip` to the genuine
  jargon: P/L breakdown terms (Dashboard), Cost/break-even and CGT (PositionDetail), Outstanding
  (EMI, Personal Loans), NAV/XIRR (Funds). Two different wiring paths depending on how each stat
  card is built: Dashboard already uses the shared `StatCard` component, so this was just its
  existing `labelTitle` prop; PositionDetail/EMI/Personal Loans/Funds all hand-roll
  `<div className="stat-card card">` markup instead of using `StatCard`, so there it meant
  wrapping the label `<div>` directly in `<Tooltip>` — same pattern `PositionDetail.tsx` already
  used for "Sell price"/"Median (fair value)". Verified live via Playwright hover (not click —
  `Tooltip`'s `onClick` toggles state, so a click-based check can read a real tooltip as broken,
  a lesson from Done item 105). `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm run
  build` all clean. **Explicitly a first pass, not an exhaustive audit** — every non-jargon
  label, table header, and form hint across Bank/Cash/Rentals/Subscriptions was left untouched.
- **Font-picker feature found to have never actually loaded its fonts, fixed (2026-08-25) — see
  README Done item 141, closes Pending item 48.** Investigating "pick a reading-optimized body
  font" found the feature already built (`AppearancePanel.tsx`'s 6-option font `<select>`,
  `theme.css`'s matching `html[data-font=...]` blocks) but never wired to actually load any of
  the 5 non-system web fonts it references (`Inter`/`Space Grotesk`/`JetBrains Mono`/
  `Atkinson Hyperlegible`/`Lexend`) — confirmed via a whole-tree grep for
  `fonts.googleapis`/`@font-face`/`@import url` coming back completely empty. Every one of
  those 5 silently fell back to the generic system sans-serif, making the two fonts explicitly
  marketed as reading-optimized ("max readability", "reading-friendly") visually identical to
  the default. Fixed with one `<link>` in `webapp/index.html`. **Rule for verifying any future
  fix that depends on an external network fetch**: this session's own `curl` successfully
  fetched both the Google Fonts stylesheet and the exact font-file URL it returns, but a
  Playwright pass in this same sandbox hit `net::ERR_CONNECTION_RESET` on the identical
  stylesheet URL — the sandboxed headless browser and this session's own shell hit outbound
  network policy differently, the same gap already seen with the Net Worth FX-rate fetch (Done
  item 66). Don't read a browser-level failure in this specific sandbox as disproving a fix
  that's otherwise a completely standard, low-risk pattern (a `<link>` to Google Fonts) —
  confirm what you can (the endpoint is live, the app has no new regressions) and flag the
  visual confirmation as owed to a future session with real browser access, rather than
  guessing at a workaround for a sandbox-specific network quirk.

## Live URLs

- New React app (QSE + PSX, `#/` and `#/psx`, now including a native Risk
  Analysis page for both — see Current status): **https://ranamrameez.github.io/FinaceMaster/webapp/**
- Legacy apps (`PSX_Trade_Planner.html` and `Risk_Analysis_Calculator.html`
  are both now superseded by React equivalents but left in place — see
  Current status above): **https://ranamrameez.github.io/FinaceMaster/**

## Repo layout

```
MODULES_PLAN.md                                                     design plan for Funds/Banking/Cash/Rentals/EMI-Loans/Personal-Loans (Cash is built, 2026-08-23 — see its own entry; the rest aren't yet)
USER_MANUAL.md                                                      end-user-facing docs — kept up to date alongside features, not a substitute for this file
reference/finance-suite-prototype/                                  external reference prototype (different tech stack, not wired into this app) — see its NOTE.md
index.html, PSX_Trade_Planner.html, Risk_Analysis_Calculator.html   legacy static apps (untouched)
css/, js/, psx/                                                     legacy assets/data
qse-workbook-backup.json, psx/psx-workbook-backup.json              real user data snapshots (see Data safety below)
webapp/                                                              the new React app — all new work happens here
  src/lib/calc/            pure calc engine (fees, positions, cash ledger, P/L) — exchange-agnostic,
                            parametrized by a FeeCalculator; psxFees.ts has the PSX-specific one
  src/store/                createWorkbookStore.ts is a generic factory; workbookStore.ts (QSE) and
                            psxWorkbookStore.ts both use it. appearanceStore.ts is a separate GLOBAL
                            preference store (not per-exchange — see Design decisions below)
  src/lib/firebase/         useAuthState.ts = single shared auth listener; useWorkbookCloudSync.ts =
                            generic per-exchange sync factory; useFirebaseSync.ts (QSE) and
                            usePSXFirebaseSync.ts both use it
  src/features/qse/         QSE-specific pages/components/hooks
  src/features/psx/         PSX-specific pages/components/hooks — mirrors features/qse/'s structure
                            (see Current status above for what's built vs. still open)
  src/features/cash/        Cash module (2026-08-23) — the first non-stock-exchange module,
                            uses createEntryStore.ts (not createWorkbookStore.ts) — see its own
                            entry above and MODULES_PLAN.md §1
  src/features/personalLoans/  Personal Loans module (2026-08-23) — hand-written store (two
                            related arrays), see its own entry above and MODULES_PLAN.md §6
  src/features/bank/        Banking module (2026-08-23) — hand-written store, CSV statement
                            import, see its own entry above and MODULES_PLAN.md §2
  src/features/emi/         EMI/Loans module (2026-08-23) — reuses createEntryStore.ts, see
                            its own entry above and MODULES_PLAN.md §5
  src/features/funds/       Funds module (2026-08-23) — reuses the FULL createWorkbookStore.ts
                            factory (Fund.id plays `ticker`), see its own entry above and
                            MODULES_PLAN.md §3
  src/features/rentals/     Rentals module (2026-08-23) — hand-written store (same shape as
                            Banking), see its own entry above and MODULES_PLAN.md §4 — LAST
                            of the six originally-planned modules, all now built
  src/features/subscriptions/  Subscriptions module (2026-08-24) — seventh module, beyond the
                            original six — reuses createEntryStore.ts (same shape as EMI),
                            see its own entry above and MODULES_PLAN.md §12
  src/components/           shared UI: Modal, ConfirmDialog, SignInModal, Sparkline, Tabs, Sidebar, etc.
  src/types/workbook.ts     QSE types; psxWorkbook.ts has PSX's parallel types
.github/workflows/static.yml   CI: builds webapp/ and deploys it to /webapp/ alongside the legacy
                                root files (see Deployment below — this had a real bug, now fixed)
```

## Design decisions worth knowing before you change anything

- **Standing UI/copy guidelines (user-stated 2026-08-24, apply going forward, not a one-shot
  rewrite):** (1) use the simplest possible language/terms everywhere — this is a tool for
  "all kinds of users, not just pros," not just traders who already know the jargon; tooltips
  on jargon terms (Break-even, Recovery needed, CGT, etc.) are a partial answer, a plain-
  language copy audit is the fuller one (see README Pending item 55). (2) Apply background
  color to the WHOLE card/badge for a data point, not just colored text inside an otherwise
  plain card — `StatCard`'s `hue` prop and the `.pill`/`.pill-*` classes are the established
  mechanisms for this; reach for those before adding a lone colored `<span>`. (3) Card section
  heading text (h3/h4 inside `.card`) should read as a title, not sentence-case description
  text — enforced once, app-wide, via `theme.css`'s `.card h3, .card h4{text-transform:
  capitalize;}` rather than needing to remember it per new heading. (4) "Utilize page space" —
  wide viewports have real unused space on most pages today; see README Pending item 54 for a
  concrete direction (a persistent right-rail panel) that hasn't been built yet.
- **`StatCard`'s two tooltip props mean different things — don't conflate them.** `title`
  shows FULL PRECISION on the *value* (e.g. "12.35M PKR" with a title of the exact number) —
  this is the original, still-most-common use, established for `MoneyValue`-style abbreviated
  numbers. `labelTitle` (added 2026-08-24) explains what the *label* means (e.g. "Break-even"
  → what break-even is) — a completely different job. A future stat card that needs to explain
  jargon should use `labelTitle`, never repurpose `title` for it — every existing `title` call
  site in the app means "precision," and silently changing that would make some other card's
  tooltip say the wrong thing.
- **A Trade Plan is scoped to exactly one ticker (locked 2026-08-24, supersedes an earlier
  same-project decision).** Originally (2026-08-24, same day) a plan had an optional
  "default ticker" that individual legs could still override, deliberately allowing a mixed-
  ticker plan — the user's own words at the time were explicit about wanting that. The user
  later reversed this: "1 ticker may have plans but not vice versa." The newer instruction
  wins per the user's own stated priority rule (recent instructions override older ones on
  conflict) — `NewPlanForm` and `PlanCard` no longer expose a per-leg ticker input at all;
  every leg in a plan uses the plan's own (now-required) ticker. If a future request seems to
  need multi-ticker plans again, don't silently revert this — it was an explicit, repeated,
  deliberate choice, not an oversight.
- **No live third-party market-data API calls, ever, from the app itself
  (locked in 2026-08-23).** Free/cheap tiers cap out fast (20–800 calls/day
  depending on provider) — a design that hits the provider on every page
  load will get rate-limited in production. Fetch on a schedule (cron job /
  worker) into our own database, and serve all app requests from that local
  store; if an unofficial/scraped source breaks, it should degrade the
  refresh job, not the live app. This is the reasoning behind the existing
  `stockData/QSE`/`stockData/PSX` Firebase-node pattern and PSX's bundled
  `psxSeed.ts` fallback — don't design a feature that calls a market-data
  API directly from a page load or user action.
- **No bank account API / open-banking integration for now (locked in
  2026-08-23).** Pakistan's SBP and Qatar's QCB both require regulator
  licensing for this kind of access — a compliance/business-development
  process, not a coding task. When bank-transaction tracking is eventually
  built: primary path is manual entry + statement upload/parsing (PDF/CSV
  → transactions), with the data model designed so a "transaction" doesn't
  care whether it came from manual entry, a parsed statement, or (later) a
  live feed — same shape, different source field. SMS/email transaction-
  alert parsing is an optional, later, additive input source behind that
  same model — don't let it shape the core architecture, and don't start it
  before manual entry + statement upload are solid.
- **Cloud sync safety is non-negotiable.** A prior version of this sync logic
  destroyed the user's real portfolio: it treated a `null`/empty first
  Firebase read as "this account has no data yet" and auto-uploaded local
  (possibly empty) data over it. `useWorkbookCloudSync.ts` now **never**
  writes to the cloud based on an assumption of emptiness — it only reports
  `cloudEmpty` and requires an explicit user-confirmed button click
  (`uploadLocalToCloud`) to ever write when the cloud looks empty. **Do not
  reintroduce any "seed the cloud if it looks empty" pattern**, here or in
  the PSX equivalent or any future module.
- **A linked-transfer pairing's `from`='out'/`to`='in' sign convention
  (`lib/interEntityLink.ts`'s `buildSideRecord`) is only correct when BOTH
  sides hold a real balance of their own** (Bank/Cash/QSE/PSX/Funds) —
  conservation of money means one side's balance falls by exactly as much
  as the other's rises, which is what makes opposite polarity correct.
  **A module with no real balance of its own (Rentals, Personal Loans) is
  a real exception, not an edge case to skip**: its own "type"/amount just
  categorizes what the REAL side's event meant, so the real event's own
  direction (not the from/to convention) decides it. `personalLoans`
  already documents this exception (a repayment is always positive
  regardless of direction); Rentals had the *identical* exception but
  didn't get one, and had its RENT_INCOME/EXPENSE backwards for a full day
  of shipped code before it was caught (README Done item 126) — a real
  financial-correctness bug affecting real linked data, not auto-corrected
  since there's no safe way to guess which past records to fix. **Any
  future module added to this linking system that doesn't hold a real
  balance needs the same explicit "what does the REAL side's direction
  mean for MY type" reasoning walked through before shipping** — don't
  assume the generic from/to convention applies just because it's already
  used for the balance-holding modules.
- **Firebase RTDB silently strips empty arrays/objects at any nesting
  depth, not just the top level.** `set()`ing a value tree where some
  nested field is `[]` or `{}` doesn't store an empty array/object at
  that path — it removes the key entirely, at any depth, so a value
  that goes out as `{ id, legs: [] }` comes back as `{ id }` (no `legs`
  key at all). A root-level empty array on a workbook (e.g.
  `tradePlans: []`) is already safe everywhere via the
  `{...createEmpty(), ...cloudData}` merge in both
  `loadFromLocalStorage` and the cloud-sync pull handler — but a
  *nested* empty array (an array field inside one element of another
  array, e.g. `TradePlan.legs`) has no such default to fall back on and
  will come back missing the key entirely. This caused a real crash
  (README Done item 52: Trade Planner crashed after deleting a plan's
  last leg). Fixed for `TradePlan.legs` in `createWorkbookStore.ts`'s
  shared `normalize()`. **Any future module that adds a nested array
  field (an array inside an array-of-objects) needs the same "restore
  the missing key to `[]` on normalize" treatment** — audited every
  other workbook type in the codebase when this was found and
  `TradePlan.legs` was the only instance of this pattern at the time.
- **No `window.confirm()` / `window.alert()`.** These are unreliable across
  browsers/webviews (this caused a real "stuck on login" bug — a confirm()
  never resolved true). Use `components/ConfirmDialog.tsx`'s `confirmDialog()`
  instead, everywhere.
- **`confirmDialog()`/`ensureSignedIn()` called from inside an already-open
  page-level `Modal` need `zIndex` set correctly, or found out the hard way
  (README Done item 124).** `ConfirmDialogHost`/`SignInModalHost` are mounted
  once near the app root (before routed page content in the DOM); a
  page-level `Modal` (Bank's `AccountDetailModal`, Rentals'
  `PropertyDetailModal`, etc.) calling either of them from inside itself
  creates two `.modal-overlay`s at the same default z-index (100) — and
  since same-z-index elements stack by DOM order, the page-level one (mounted
  later, deeper in the tree) painted ON TOP, burying the confirm/sign-in
  dialog's buttons underneath it, unclickable. This was a real, previously-
  undiscovered bug already latent in the lease-based Rentals plans' own
  "Mark as done" and reachable from Bank's `AccountDetailModal` too — just
  never triggered/noticed before. Fixed by giving `Modal` an optional
  `zIndex` prop (same escape hatch `TermsGateModal` already used its own
  inline `zIndex:1000` for) and setting `ConfirmDialogHost`/`SignInModalHost`
  to `zIndex={300}` — above any regular `.modal-overlay` (100) and the
  mobile sidebar drawer (150/200), below the Terms gate (1000). **Any future
  new page-level Modal that calls `confirmDialog()`/`ensureSignedIn()` from
  inside itself already gets this for free** (the fix is in the shared
  `ConfirmDialogHost`/`SignInModalHost`, not per-caller) — nothing more to
  do there. Confirmed via Playwright with a real click-hittability check,
  not just a screenshot: an initial attempt's confirm-button click timed out
  with Playwright reporting a stray underlying-modal input "intercepting
  pointer events" at the button's coordinates — a real interaction bug, not
  a test-script artifact.
- **No "local-only" account-less data entry.** Browsing and calculators are
  open to everyone; *saving* anything requires sign-in, enforced via
  `lib/firebase/useEnsureSignedIn.ts` + `components/SignInModal.tsx`
  (`requireSignIn()`) at the point of every write action, not a full-page
  gate. This was a deliberate reversal from an earlier full-page auth gate —
  don't reintroduce the full gate.
- **`appearance` (theme/font/color/density) is a global preference**
  (`store/appearanceStore.ts`, its own localStorage key), not part of any
  per-exchange workbook — it used to live inside the QSE workbook and that
  caused a real bug (theme flickering/resetting between exchanges, and a
  duplicate-default bug that fought the "light mode by default" fix). Keep
  it global when PSX's UI is built; don't add a per-exchange appearance
  field back.
- **The calc engine's `FeeCalculator` type takes an optional third
  argument**: `(amount, isBuy, context?: {shares?, tx?}) => number`. QSE's
  calculator ignores it; PSX's uses `context.shares` for per-share fee tiers
  and `context.tx` to net same-day buy/sell commissions against each other.
  When wiring new calc call sites, pass `{ shares: tx.shares, tx }` when you
  have a real transaction, `{ shares }` when you only have a hypothetical.
- **Prices display at 4 significant figures**, not a fixed decimal count
  (`lib/format.ts`'s `fmtPrice`) — this was an explicit README fix (item 3).
- **Sparklines are plain SVG, not Chart.js** (`components/Sparkline.tsx`) —
  deliberately cheap since they render once per table row.
- **HashRouter, not BrowserRouter** — required for GitHub Pages (no
  server-side rewrite available), and it's what makes the subpath deploy
  below work without extra configuration.
- **Theme/appearance attributes must be applied synchronously, not in a
  `useEffect`.** `App.tsx`'s `useApplyAppearance()` sets `data-theme` etc. on
  `document.documentElement` directly in the render body on purpose — a
  `useEffect` there runs *after* children (including chart components) have
  already mounted and read the CSS vars those attributes gate, which was a
  real bug (see Current status above). Any future code that needs a
  CSS-var-derived value at first paint has the same hazard; either read it
  synchronously like this, or make the consuming component subscribe to
  `useAppearanceStore` so it re-renders when appearance changes.
- **Chart.js `options`/`plugins.datalabels` colors computed from CSS vars
  (`lib/chartLabels.ts`'s `cssVar()`) are only recomputed when the owning
  React component re-renders** — react-chartjs-2 doesn't know to recompute
  them just because `<html>`'s attributes changed elsewhere. Any page with
  charts (`DashboardPage`, `AnalyticsPage`, `PositionDetail`) subscribes to
  `useAppearanceStore` for exactly this reason; keep doing that for new
  chart-bearing components.

## Local dev setup

**Node.js is not installed globally on the primary dev machine** — a portable
Node was extracted to `%USERPROFILE%\node-portable\node-v24.19.0-win-x64` and
added to the user's PATH via `setx`, but a *new* PowerShell/Bash session
still needs `$env:Path += ";$env:USERPROFILE\node-portable\node-v24.19.0-win-x64"`
prepended to every command in-session (the PATH change doesn't propagate to
already-open shells). Check `node --version` first on a new machine; if
Node is properly installed there this workaround isn't needed.

```bash
cd webapp
npm install
npm run dev      # Vite dev server
npm run test     # Vitest — calc engine tests, verified against real backup data
npm run build    # production build to webapp/dist
```

There's a `.claude/launch.json` for the `preview_start` dev-server tool —
it hardcodes the portable-Node path above, so it's machine-specific and
**gitignored on purpose**; recreate it per-machine if needed (or fix Node
to be on PATH properly and simplify it).

## Deployment (GitHub Pages)

`.github/workflows/static.yml` builds `webapp/` in CI and assembles a clean
`_site/` staging directory (legacy root files + only `webapp/dist`'s
*built* output at `/webapp/`) before uploading — **do not revert to
uploading the whole repo as-is** (`path: '.'`), that was a real bug: it let
`webapp/index.html` (Vite's *unbuilt* dev entry template, which also exists
at that path) shadow the actual built `webapp/dist/index.html` at the same
URL, so GitHub Pages served the raw dev-mode page instead of the app.

`webapp/vite.config.ts` sets `base: '/FinaceMaster/webapp/'` to match this
subpath deployment. If the deploy path ever changes, update both the
workflow's staging step and this `base` value together.

Push to `main` to deploy (auto-triggers the workflow). Watching a deploy
without `gh` CLI (not installed on the dev machine): poll
`https://api.github.com/repos/ranamrameez/FinaceMaster/actions/runs?per_page=1`
for `status`/`conclusion`, or just check the live URL after ~1-2 minutes.

**Git push from the dev machine can hang** waiting on an interactive Git
Credential Manager prompt on first push of a session — if `git push` seems
stuck, it's very likely that; ask the user to check for a sign-in
window/prompt on their screen rather than assuming failure.

## Data safety note

`qse-workbook-backup.json` and `psx/psx-workbook-backup.json` at the repo
root are **real personal trading data snapshots** the user provided, kept in
sync manually. They're also used as Vitest fixtures
(`webapp/src/lib/calc/__tests__/fixtures/`) — `qse-workbook-backup.json`'s
copy is pinned to specific hand-verified expected values in `calc.test.ts`;
`psx-workbook-backup.json`'s copy (added 2026-08-23) is used more loosely by
`psxFees.test.ts` (pipeline-runs-clean + a couple of settings-dependent spot
checks, not fully hand-traced per-row). Don't casually overwrite either
fixture copy when refreshing the root backup files without checking whether
the tests' expected values still hold.

## Firebase

Same Firebase project (`qse-app`) and RTDB paths as the legacy apps are
reused deliberately, so existing users' cloud data loads unchanged:
`users/{uid}/workbook` (QSE), `users/{uid}/psx` (PSX, wired to the UI as of
2026-08-23), `users/{uid}/profile` (display name + emoji avatar). There's also a shared
public node `stockData/QSE` (ticker names + fundamentals) that the app
prefers over the bundled fallback in `lib/stockData/qseSeed.ts` — it hasn't
actually been seeded in Firebase yet, and its RTDB rules likely require
auth (needs RTDB console access neither Claude nor this doc has to confirm/
change); reads of it currently fall back gracefully. `useQSEStockData.ts`
only *attempts* the read once signed in — a signed-out visitor is a
guaranteed permission-denied, and the Firebase SDK logs that to the console
itself before app code's own catch runs, which isn't something app code can
suppress, so the read is skipped entirely for the common signed-out/
browsing case instead. If a signed-in user still sees a permission-denied
for this path, that's the RTDB rules and needs the user to change them. The
Firebase client config in `lib/firebase/client.ts` is intentionally public
(client-side Firebase keys aren't secrets — access control is enforced by
RTDB security rules, not by hiding the config).
