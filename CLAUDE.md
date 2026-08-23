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

## Live URLs

- New React app (QSE + PSX, `#/` and `#/psx`): **https://ranamrameez.github.io/FinaceMaster/webapp/**
- Legacy apps (still authoritative for Risk Analysis; `PSX_Trade_Planner.html`
  is now superseded by the React PSX module but left in place — see Current
  status above): **https://ranamrameez.github.io/FinaceMaster/**

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
  src/components/           shared UI: Modal, ConfirmDialog, SignInModal, Sparkline, Tabs, Sidebar, etc.
  src/types/workbook.ts     QSE types; psxWorkbook.ts has PSX's parallel types
.github/workflows/static.yml   CI: builds webapp/ and deploys it to /webapp/ alongside the legacy
                                root files (see Deployment below — this had a real bug, now fixed)
```

## Design decisions worth knowing before you change anything

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
- **No `window.confirm()` / `window.alert()`.** These are unreliable across
  browsers/webviews (this caused a real "stuck on login" bug — a confirm()
  never resolved true). Use `components/ConfirmDialog.tsx`'s `confirmDialog()`
  instead, everywhere.
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
