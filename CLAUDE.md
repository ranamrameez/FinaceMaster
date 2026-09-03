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
- **Console density made genuinely information-different, not just smaller (2026-08-25) — see
  README Done item 142.** Console density already had real measurable spacing/font-size
  differences (Done item 111), but every stat card's `.sub` secondary line (break-even color
  hint, avg/last sell price, etc.) was still shown, just shrunk — exactly the "themes/densities
  are just resizing, not a different experience" complaint. Changed `.stat-card .sub` to
  `display:none` under Console density so it genuinely shows less information, not the same
  information smaller. Verified live via Playwright: the same card's `.sub` element is visible
  under Comfortable, hidden under Console. Deliberately scoped to density only — the color-theme
  half of the same Pending item (item 50) is a more speculative design question and remains
  open.
- **Risk Analysis made reachable from a stock's own page, closing the named half of Pending
  item 49 (2026-08-25) — see README Done item 143.** "Assess a stock in one go" previously
  meant leaving `StockPage.tsx` for a separate whole-portfolio Risk Analysis page and re-picking
  the same ticker there. `RiskCalculator.tsx` gained an optional `initialTicker` prop (defaults
  the existing ticker `useState` instead of the auto-pick-first-held-ticker `useEffect`, which
  now simply never fires when a caller supplies one) — the standalone `RiskAnalysisPage.tsx`
  never passes it, so it's completely unaffected. Both QSE's and PSX's `StockPage.tsx` gained a
  new "Risk Analysis" tab, conditionally spread into the `Tabs` array only when
  `positions.find(p => p.ticker === ticker)?.shares > 0` — same open-position gate
  `PositionDetail`'s own "Current position" section already uses, since averaging-down analysis
  needs a real position to analyze. Verified live via Playwright both directions: the tab
  appears and pre-fills to the seeded ticker on an open QSE position, and is correctly absent on
  a fully-closed PSX position. `npx tsc -b` / `npm run test` (280 tests, unchanged) / `npm run
  build` all clean. **Deliberately scoped down**: the broader "is `PositionDetail`'s own layout/
  section order truly optimal" information-architecture question — the fuller reading of Pending
  item 49 — was not attempted, only this specific named "Risk Analysis is a separate page" gap.
- **Second plain-language tooltip pass, EMI/Personal Loans/Subscriptions (2026-08-25) — see
  README Done item 144.** Extends Done item 140's pattern to genuine jargon in the non-exchange
  modules: "Principal" (Personal Loans' stat card + both modules' add-loan forms), "Amortization
  schedule" (EMI's chart heading), "Total interest/markup (life)" (EMI — the "(life)" qualifier
  wasn't self-explanatory), and "Monthly/Yearly equivalent" (Subscriptions — these are
  normalized figures, not necessarily the literal next-charge amount for a non-monthly-billed
  subscription). Deliberately left Bank/Cash/Rentals' section headings ("By category", "Net
  income", "Monthly rollup") untouched — already plain English, not jargon needing a tooltip.
  Verified live via Playwright hover with seeded data across all three modules (seeded via
  `page.addInitScript`, not `page.evaluate` after load — a Zustand store's
  `workbook: loadFromLocalStorage()` runs once at module-init time, so setting `localStorage`
  after the app has already loaded is too late; a hash-only `page.goto` doesn't force a fresh
  module load either, since HashRouter navigations are same-document). `npx tsc -b` / `npm run
  test` (280 tests, unchanged) / `npm run build` all clean.
- **App-wide `.main` max-width bump, 1180px → 1600px (2026-08-25) — see README Done item 145,
  the measurable half of Pending item 54.** Measured before touching anything: at a 1920px
  viewport, `.main`'s bounding box was exactly 1180px wide with the 220px sidebar — ~520px of
  the viewport was simply unused margin, on every page, not just one. Bumped the cap to 1600px
  rather than removing it, since every page's stat-card/chart grids use
  `repeat(auto-fit, minmax(...px, 1fr))` — they absorb the extra width as more columns
  automatically (verified: QSE Dashboard's stat-card row went from 6 to 8 columns at 1920px),
  so no per-page layout work was needed, but an *unbounded* width would make a single card or
  narrow form absurdly wide on an ultrawide monitor instead. Verified live via Playwright across
  4 pages (Dashboard/Portfolio/Bank/Cash) at 1920px: `.main` measured 1600px on all four,
  `document.documentElement.scrollWidth` matched the viewport exactly (no new horizontal
  overflow), and a Dashboard screenshot confirmed the extra columns render cleanly. **Still
  open**: this only lets existing grids use more width — it doesn't add new right-rail content
  (a contextual glossary, a live summary panel), which is the deeper, more judgment-heavy half
  of Pending item 54 and ties into item 49's IA question.
- **Funds "Snapshot Import" built (2026-08-25) — see README Done item 146.** The user uploaded
  a real personal tracking CSV (per-fund Total Invested/Withdrawn/Current Balance, several
  Pakistani mutual fund platforms) and asked to "feed this data to my account." Since this
  session has no access to the user's real signed-in browser/account (and this project's own
  locked cloud-sync-safety principle rules out creating a throwaway account against the
  production Firebase project to do it directly), asked via `AskUserQuestion` how to proceed —
  the user chose "build a CSV importer" over manual walkthrough, and separately clarified two
  real data-quality issues in their own file: one row was mislabeled (should be MCB Live & MCB
  iSave / ALHIIF / Alhamrah Islamic Income Fund, not a second "JS Cash Fund" row) and the
  trailing bank-balance table (rows 15+) should be ignored for this import. Built
  `lib/calc/fundsSnapshotImport.ts` + a new "Import" tab on `FundsPage.tsx` — see README Done
  item 146 for the full design (a snapshot has no per-trade dates, so it reconstructs one
  synthetic buy/sell per fund at whatever NAV reproduces the reported balances exactly) and
  MODULES_PLAN.md if extending this to another module later. **Verified against the user's own
  real uploaded file via Playwright**, including editing the real mislabeled row inline in the
  preview and confirming the duplicate-fund-code warning fires correctly for both the mistake
  and the genuine ALHISF double-entry — but the actual import was never completed end-to-end
  into the user's real account, since that requires a real signed-in click this session
  correctly can't perform. **A future session should not assume this data has been imported** —
  check with the user, or check the Funds page's own fund list, before assuming this file's
  data already exists in their workbook.
- **Hover cross-highlighting, QSE/PSX Dashboard first pass (2026-08-25) — see README Done item
  147.** A shared `hoveredTicker` page-level state links Dashboard's Allocation and P/L-by-
  ticker charts: hovering either dims every other ticker in BOTH. New `dimColor()` in
  `lib/chartLabels.ts` (alpha-suffix dim, not a background-mix — correct under any chart
  background, unlike blending toward an assumed one). Hit the same TS-inference gap already
  documented for Done item 137's click-navigation helper: factoring the `onHover`/`onClick`
  handlers into a standalone `tickerHoverHandlers()` function loses react-chartjs-2's contextual
  type inference for Chart.js's real event types, so the helper's params need `any` — this only
  happens when the handler is written as a separate function, not inline in the `options` JSX
  prop. Verified with real pixel sampling (not a visual guess): the non-hovered bar's canvas
  alpha dropped from 255 to ~94 on hover, and the SAME hover measurably dimmed the doughnut's
  pixels too (opaque count 43,988 → 23,555), confirming the two charts are genuinely linked.
  **Still open**: Analytics' 6 ticker charts per exchange (12 total) aren't linked yet — a larger
  follow-up, not attempted here.
- **Net Worth page 6-item feedback batch + Risk Analysis/Trade Transactions ticker links +
  Portfolio's missing Value column, all 2026-08-25 — see README Done items 148/149/150.**
  Net Worth: a real bug (not a design nit) was the "oddly showing text bg" report — the big
  number was `<div className="stat-card" style={{padding:0}}>`, missing the `.card` class every
  other stat card has, so `.stat-card`'s own `--card-hue` gradient background (which exists
  independent of `.card`) rendered edge-to-edge with no inset/rounding once `padding:0` killed
  the CSS's own padding — fixed by using the real `StatCard` component instead of hand-rolled
  markup. **Rule reinforced**: always build a stat card through `StatCard`, never hand-roll
  `<div className="stat-card">`-only markup — it's missing the `.card` class every real usage
  needs. Also added a `breakdown: {module, amount}[]` field to `computeNetWorthByCurrency()` so
  the UI can show which modules contributed to a currency's total, prefilled the Manual rate
  override's Rate field from any already-known cached rate for the picked currency (previously
  always blank), and put the per-currency `<details>` cards in a responsive grid instead of a
  full-width stack. Risk Analysis: `RiskCalculator.tsx` gained an optional `stockPageUrl` prop
  for a "TICKER's page →" link next to the ticker picker — passed by the two standalone
  `RiskAnalysisPage.tsx` files, deliberately omitted from `StockPage.tsx`'s own embedded tab
  (Done item 143) since that would link to itself. Trade Transactions: the ticker cell in both
  exchanges' trade-list table is now a real `<Link>` to that stock's page. Portfolio: its
  Holdings table (`OpenPositionsTable`) was missing the "Value" column (worth + invested + ▲/▼)
  that Dashboard's own Holdings table already had from Done item 85 — added it directly rather
  than via a popup (the user asked whether a popup would be safer; a direct column was simpler
  since the underlying `gross`/`invested` values were already computed, just not surfaced).
  Verified live via Playwright throughout (manual-rate prefill, breakdown text, grid layout,
  both ticker links, and the new Value column's exact rendered text against a seeded position).
  `npx tsc -b` / `npm run test` (281 tests, 1 new) / `npm run build` all clean.
- **Funds "Daily History Import" built (2026-08-26) — see README Done item 151, supersedes
  Snapshot Import as the primary way to load real fund data.** Same day as item 146 above, the
  user pushed back hard: the CSV snapshot importer only captures a final balance, but they
  track every fund's balance *day by day* ("i have added all balance changes day by day. you
  cannot ignore them!") and specifically want average monthly/annual P&L computed from that
  real history, correctly accounting for holidays contributing nothing (not to be smoothed
  over with a naive per-calendar-day average). Asked two design questions via
  `AskUserQuestion` before building — averaging method (mean of real month/year totals, not an
  XIRR-style rate) and how this interacts with the Snapshot Import they'd *already run against
  their real account* (answer: this must **replace** a matched fund's transactions, not stack
  another set on top, closing the exact gap this file's earlier "Snapshot Import" note said
  the app couldn't do). Full design in README Done item 151: `lib/calc/
  fundsDailyHistoryImport.ts` reconstructs real buy/sell/NAV history from a
  Date/PrvBlc/NewBlc/Profit-Loss log (the key insight: `PrvBlc` is the user's own manually-set
  opening balance for that update, not necessarily the prior row's close — so a gap between
  them is exactly how a real deposit/withdrawal announces itself, cleanly separated from
  organic growth), and `lib/calc/fundsModule.ts`'s new `organicPLByPeriod` makes monthly/
  annual P&L an ongoing derived stat from whatever a fund already has stored, not just a
  one-time import-preview number — a cross-check test between the two independent derivations
  (raw daily log vs. reconstructed transactions/priceHistory) caught a real bug (a dropped
  first-day growth figure) before it ever reached real data. **New dependency added, with a
  known tradeoff stated plainly, not hidden**: the `xlsx` (SheetJS) package, at the last
  npm-published version (0.18.5) since newer fixed releases only ship from SheetJS's own CDN,
  which this sandbox's network policy blocks — `npm audit` flags one high-severity advisory
  with no npm-available fix. Judged the practical exposure narrow (a self-uploaded personal
  file, never fetched from a third party or shown to any other user, so the realistic worst
  case is a user attacking their own browser tab) against the heavier, still-not-fully-clean
  alternative (`exceljs`, ~90 extra transitive packages) and proceeded, but this is flagged
  here and in the README for a future security-focused pass if a way to reach SheetJS's
  patched CDN build opens up. Verified live via Playwright against the user's real uploaded
  xlsx (reconstructed values matched reported balances exactly for every identifiable fund)
  plus a seeded pre-existing fund to exercise the replace path (correct auto-match, correct
  existing-transaction count in the destructive-replace warning, correct confirm-dialog
  wording, real sign-in gate fired before any write) — zero console errors. `npx tsc -b` /
  `npm run test` (305 tests, 17 new) / `npm run build` all clean. **Same caveat as item 146**:
  the actual import was never completed end-to-end into the user's real account (this session
  cannot sign in as them) — a future session should confirm with the user or check the Funds
  page directly rather than assuming this data has landed.
- **New 2026-08-26 batch, first half: Exit targets/Status brought to Dashboard + StockPage — see
  README Done item 152.** Portfolio's own Holdings table had grown two columns (Exit targets,
  Status) Dashboard's copy never got, and neither existed on `PositionDetail.tsx` at all — added
  both in the same duplicated-per-page style this table already uses. **Rule from Done item
  122 correctly applied here, not re-broken**: `PositionDetail`'s new Status stat card uses the
  card's own `hue` (green/red) to signal state, NOT a `.pill-buy`/`.pill-sell` class stacked
  inside it — that combo is exactly the "double-colored card" anti-pattern Done item 122 fixed;
  the table-cell versions on Dashboard/Portfolio correctly keep using `.pill-buy`/`.pill-sell`
  since a colored badge inside an otherwise-plain table row is the sanctioned use for *that*
  context. Verified live via Playwright with a seeded up/down position pair.
- **New 2026-08-26 batch, second half: Net Worth redesigned again — see README Done item 153.**
  Split the previous single Card into two side-by-side ones ("Net worth summary" with the
  currency picker moved inside it, "Exchange rates" as its own full Card). Replaced
  `useLastCurrency`'s hardcoded `'USD'` fallback with "whichever currency has the largest
  absolute net exposure." New `effectiveRate()`/`setCrossRate()` in `lib/fx.ts` let the user set
  a rate between ANY two held currencies directly, solving for whichever leg isn't already
  anchored to the internal USD base — the base itself never changes meaning, only the UI's
  "USD-only" restriction was lifted. **A real bug caught live via Playwright before commit, not
  by the unit tests written alongside it**: the first version of `setCrossRate` always solved
  for `to`'s rate, which corrupted the shared USD anchor itself whenever `to === 'USD'` (e.g.
  "1 QAR = 0.3 USD" got written as `rates.USD = 1.092`, silently breaking every other currency's
  rate since they're all relative to *1 USD = 1*) — confirmed via a direct `localStorage`
  read after saving, fixed by special-casing `to === base` to solve for `from` instead, with a
  new regression test added. **Lesson**: a rate/unit-conversion function with a designated
  "anchor" value needs an explicit test for "what happens when the thing being solved for IS the
  anchor" — the obvious happy-path tests (each leg is a distinct non-anchor currency) don't
  exercise this at all. Also added: a read-only pairwise-rate table for the user's own
  currencies; a "Capital split by currency" Doughnut chart (skips a currency with negative net
  worth — a doughnut can't show a negative slice); three new stat cards (Total debts, Today's/
  This month's net flow, via new tested `flowByCurrency()` combining Cash's unsigned entries and
  Bank's signed transactions by date range); and a global `.stat-card` gradient softening (16%
  hue mix → 7% + a faint glass-sheen highlight, applied identically to the base rule and both
  per-theme overrides so they can't drift out of sync again). **Deliberately not built**: a
  real net-worth-over-time chart — needs periodic historical snapshots this app has never taken,
  a genuine new design decision (cadence, storage) not guessed at here; see the new README
  Pending item 64.
- **EMI per-month installment overrides — item 6 of the same 2026-08-26 batch (2026-08-26) —
  see README Done item 154.** User's example: a property installment plan can have irregular
  real terms ("Banks loan 10005 EMI 1000 and last one 1005," or a bigger payment every 6
  months) a flat EMI can't represent. Asked via `AskUserQuestion` since this was a genuine
  multi-way design fork with real correctness implications (recurring-pattern rule vs. per-
  month override table vs. both); the user chose **per-month override table**. `EMILoan` gained
  `installmentOverrides?: Record<number, number>` (1-indexed month → actual payment);
  `emiSchedule()` substitutes it into both repayment modes and recalculates every later month
  from what was actually paid — interest mode's existing sequential balance loop needed no new
  state (`payment = overrides[m] ?? emi` before `principalComp = payment - interest`);
  fixedTotal mode (no compounding) keeps the same principal:markup **ratio** as the regular
  installment on an overridden month, so a bigger payment splits proportionally bigger on both
  sides. **New: the schedule now stops early once balance clears** (same idea
  `whatIfExtraPayment` already used), so a large override can finish a loan before its
  original tenure — `emiSummary()`'s `elapsed`/`monthsRemaining` clamp against the actual
  `rows.length` instead of `loan.tenureMonths` now, and `paidSoFar` sums each row's own real
  payment instead of `elapsed * emi` (identical result when nothing's overridden, but
  necessary once rows can differ). **Rule for any future schedule-engine change**: once a
  per-row engine (interest mode was already one) needs to support an arbitrary payment
  amount instead of a fixed one, check whether every *downstream* consumer of that schedule
  (here: `emiSummary`) still assumes a fixed row count or a fixed per-row amount — both
  assumptions were baked into `emiSummary` and both had to be fixed, not just `emiSchedule`
  itself. UI: `EMIPage.tsx`'s existing "Schedule (next 12 installments from today)" table
  gained a per-row pencil icon (inline amount input, Save/Cancel), an "(custom)" tag on an
  overridden row, and an X to reset a month back to regular — scoped to the table's existing
  upcoming-months window only, not past months (a planning tool, not a payment-history
  editor). Uses `ensureSignedIn` before either write, per this file's locked sign-in-gated-
  write rule — note this file's own existing "Edit loan" Save button in the same component
  does NOT have that gate (a pre-existing gap, not introduced or fixed here). Verified live
  via Playwright: a $1200/12-month 0%-interest loan with a 300 override at month 8 (vs. the
  regular 100) showed the "(custom)" tag, correctly recalculated month 9 off the new lower
  balance, and correctly stopped the schedule at month 10 (2 months early) — matching every
  stat card and the amortization chart. New tests: `emiModule.test.ts` gained 5 cases. `npx
  tsc -b` / `npm run test` (322 tests, 5 new) / `npm run build` all clean.
- **Hover cross-highlighting extended to Analytics' ticker charts, closing README Pending item
  17 in full (2026-08-26) — see README Done item 155.** Done item 147 linked only Dashboard's
  2 ticker charts per exchange; this pass does the deferred 12-chart (6 per exchange)
  Analytics remainder. Both `AnalyticsPage.tsx` files gained the same page-level
  `hoveredTicker` state Dashboard uses; the existing `tickerClickOptions()` click-to-drill-down
  helper (Done item 137) gained a `setHovered` param so click and hover share one function
  instead of two parallel ones. `dimColor()` applied to all 6 ticker charts per exchange — 3
  in the "Performance" tab section, 1 in "Allocation," 1 in "Activity & dividends" — so
  hovering a bar in one tab correctly dims a slice in a completely different tab section,
  proving the cross-highlight spans `Tabs` boundaries, not just one visible card grid.
  **Verification note worth repeating for any future Chart.js hover-target test**: a
  horizontal bar chart's actual bar pixels can't be reliably guessed from a screenshot alone
  (padding/legend/axis space eats into the canvas) — swept a grid of candidate points and
  used the `cursor: pointer` style Chart.js's own `onHover` sets as the real signal for "this
  point is actually on a bar," then hovered that exact point for the before/after screenshot
  comparison. Confirmed on both QSE (hovering QIBK dimmed QNBK/CBQK in the same chart, in
  "Total P/L by symbol," and in "Portfolio Allocation" one tab section over) and PSX
  (identical pattern with OGDC/PPL/SNGP) — zero console errors on either. `npx tsc -b` / `npm
  run test` (322 tests, unchanged — pure UI wiring on the already-tested `dimColor`) / `npm
  run build` all clean.
- **EMI/Loans gains a real repayment ledger + becomes linkable; Net Worth gains an on-demand
  history snapshot + chart; a real cross-account data-leak bug fixed (2026-08-26) — see
  README Done items 156-159, closing Pending items 21/62's remainder, 64, and part of 63.**
  This work was picked up autonomously (a "continue until pending tasks completed" session,
  not a new user report), working down the README's own Pending list per this file's standing
  instruction. **EMI**: new `EMIRepayment` type + a hand-written `emiWorkbookStore.ts`
  (converted from the old `createEntryStore`-based one, same "two arrays don't fit the
  single-array shape" reasoning Personal Loans already established) that keeps a real,
  addressable repayment log in sync with the existing `installmentOverrides` schedule
  mechanism as one write — `emiSchedule()`'s own calculation logic is completely untouched.
  EMI joined cross-entity linking (`LinkModule` gained `'emi'`) — the last module named in
  MODULES_PLAN.md §8 to do so. **Net Worth**: locked the three design decisions Pending item
  64 had explicitly left open (on-demand-only snapshot cadence, its own separate Firebase
  node, frozen-never-retroactively-rewritten semantics) and built a real history line chart
  on top. **The data-leak bug** was found by auditing `resetAllLocalWorkbooks()` before
  adding to it — Subscriptions and all three Planned* stores (Cash/Bank/Rentals) had been
  added to the app after that function was last written and were silently never wired in,
  meaning switching accounts on the same browser leaked those 4 stores' data into the next
  account. Fixed by adding all 4 plus the 2 new stores from this session. **Rule reinforced
  for any future new per-account local store**: wire it into `resetAllLocalWorkbooks()` at
  creation time, not as a later afterthought — this is the second time this exact gap class
  was found only by an unrelated audit. Also: a responsive-grid pass on PSX Settings' "Fees &
  amounts" tab (its 4 sub-cards used to stack full-width) as one concrete instance of Pending
  item 63, after auditing every other module's landing/Settings page and finding they
  genuinely don't fit the same pattern (each card serves a different purpose in a
  form→list→Account shape). Also closed out Pending item 47 (Tooltip/native-`title` sweep)
  with a final audit — the remaining native `title=` spots are all deliberate, reasoned
  exceptions (self-explanatory one-word button labels, and inputs where wrapping in
  `Tooltip` would pop a popup open on every click-to-edit), not oversights. Verified via
  `npx tsc -b` / `npm run test` (330 tests, 8 new) / `npm run build`, all clean, plus live
  Playwright checks (EMI's Transfers-page picker, EMI's repayment-save and Net Worth's
  snapshot-save both correctly hitting the real sign-in gate rather than silently failing,
  and a real before/after screenshot of the PSX Settings grid). Opened as PR #5 (draft) on
  branch `claude/pending-tasks-completion-sg0imx` rather than direct-to-`main`, per this
  specific session's own harness-level branch instructions — this doesn't supersede this
  file's own "commit into main directly" standing instruction for a normal local session,
  it's how this particular remote/web session was invoked. **PR #5 merged into `main`
  same day (2026-08-26)** at the user's explicit request.
- **Two follow-up user reports, same session, after PR #5 merged (2026-08-26) — see README
  Done items 160/161.** (1) Critical bug: a stock's Current Price input on
  `PositionDetail.tsx` (QSE + PSX both had the identical bug) visibly "disappeared" right
  after saving — `commitPrice()` correctly called `setMarketPrice()` (confirmed by reading
  the store: it persists correctly) but then reset the local `priceInput` state to `''`
  instead of re-filling it with what was just saved, so the box looked empty even though the
  save worked. Fixed by re-filling with the saved value. (2) New feature: EMI/Loans gained
  `EMILoan.customMonthlyPayment` — a single fixed payment applied to every month, with the
  schedule engine auto-"true-ing up" the final installment to whatever's actually still owed
  (balance + that month's interest/markup) instead of repeating the custom amount and
  over/under-paying. Distinct from and compatible with the existing per-month
  `installmentOverrides` (a manual override on the final month still wins over the
  auto-balloon). Implemented for both repayment modes. New `EMIScheduleRow.isBalloon` flag
  shows "(final payment)" in the Schedule table, distinct from a manual "(custom)" override
  tag. Verified live via Playwright (seeded 1200/12mo/0% loan, 50/month custom payment:
  months 1-11 each 50.00, month 12 "650.00 USD (final payment)" — matches hand-traced test
  expectations exactly) plus 8 new unit tests. `npx tsc -b` / `npm run test` (338 tests,
  8 new total across both fixes) / `npm run build` all clean. Since this session's designated
  branch (`claude/pending-tasks-completion-sg0imx`) was already merged as PR #5, this
  follow-up work restarts that same branch from the latest `main` per this session's own
  harness instructions (a merged PR can't be reused/reopened) and opens as a NEW pull
  request, not a reopened PR #5.
- **EMI/Loans direct transfer-link shortcut, new session (2026-08-26) — see README Done item
  162, closes Pending item 62 in full.** The last module without the inline "Link this to a
  Bank account or Cash" shortcut every other linked module already had — EMI's own "add a
  transaction" moment is the Schedule table's pencil-editor (`saveOverride`), not a blank
  add-form, so the checkbox was wired into that inline row instead of a new form. Verified
  live via Playwright: checking it reveals a module/account picker prefilled from the only
  seeded bank account, and "Link & add" correctly hits the real sign-in gate. `npx tsc -b` /
  `npm run test` (338 tests, unchanged) / `npm run build` all clean. This session's branch
  (`claude/continuation-3m98ma`) started fresh at `main`'s latest merged commit (0a5ea88, PR
  #7), per the "a merged PR can't be reused" rule already established above.
  **Right after this, the user asked for a substantially bigger EMI scheduling feature
  mid-turn (2026-08-26)** — full start-to-end schedule with dates (not just the next-12
  window), a whole-loan default payment day-of-month plus per-installment override, a
  Paid/Upcoming/Planned visual distinction, a recurring "bigger EMI every N months" pattern
  (default 6), and an "add unreconciled amount to last month" checkbox. This has several real
  design forks (how the recurring big-payment amount is specified, how it interacts with the
  existing per-month `installmentOverrides` and the existing `customMonthlyPayment` balloon
  logic from Done item 161) — being scoped/asked about before implementation, per this
  file's own standing practice for genuine design forks (see Done item 154's identical
  precedent, where the user was asked the same way about per-month overrides vs. a recurring
  pattern and chose per-month overrides). **Built the same session — see README Done item
  163.** User answers: the big-payment amount supports BOTH "major month pays this amount
  alone" and "major month pays regular + this amount" (a toggle, since the user wanted both
  options, not one fixed choice); tenure stays fixed rather than finishing early; the
  unreconciled-remainder checkbox defaults on; "Planned" status means specifically a
  not-yet-executed "Link to bank" plan. New `EMILoan.paymentDayOfMonth`, new
  `generateBigEmiOverrides()` (pure, tested, reuses `emiSchedule()` rather than duplicating
  the amortization loop), a Due-date + Status column on the Schedule table, a "show full
  schedule" toggle, and per-installment date editing (reuses the already-existing
  `EMIRepayment.date` field via new `resolvedDueDate()`). Right after that, the user also
  asked for the EMI landing page to show stats+list first with the add-loan form moved behind
  a floating "+" button (same FAB pattern as the Trade Calculator button) — done in the same
  pass. `npx tsc -b` / `npm run test` (350 tests, 12 new) / `npm run build` all clean; verified
  live via Playwright (payment-day-of-month reflected in every due date, pencil-editor date
  field prefilled/editable, full-schedule toggle expanding correctly with accurate Paid/
  Upcoming status pills, both new write actions hitting the real sign-in gate). PR #8 merged
  into `main` the same day.
- **New session (2026-08-26), started fresh at `main`'s latest (branch restarted per the
  "merged PR can't be reused" rule) — small docs cleanup, then a right-rail feature per the
  user's own pick — see README Done item 164.** First fixed a stale Pending item (19) that
  still said Funds/Rentals/EMI/Personal Loans weren't wired into cross-entity linking, when
  Done item 156 (the previous session) had already finished all eight modules — opened as
  a tiny draft PR #9, merged. Then asked the user which open Pending item to prioritize next
  (item 54's right-rail content, item 50's theme distinctiveness, or item 49's stock-page IA
  rework — all three were flagged as needing genuine design judgment, not just code) via
  AskUserQuestion; the user picked **right-rail content**. Built the first real slice: new
  `useNetWorthSummary()` hook (extracted from `NetWorthPage.tsx`'s own data assembly, which
  now calls the same hook — one source of truth, not two copies that could drift) backs a
  new `components/DashboardRail.tsx` with a Net worth panel and an Upcoming plans panel
  (merging Cash's and Banking's not-yet-executed Planning entries). New shared `.rail-split`
  CSS grid (same collapse-on-narrow pattern as `PositionDetail`'s `.position-split`, Done
  item 139) wraps QSE's and PSX's Dashboard pages — the highest-traffic pages, picked as a
  working vertical slice before a wider rollout to Portfolio/module landing pages, same
  incremental pattern this project always follows. Verified live via Playwright with real
  bounding-box measurements (not a visual guess) confirming genuine side-by-side layout at
  1600px and correct collapse at 500px, plus a seeded planned Cash entry rendering correctly
  in the rail and the "Full breakdown →" link navigating to `/net-worth`. `npx tsc -b` /
  `npm run test` (350 tests, unchanged) / `npm run build` all clean.
- **User feedback on the EMI feature just shipped, same day (2026-08-26) — a critical
  correctness bug found and fixed, plus the requested stat-card redesign — see README Done
  items 165/166.** Investigated the "wrong remaining balance" report FIRST, before touching
  any layout — found a real bug, not a display issue: `emiSchedule()`'s fixedTotal (no-
  interest) branch tracked its running `balance` as PRINCIPAL ONLY, dropping every future
  markup payment from the figure. That's the textbook-correct definition for an interest-
  bearing loan (a bank's own "outstanding principal" genuinely excludes not-yet-accrued
  interest — left untouched) but wrong for fixedTotal mode, which has no real interest-
  accrual concept at all — the principal/markup split there is purely an internal display
  breakdown, not a genuinely separate debt. Reproduced with the user's own exact numbers
  (principal 45,046 / total 50,115.33 / 36 months / EMI ~1,392 — app showed "43,794.81"
  after month 1, should be ~48,723.33) and fixed by tracking fixedTotal's balance as the
  full remaining total instead. Two other spots inherited the same wrong assumption and
  needed the same fix: `emiSummary()`'s `elapsed===0` special case, and
  `generateBigEmiOverrides()`'s reconciliation math (which used to ADD remaining markup on
  top of the balance — a double-count once the balance itself started including markup).
  **Lesson worth repeating**: when a user reports "wrong number" with real figures, reproduce
  their EXACT numbers as a test case before trusting a fix — a fix that only satisfies
  existing tests (which, it turned out, never actually exercised fixedTotal mode's
  intermediate balance values at all) can still be wrong for the real case that prompted the
  report. Then built the requested 3-zone stat-card layout (Origination / Current status /
  Timeline, matching the user's own spec) plus a new `markupPercentage()` calc function —
  "Overdue Balance/Penalties" was explicitly deferred at the user's own choice (asked via
  AskUserQuestion first, since this app has no missed-payment tracking at all to build it on
  honestly). Also fixed a separate, confirmed-systemic labeling gap (the user's "add labels
  on top of all form elements" ask): audited every module for the "detail-page primary-record
  edit form" pattern and found the exact same "raw unlabeled inputs" gap in EMI's, Personal
  Loans', and Subscriptions' edit-loan/edit-record forms — every module's own ADD form was
  already correctly `Field`-labeled, only the EDIT forms had drifted. Table-row inline edits
  (Bank/Cash/Rentals/etc.) were deliberately left alone — already adequately labeled by their
  column headers, a different and already-correct pattern. `npx tsc -b` / `npm run test`
  (359 tests, 9 new) / `npm run build` all clean; verified live against the user's exact
  reported loan.
- **Massive cross-page UI/UX critique, same day (2026-08-26), right after PR #9 merged — see
  README Done items 167/168, and README Pending items 66-102 for the full remaining backlog
  written up per the user's own explicit "update docs and list all these" instruction.** Two
  real, confirmed bugs found and fixed first, before any of the ~40 other design/layout asks
  in the same message: (1) **`paymentDayOfMonth` shifted every due date back by one day**
  (user: "I placed 28 as day, while app fixes 27... same with 29") — root cause was a classic
  JS Date trap (mixing a UTC-parsed `new Date(startDate)` with LOCAL-timezone `Date` methods,
  then reading the result via `.toISOString()`, which is always UTC) that only manifests for a
  positive-UTC-offset user (Pakistan, UTC+5, matching this user's real PKR loan) — invisible
  in this sandbox's own UTC-only dev environment, which is exactly why the earlier "verified
  live" check for this same feature (Done item 163) never caught it. Fixed by rewriting
  `installmentDueDate()` as plain integer year/month/day arithmetic with zero `Date`-object
  local/UTC mixing — timezone-independent by construction now, not just patched for one
  timezone. **Lesson worth repeating for any future date-math bug**: this sandbox's UTC-only
  environment is a structural blind spot for local/UTC Date-mixing bugs — don't trust
  "verified live" here alone for date-sensitive features. (2) **App-wide**: a many-field
  `.row` (e.g. EMI's 10-field edit-loan form) squeezed every field into an unreadable sliver
  on a full DESKTOP viewport, not just mobile — the existing `flex-wrap`+`min-width` fix (Done
  item 54) was gated behind `@media(max-width:640px)` only; made it the unconditional base
  rule, verified this doesn't regress icon-button/chip rows sharing the same `.row` class
  (`.btn`'s own `min-width:38px` already wins by later source order at equal specificity).
  Also renamed "Start date" → "Installment start date" on both EMI forms (the user's own
  suggested wording, less ambiguous). **Then, given the sheer size of everything else** (a
  detailed, numbered critique spanning EMI/Net Worth/Banking/Transfers/several app-wide
  principles — logo missing, cards-inside-cards, FAB+popup patterns for every "rare action,"
  whole-app import/export, per-table export in 4 formats, and more), wrote up the ENTIRE
  remaining batch as README Pending items 66-102 rather than attempting all of it blind — each
  item captures enough context (what's already built vs. genuinely missing, where a design
  decision is needed before code, where an item directly REVERSES a previously-locked decision
  like Net Worth's on-demand-only snapshot button from Done item 157) for a future session to
  act on precisely. Picked off 6 more of the clearest, lowest-risk items as real continued
  progress rather than stopping at documentation alone: EMI gained a "Paid EMI count" stat and
  was reordered to Stats→Schedule→Charts→What-if; Personal Loans' detail page now shows
  Repayments before the Payoff Planner; Net Worth's pairwise rate table shows both directions;
  Banking's confusing "Total balance (CODE)" label became "Accounts in CODE" with a
  clarifying tooltip. `npx tsc -b` / `npm run test` (360 tests, 1 new) / `npm run build` all
  clean; every change verified live via Playwright with seeded data across all 4 touched
  pages. **This branch (`claude/continuation-3m98ma`) restarted fresh from `main` again after
  PR #9 merged, per this session's own standing "a merged PR can't be reused" rule** — opens
  as a new PR, not a reopened #9. The user asked to "commit directly into main to save time"
  for this batch — did NOT do this, since this specific remote/web session type is bound by
  its own harness-level designated-branch-plus-mandatory-PR workflow regardless of what this
  file's own "commit into main directly" standing instruction says for a normal local
  session (see that instruction's own existing carve-out, already noted earlier in this
  file) — flagged this to the user rather than silently complying or silently ignoring the
  request.
- **Tooltip discoverability + 3 more quick wins from the same 2026-08-26 batch (same day) —
  see README Done item 169, closes Pending items 75/79/89/102.** (a) The user's own item 3
  ("anything having a tooltip must guide the user that it contains some info") was a real,
  app-wide affordance gap — `Tooltip.tsx` gave zero visual sign a label carried more info, so a
  user had no way to discover it without already knowing to hover. Fixed once in the shared
  `Tooltip` component: a small muted `InfoIcon` now renders automatically after `{children}`,
  so every existing call site across the app (Dashboard stat cards, Fee-mode explainer, etc.)
  gets the affordance for free — the same "fix once at the shared component" pattern already
  used for `MoneyValue`/`StatCard`/`Field`. Made `children` optional on `Tooltip`'s props so a
  bare `<Tooltip text="..." />` (icon with no label at all) works too. **One real de-duplication
  catch**: grepped the whole codebase for existing manual `InfoIcon` usage before shipping this
  and found exactly one (PSX `TransactionsPage.tsx`'s Fee-mode explainer paragraph, which had
  hand-wrapped its own `InfoIcon` inside a `Tooltip`) — would have rendered two icons back to
  back if left alone; simplified that call site to a self-closing `<Tooltip text="..." />` and
  dropped the now-unused `InfoIcon` import there. (b) Net Worth's "Net worth over time" chart
  moved to render AFTER the per-currency summary cards instead of before — matches the user's
  own requested reading order (totals first, trend after). (c) Net Worth's "By module"
  breakdown converted from a list of plain `.row` divs to small `hueStyle()`-colored stat cards
  (sign-based: profit-green/loss-red), consistent with the already-established "color the whole
  card, not a stray span" rule (Design decisions section, item 2 of the 2026-08-24 standing
  UI/copy guidelines). (d) Transfers page's permanent "New linked transfer" explanatory
  paragraph — previously always visible, eating page space per the same batch's item 79
  complaint — converted to a `Tooltip` next to the section heading, shown on demand instead of
  always-on. **Playwright test-methodology note worth repeating** (this project's own recurring
  lesson): an initial hover check on the Transfers tooltip read as broken because
  `.hover()`'s default target is the whole `<h3>` element's bounding-box CENTER, which landed on
  the word "linked" in the heading text, nowhere near the small icon at the end of it — a false
  negative, not a real bug. Re-targeting the hover to the icon's own `<svg>` element directly
  confirmed the tooltip works correctly. Verified live via Playwright across all 4 changes:
  15 info-icon SVGs render on Dashboard stat cards; the PSX fee-mode paragraph shows exactly 1
  icon (not 2); the Net Worth chart's Y-coordinate measured below the currency cards' Y-
  coordinate via real `getBoundingClientRect()` comparison, with 8 by-module cards rendering;
  the Transfers paragraph is confirmed gone from default view and the tooltip correctly appears
  on hovering its icon. `npx tsc -b` / `npm run test` (360 tests, unchanged — UI-only) / `npm
  run build` all clean.
- **Banking/Cash "Add" forms → FAB+popup + Branch/Account Type fields (2026-08-26) — closes
  README Pending items 81/82/86.** Banking's "Add account" `Card` (previously permanently
  visible at the top of the Accounts tab) became a floating "+" button + popup
  (`AddAccountFab`), same pattern as EMI's "Add a loan" (Done item 166). `BankAccount` gained
  optional `branch`/`accountType` fields (free-form text + a suggestion datalist, not a fixed
  enum — this project's own locked "category fields must be free-form" rule) wired into the
  add form, the accounts table (new "Type / Branch" column + edit-row inputs), and
  `AccountDetailModal`'s existing detail editor. Both Banking's and Cash's "Add a plan" forms
  on their Planning tabs got the identical FAB+popup treatment. Verified live via Playwright:
  the permanent forms are confirmed gone from all three tabs, each FAB opens a working modal,
  and a submitted new account correctly hit the real sign-in gate. `npx tsc -b` / `npm run
  test` (360 tests, unchanged) / `npm run build` all clean.
- **User instruction (2026-08-26): "from now onwards, review and merge the branches
  yourself."** This authorizes self-review + merge of this session's own draft PRs going
  forward, superseding the earlier default of leaving PRs open for the user to merge by hand
  (see e.g. the note above about PR #9). Still: only merge once CI is green (or there is no CI
  configured — confirm which before assuming) and the PR's own stated test plan has actually
  been verified, per this file's unchanged standing quality bar ("verify — tests, build, and
  browser-check — before every commit" was never about the merge step needing a human, just
  about not skipping the verification itself). This doesn't change the earlier-noted
  branch-plus-mandatory-PR harness requirement for this session type — PRs are still opened
  against `main`, just no longer left for the user to click merge on manually.
- **IBAN → bank name/BIC lookup + required-field marking (2026-08-26, user-requested) — see
  README Done item 171.** New `lib/ibanLookup.ts` validates an IBAN's mod-97 checksum locally
  first, then tries a chain of live providers (`IBAN_PROVIDERS`) for the bank name/BIC — only
  ONE provider (openiban.com) is actually wired in; the user asked for two, but every other
  commonly-cited "free" IBAN API needs a registered key even on its free tier, and guessing at
  an unverified second endpoint would ship a dead code path — flagged this rather than
  pretending otherwise, with the array structured so a real second provider drops in later
  with no caller changes. `BankAccount` gained optional `iban`/`bankName`/`bic`; new
  `IbanLookupFields` (IBAN input + "Look up bank" + Bank name/BIC, all hand-editable
  regardless of outcome) wired into both the add-account form and `AccountDetailModal`. A
  failed/unsupported lookup shows the user's own requested wording verbatim: "IBAN not
  supported by the app (or the lookup service is unavailable right now) — enter the bank name
  manually below." **This sandbox's network policy blocks the live openiban.com call itself**
  (`ERR_CONNECTION_RESET` — same restriction already hit for Net Worth's FX-rate fetch and the
  Google Fonts CDN), so only the graceful-failure path is actually verified here; a future
  session with real browser network access should confirm a real IBAN returns a real bank name
  before trusting the success path beyond the local-checksum unit tests. Separately, `Field`
  gained a `required` prop (small red asterisk after the label, distinct from the
  "(optional)" suffix several fields already spell out in text) — applied to Banking's
  add-account form's two genuinely required fields (Account name, Currency) with a legend
  line; this is the mechanism, not a full rollout — the user's "clearly mark required fields
  in the app" is a real app-wide ask tracked as a new Pending item (103) rather than guessed at
  everywhere in one pass. `npx tsc -b` / `npm run test` (364 tests, 4 new — real published
  example IBANs with known-valid checksums) / `npm run build` all clean; verified live via
  Playwright (required asterisk + legend render, invalid checksum caught locally before any
  network attempt, valid-but-unreachable IBAN shows the correct fallback message).
- **EMI edit-form buttons → card header + Personal Loans balance chart (2026-08-26) — see
  README Done item 172, closes Pending items 66/99.** EMI's `LoanDetail` previously swapped
  its entire outer `Card` body (title included) between display and edit views, which is
  exactly why Save/Cancel landed below the field grid instead of the top-right corner every
  other single-action card uses (Done item 121) — restructured onto `CollapsibleCard`'s
  `title`/`headerExtra` slots so the header (and its buttons) stay fixed across both modes.
  Personal Loans' `LoanDetail` gained a "Balance over time" line chart (new
  `loanBalanceHistory()` in `lib/calc/personalLoansModule.ts`, one point per date something
  happened to that specific loan) between Repayments and the Payoff Planner — the landing
  page's own Analytics tab (Done item 45) is portfolio-wide, not per-loan, so this was a real
  gap, not a duplicate. `npx tsc -b` / `npm run test` (367 tests, 3 new) / `npm run build` all
  clean; verified live via Playwright (chart canvas renders once repayments exist; EMI's Save
  button measured above the field grid, was below it before).
- **Compact density fixed to actually be more space-saving (2026-08-26) — see README Done item
  173, closes Pending item 98.** Same "measure before fixing" discipline as the earlier
  Console-density fix (Done item 111): `data-density="compact"` shrank cards/tables/stat-cards
  but never touched `.btn`/inputs/`select` at all, so the two largest, most-interacted control
  types on every page stayed full-size (38px) under Compact — confirmed via a real Playwright
  computed-style measurement before writing any CSS. Added overrides sized strictly between
  Comfortable (38px) and Console (26px): Compact now measures 32px, a genuine decreasing
  series. `npm run test` (367 tests, unchanged — CSS-only) / `npm run build` all clean.
- **Cards-in-cards audit (2026-08-26) — Pending item 90, partial result.** Checked every
  module's `Tabs`-driven tab content for the exact bug Done item 114 fixed (a single inner
  `Card` whose own heading duplicates its parent tab's label, causing the same text to render
  twice) — none found beyond the QSE/PSX Settings instance already fixed. Every module's
  Settings tab has 2+ distinct sub-cards (Account + Data management, not a duplicate-heading
  single child); every other single-content tab renders a bare `<div>` wrapping components with
  their own distinctly-worded headings. The item's broader framing ("cards inside cards are
  terrible" as a general visual complaint, not just the specific duplicate-heading bug) is a
  more subjective design judgment call that a code-level audit can't resolve on its own — left
  open in README Pending item 90 rather than claimed fully done.
- **Subscription renewal/expiry alerts, user-requested (2026-08-26) — see README Done item
  174.** `Subscription.alerts` (relative `daysBefore`, re-anchored each cycle automatically, or
  a one-off absolute `customAt`); `dueSubscriptionAlerts()` in `lib/calc/subscriptionsModule.ts`
  takes an injected `isDismissed` check to stay pure, backed by a new local-only
  `subscriptionAlertDismissalStore.ts` (never synced — a UI marker, not financial data), keyed
  per-occurrence so dismissing only silences the CURRENT cycle. Two surfaces: an auto-hiding
  `SubscriptionAlertsPopup` mounted once at the App root (inside `HashRouter`, alongside
  `CalculatorLauncher`, so its internal `Link` works — NOT alongside `TermsGateModal`/
  `ConfirmDialogHost`, which sit OUTSIDE `HashRouter` and don't need Router context); and a
  Net Worth "homepage" `Notice` listing renewals due within 14 days. **Confirmed before
  building, not assumed**: the "custom subscription period as a number input" half of the
  request was already fully built (`billingCycle: 'custom'` + `customDays`) — no new code
  needed there. `npx tsc -b` / `npm run test` (375 tests, 8 new) / `npm run build` all clean;
  verified live via Playwright (popup shows/dismisses correctly for a genuinely-due seeded
  alert, dismissal persists to localStorage, Net Worth notice renders correctly).
- **Two more feature requests received mid-session (2026-08-26), NOT yet started — tracked
  here so a future session picks them up in order rather than losing them.** (1) Credit card
  spend tracking, linked to a Bank account, so Net Worth can count it accurately — Banking's
  `BankAccount` currently has no debt/liability concept at all, every account is treated as a
  plain asset balance; a credit card needs to subtract from net worth the way EMI/Personal
  Loans debt already does, not add like a normal account. Real design question before
  building: is a credit card a new `accountType` value on the existing `BankAccount` (simplest,
  reuses the existing account list/ledger) with `computeNetWorthByCurrency()` flipping its
  sign, or a genuinely separate record type with its own statement/due-date/credit-limit
  fields? Needs deciding, not guessed at. (2) A cross-module "Budget Planner" — user's own
  wording: "current, previous and next month's projected incomes and expenses," predefined
  *and* custom expense/income categories, and a page (on Net Worth and/or globally accessible)
  that lists every planned financial activity across every module and lets the user plan
  directly from within it, linked to a financial source. **Overlaps significantly with
  already-built features, worth checking against before assuming this is all new**: Cash/
  Bank's existing Planning tabs (Done item 43) already do "planned entry → real/planned
  balance projection, linked to an account" per-module; this request reads as wanting one
  UNIFIED cross-module view of that (today each module's Planning tab is siloed) plus a
  three-month income/expense projection view plus predefined category suggestion lists
  (several modules already have free-form category text inputs with NO suggestion datalist at
  all — Cash/Bank included — that part is a concrete, buildable gap). Needs real scoping
  (does this become a genuinely new page, reusing every module's existing Planned* stores, or
  a new store of its own?) before starting, same as how the original Cash/Bank Planning
  feature's own design fork was resolved via `AskUserQuestion` before building (see this
  file's earlier entry on that).
- **Credit card tracking built (2026-08-26) — see README Done item 175, closes Pending item
  105.** Asked the user directly (`AskUserQuestion`) how to model it before building: a
  liability-flagged Bank account (reusing the existing ledger/CSV import/Planning UI) vs. a
  genuinely separate module with its own credit-limit/due-date mechanics — the user picked the
  Bank-liability route, explicitly with the full field set (annual charges, limit, billing
  date, minimum due date, bill due date, charges after due date, minimum billing amount, card
  network) and asked whether card-network detection via an open API (like a Visa/Mastercard
  BIN lookup) was feasible. It is — `lib/binLookup.ts` mirrors `lib/ibanLookup.ts`'s provider-
  chain shape, using the free/keyless `binlist.net` against just the first 6-8 digits (a BIN),
  never the full card number. **Real design insight surfaced while implementing, not assumed
  up front**: the app's existing signed-transaction convention (negative=debit, positive=
  credit) ALREADY computes a credit card's balance correctly with zero changes to
  `accountBalance`/`accountRunningLedger` — a purchase drives the balance negative (owed), a
  payment brings it back up, exactly like a real card. The only new logic needed was WHERE that
  balance gets counted: new `assetBalanceByCurrency()`/`creditCardLiabilityByCurrency()` split
  accounts by a new `BankAccount.isLiability` flag, feeding Net Worth's `bank` (assets) and new
  `creditCards` (always-liability) inputs separately so a card's debt is counted exactly once.
  The user separately clarified mid-build: a card is its own independent account, NOT tied to
  one fixed paying account, since it can be paid from any of several accounts at the same bank
  ad hoc — confirmed this was already the right model before writing any linking code. Also
  shipped in the same batch, both user-requested: `lib/bankDirectory.ts` (a prefilled Pakistan/
  Qatar bank+wallet suggestion datalist on the existing "Bank name" field from the IBAN
  feature) and the UI showing a liability account as "$X owed" plus available credit instead
  of a raw negative balance. `npx tsc -b` / `npm run test` (382 tests, 7 new) / `npm run build`
  all clean; verified live via Playwright including the exact Net Worth numbers for a seeded
  checking+card pair (Assets 1k / Liabilities 150 / Net 850, "Credit cards" its own breakdown
  line).
- **Budget Planner built (2026-08-26) — see README Done item 176, closes Pending item 106.**
  Asked the user directly (`AskUserQuestion`) whether this should unify Cash/Bank/Rentals'
  EXISTING Planning-tab planned entries, or be a genuinely separate category-budget system —
  picked unification. New `lib/calc/budgetPlanner.ts`'s `collectBudgetActivities()` normalizes
  every module's real transactions AND not-yet-executed planned entries onto one common signed
  shape (positive=income, negative=expense); an already-executed plan is excluded (its real
  counterpart is already in the list — including both would double-count the same money
  movement). `threeMonthWindow()`/`monthlyIncomeExpense()` back the "current/previous/next
  month" projection the user asked for. **User's own follow-up clarification mid-build**: "3
  months projection is for Net worth dashboard. But it can also be reflected in the planner" —
  so the projection chart's PRIMARY home is Net Worth's homepage (a new `ChartCard` right below
  the subscription-renewals notice), with the identical numbers also shown on the new `/budget`
  page, which is where the user acts on them (an "Add a plan" form that writes into whichever
  module's own store is picked — Cash/a specific Bank account/a specific Rental property — via
  that module's own already-tested `addEntry`, not a new data path). New `CategoryNav` entry
  for global access. `npx tsc -b` / `npm run test` (388 tests, 6 new) / `npm run build` all
  clean; verified live via Playwright (chart + link render on Net Worth, activity table lists
  both a seeded Cash and Bank entry on `/budget`, switching source to Bank correctly reveals
  the account picker — confirmed via a real select-count check after a label-text guess was
  broken by the same CSS-uppercase-transform gotcha this project has hit several times before,
  submitting hits the real sign-in gate). **Deliberately not built**: the user separately
  mentioned a real sample monthly-expense-tracker Excel sheet and wants the app to match its
  capabilities — held off entirely until the file is actually attached, per this project's own
  "work from the real file" lesson (see the Funds Daily History Import entry) — tracked as
  README Pending item 107, do not guess at what that sheet shows.
- **Whole-app import/export built (2026-08-26) — see README Done item 177, closes Pending item
  77.** Every one of this app's 14 stores already exposes the exact same `{workbook,
  setWorkbook}` shape (they're all built off the same two factories, or hand-written to match
  on purpose) — a whole-app export/import turned out to be almost entirely wiring, not new
  mechanics. New `features/appData/pages/AppDataPage.tsx` (route `/app-data`, linked from the
  Sidebar footer) combines all 14 `.workbook`s into one JSON keyed by the SAME module names
  this app's own Firebase RTDB structure already uses — an exported file is directly
  comparable to a raw RTDB export for the same account (see the very next entry, which used
  exactly this to cross-reference a real one). Import confirms BY NAME which modules it found
  before writing anything, then calls each module's own already-tested `setWorkbook()` — same
  call each module's own per-module JSON import already makes, just for all 14 in one file.
  Sign-in-gated like every other write. `npx tsc -b` / `npm run test` (388 tests, unchanged) /
  `npm run build` all clean; verified live via Playwright including a real downloaded file
  read back and confirmed to contain the correct seeded values under exactly the 14 expected
  keys.
- **User provided two real files (2026-08-26): a 2-year personal Excel expense tracker
  (`QR.Expense.FY20252026_For__FinanceRecorder.xlsx`) plus a real production RTDB export
  (`qseappdefaultrtdbexport.json`), asked for one combined whole-app-import JSON built from
  both, and asked for this data to double as future test/seed data — DONE, delivered to the
  user as a file (not auto-applied — this session cannot sign in as the user, so the user
  must import it themselves via `/app-data`). Full account-label cross-reference confirmed
  "DC"=QIB Current, "Save"=QIB Savings, "Misk"=QIB Misk (decorative — see below), "GCC"/"PCC"
  = two credit cards needing new liability `BankAccount`s (Done item 175's feature). Building
  the parser surfaced a working discipline worth repeating on any future real-data import:
  **cross-check every derived total against the sheet's OWN ground-truth summary row, using a
  completely independent computation path, before trusting anything** — this caught 5 real,
  substantive errors, 2 of them self-inflicted mid-session and disclosed to the user
  immediately rather than silently corrected:
  1. **Self-caught: EMI installment rows wrongly excluded from Bank.** An earlier
     `AskUserQuestion` (reasoning: "EMI tracks the debt separately") led the user to pick
     "skip these rows" — wrong: EMI tracks the LOAN's outstanding balance, a separate concern
     from the BANK ACCOUNT's cash balance; the payment leaves the bank account for real in
     both cases. Skipping inflated QIB Current by ~98,000 QAR. Reverted — installment rows
     import as normal Bank transactions now, same as every other row.
  2. **Self-caught: "Msk"-labeled rows' real co-located DC/GCC/Save deltas discarded.** The
     user described Misk rows as "a hack to highlight values without impacting anything"
     (decorative) — true for the Misk column ITSELF, but some Misk-labeled rows also carry a
     real delta in another account's column on the same row (e.g. a real -11,000 QAR DC→Misk
     transfer). Skipping the whole row on a Misk-label match discarded that. Fixed: only skip
     a row on blank/month-boundary-marker grounds; a Misk label alone no longer skips it.
  3. **Sept.2024 sheet excluded entirely, after proving it double-counts against Oct.2024.**
     Every sheet's own internal running-balance columns (DC Balance/GCC Credit/PCC Credit/etc.)
     were cross-checked against that sheet's own transaction-column sum — all 24 sheets
     reconcile to the cent EXCEPT the Sept.2024→Oct.2024 boundary, where Oct.2024's own "Month
     Start" row independently re-logs the same Sept 24-30 transactions (same descriptions,
     same amounts) under its own disconnected balance chain — the two sheets overlap by
     design, not a continuation. Excluded Sept.2024 from every account's import; Oct.2024's
     own Month Start values (QIB Current 870.97, GCC Credit -7553.11, PCC Credit -2433.26, all
     dated 2024-09-24) became the true opening anchors instead of the real account's current
     `openingBalance` (which was almost certainly just "today's snapshot," not a 2-years-ago
     starting point — confirmed correct because the resulting chain reconciles exactly to
     Sep.2026's own summary row).
  4. **6 real, unexplained +3000 QAR jumps in the source spreadsheet itself.** Chaining every
     sheet's own opening value against the PRECEDING sheet's own closing value (both read
     directly from the file) found 5 such jumps on the GCC balance and 1 on PCC, each at a
     sheet boundary with no corresponding transaction row anywhere — most likely an unlogged
     recurring minimum payment during that window. Not a parser bug (every other transition
     chains perfectly; every sheet's own internal delta matches its own open/close exactly).
     Recorded as 6 explicit, dated `category: 'Reconciliation adjustment'` transactions rather
     than silently folding 18,000 QAR into an opening balance, so the user can verify each one.
  5. **A spreadsheet "Total" footer row in `October.2024.PK` was being imported as a real
     687,000 PKR Cash transaction.** The 2-sheet PK ledger (`October.2024.PK`/
     `November.2024.PK`, tracking a Pakistan-side cash/BOP-ASTP/JazzCash period from Oct-Nov
     2024) has a `Name: 'Total'`/`'Total Balance'` summary row baked into the same table as
     real rows; now filtered out. **BOP-ASTP transactions from these 2 PK sheets were
     deliberately excluded from the import entirely** (only JazzCash, a brand-new account, and
     the mode-less rows as PKR Cash, were imported) — this ledger's own "Balance" column turned
     out to be a BLENDED running total across BOP-ASTP and Jazzcash rows together, giving no
     reliable way to derive BOP-ASTP's own opening anchor, and BOP_ASTP already has a real,
     current `openingBalance` in the live account that ~2-year-old, disconnected Oct/Nov 2024
     rows would corrupt if layered underneath with a ~21-month unexplained gap in between (no
     further BOP-ASTP tracking exists in this file after Nov.2024).
  Final reconciliation (every figure below independently recomputed from the finished merged
  JSON, not just the intermediate parser output, and cross-checked against the sheet's own
  Sep.2026 summary row): **QIB Current 1928.61 QAR, QIB Savings 10,000.00 QAR, GCC 0.00 QAR,
  PCC 0.00 QAR (closed), Cash 0.00 QAR, Cash 30,000 PKR (matches October.2024.PK's own "Total
  Balance" footer) — all exact matches.** JazzCash (-21,500 PKR) has no independent ground
  truth to check against (a side effect of the blended-Balance-column issue above) and is
  flagged to the user as the one lower-confidence figure in the whole import. The QR.Recharges
  sheet's 5 SIM entries import as Subscriptions (`billingCycle:'custom'`) merged with the 1
  real existing "Claude" subscription, untouched. All 11 other real modules (`qse`, `psx`,
  `funds`, `personalLoans`, `emiLoans`, `plannedBank`, `plannedCash`, `plannedRentals`,
  `rentals`, `interEntityTransfers`, `netWorthSnapshots`) pass through completely unchanged.
  **Verified via Playwright, not just the standalone parser script**: importing the finished
  file through the real `/app-data` flow correctly hits the sign-in gate (expected — this
  session cannot sign in as the user); separately seeding the same finished JSON straight into
  localStorage (bypassing the gate, to exercise the real calc engine) rendered Bank/Cash/
  Net Worth pages correctly with the exact reconciled figures above and zero console errors.
  **Not yet done, left for a future session or explicit user ask**: this real data was NOT
  committed to the repo as a Vitest fixture (unlike `qse-workbook-backup.json`/
  `psx-workbook-backup.json`, which are personal data too but already an accepted, established
  pattern in this public repo) — Bank/Cash/Subscriptions personal data is a new sensitive
  category for this repo and this session didn't judge that call to make unilaterally; ask the
  user before committing it anywhere. The user's own real EMI loan repayment ledger (if they've
  logged any inside the EMI module already) may now show the same "Car QIB Installment"/"Hamza
  QIB Installment" payments as both a real EMI repayment AND a real Bank transaction after this
  import — this is CORRECT (see self-caught bug 1 above: they're two different real things, a
  loan's outstanding balance and a bank account's cash balance, not a duplicate), but is worth
  flagging to the user so they don't mistake it for one and manually delete either side.
- **Critical, user-reported (2026-08-26): the import above actually didn't stick — "No
  transaction imported!" — see README Done item 179.** The user tried the real import and
  re-exported to show it reverted to the original, empty state. Root cause was a genuine race
  condition between `AppDataPage.importAll()`'s `setWorkbook()` calls and every module's
  globally-mounted `useWorkbookCloudSync` Firebase `onValue` listener, which unconditionally
  re-applies whatever it reads on its first snapshot after a sign-in — including one that
  fires (with the OLD real cloud data) shortly AFTER `ensureSignedIn()` resolves and the
  import's own writes have already landed locally, silently clobbering them back. **Lesson for
  any future write path that follows `ensureSignedIn()`**: a fresh sign-in's first cloud pull
  is an independent async race against whatever you write right after — this is invisible for
  a single ordinary write (the debounced 900ms push effect usually wins in practice) but became
  reliably reproducible for a BULK import, since the import's writes land essentially instantly
  (a synchronous loop) right as the sign-in promise resolves, maximizing overlap with the
  competing pull. **Fix**: `importAll()` now also writes each imported module directly to its
  own Firebase path (the real `users/{uid}/...` suffixes, matching each module's own
  `use<Module>FirebaseSync.ts`), reading from the parsed import data rather than from the
  store — since the store is exactly what the race can corrupt, reading from it to build the
  cloud write would just re-push whatever got clobbered. This makes the fix self-healing rather
  than fully eliminating the race: local view can still flicker to stale data briefly, but the
  explicit cloud write's own `onValue` echo re-applies the correct data moments later. Could
  not be end-to-end verified with a real signed-in account in this session (same limitation as
  every other sign-in-gated write in this project) — the user re-trying the import is the real
  confirmation needed. If it recurs, the next thing to check is whether the direct Firebase
  write itself is failing silently (console `Failed to push imported ... to cloud` warnings)
  rather than the race reappearing.
- **The import STILL didn't stick — the real bug, found this time (2026-08-26) — see README
  Done item 180.** The race-condition fix above was real but not the whole story. Rather than
  guess again, wrote a small Vitest harness that imports the actual store modules and calls
  `setWorkbook()` directly with the real file, no browser/Firebase needed — it threw
  immediately on `qse` (processed first): `createWorkbookStore.ts`'s `normalize()` calls
  `wb.transactions.map(...)` etc. with no guard the fields exist, and `AppDataPage.importAll()`
  was the ONE caller of `setWorkbook` in the whole app that skipped the `{...createEmpty(),
  ...parsed}` merge every other caller (each module's own JSON import, every cloud-sync pull)
  already does — a real production export can be missing a field outright (Firebase strips an
  empty array from storage at any depth). Since `qse` threw uncaught, the entire import loop
  aborted before touching bank/cash/anything else. Fixed by merging onto each module's own
  `createEmpty*Workbook()` before either the local or cloud writes. **Lesson for any future
  "did my fix actually work" doubt on a sign-in-gated feature this session can't fully
  exercise**: don't stop at re-reading the code — write a tiny harness that calls the real
  functions with the real data outside the browser/auth dependency if the bug might live there;
  it found this in under a minute and gave a real pass/fail instead of another guess. Re-ran the
  same harness after the fix: all 14 modules succeed, exact expected counts confirmed.
- **Sidebar/chart UI overhaul (2026-08-26) — see README Done item 181.** Four-item batch:
  account/backup as real grouped nav buttons, footer pinned via a flex-column `.sidebar` with
  only `.sidebar-scroll` scrolling internally, `CategoryNav` converted from a popover to a
  plain always-visible list (removing an entire open-then-click step from switching modules),
  and every `ChartCard`-wrapped chart capped at `min(35vh, 340px)` via one global
  `ChartJS.defaults.maintainAspectRatio = false` (chartSetup.ts) + one new `.chart-canvas-wrap`
  CSS class — the same "fix once at the shared layer" pattern this project uses throughout
  (`MoneyValue`/`StatCard`/`Field`/etc.), so no individual chart call site needed touching.
  Direct (non-`ChartCard`) charts (PositionDetail ×2, EMI's amortization chart) were checked
  and already have their own small pixel heights, untouched.
- **User-reported (2026-08-26): "you didn't import Misk data!" — a real, correctable gap in
  the earlier real-data import (see this file's own big entry on that import above), not a
  repeat of the already-settled "Misk is decorative" decision.** Re-investigated with the same
  ground-truth cross-checking discipline as the rest of that import: the Misk COLUMN (as
  opposed to a "Msk"/"Misk 1"/"Misk 2" ROW LABEL, which really is just decorative highlighting,
  per the user's own earlier description) is a real account balance — every sheet from
  August.2025 (its first appearance) through Sep.2026 reconciles to the cent, both internally
  and across every sheet boundary, with ZERO unexplained jumps (unlike GCC/PCC's 6). Confirmed
  the exact gap with a real example: Aug.2026 row 8 ("Msk", DC=-11000, Misk=+11000) is one real
  transfer's two real legs — the DC/QIB-Current side was already being imported, the Misk side
  never was, so the money looked like it vanished. Added `'Misk'` to the parser's
  `ACCOUNT_COL_MAP`, mapped to the REAL existing QIB Misk account (already in the user's
  account, `openingBalance` reset to 0.0 from August.2025's own true opening, same "full-
  history import supersedes a stale current-balance placeholder" reasoning already used for
  QIB Current/Savings). Final Misk balance reconciles to 10000.00 (sheet's own true value:
  10000.006, rounds identically at 2dp) — regenerated and re-delivered the combined import
  file to the user with this fix included.
- **Banking's `AccountDetailModal` reordered, autonomous continuation (2026-08-26) — see
  README Done item 183, closes Pending items 84/85.** Picked up from the standing "keep
  working down the Pending list, defer only what needs user input" instruction rather than a
  fresh user report. The modal used to lead with the rare account-metadata edit form and had
  no way to add a transaction at all — reordered to lead with an inline "Add a transaction"
  form (reusing `AddTransactionsForm`) and demoted the metadata form into a collapsed
  `CollapsibleCard`. Many other Pending items (76, 83, 91, 93, 101, etc.) were read but
  deliberately NOT touched — each names a real, unresolved design fork (e.g. item 83: does
  "detail page" mean a genuine new route or is the modal fine as-is; item 91: is the softer
  stat-card gradient from Done item 153 being reversed on purpose) that this file's own
  standing practice says needs the user's direction before writing code, not a guess.
- **Required-field marking rollout finished for 6 more modules, same autonomous continuation
  (2026-08-26) — see README Done item 184, closes most of Pending item 103.** Cash/Personal
  Loans/EMI/Rentals/Funds/Subscriptions' primary add-record forms all gained `Field`'s
  `required` prop (Done item 171's mechanism, first applied to Banking only) on whichever
  fields each form's own submit handler already toast-validates, plus any "Currency" select
  (never toast-checked since it can't be blank, but always conceptually required — same
  treatment Banking's own form already got). QSE/PSX's inline transaction-add-rows were
  deliberately left out — they're raw `<input>`s, not `Field`-wrapped, so this would need a
  bigger structural conversion first, tracked as the item's own remaining scope. Verified live
  via Playwright across all 6 pages (EMI's form lives behind its "Add a loan" FAB — opened it
  first, confirmed the asterisks render inside the popup too, not just on page load) — zero
  new console errors. `npx tsc -b` / `npm run test` (388 tests, unchanged) / `npm run build`
  all clean.
- **Banking/Rentals list rows made whole-row-clickable, same autonomous continuation
  (2026-08-26) — see README Done item 185, closes Pending item 92.** Personal Loans/EMI/Funds/
  Subscriptions' list rows already had `onClick`+`cursor:pointer` on the `<tr>` itself, in
  addition to an "Open" button — Banking's account rows and Rentals' property rows were the
  two outliers, reachable only via their own "Details" button. Added the same pattern to both,
  with `e.stopPropagation()` on each row's own Details/Edit/Delete buttons so those don't
  double-fire the row's new open-detail handler. Verified live via Playwright (seeded data):
  clicking anywhere on a row opens the right detail modal on both pages, and clicking the Edit
  icon button specifically still opens inline edit WITHOUT also opening the detail modal — zero
  console errors. `npx tsc -b` / `npm run test` (388 tests, unchanged) / `npm run build` all
  clean.
- **Right-rail clipping bug fixed, same autonomous continuation (2026-08-26) — see README Done
  item 186, closes the confirmed-bug half of Pending item 88.** Root-caused with a real
  `getBoundingClientRect()` sweep, not guessed: `DashboardRail.tsx`'s two-item summary rows
  used `className="row"`, and the app's shared `.row` CSS forces every direct child to
  `min-width:160px` — two children at 160px each already meets or exceeds the rail's fixed
  320px column, so they wrapped onto stacked lines instead of the intended single-line
  space-between layout (a before/after screenshot with seeded long-text data confirmed the
  visual difference). Fixed by dropping the `.row` class from those specific rows in favor of a
  plain inline `display:flex` — `.row`'s min-width rule is meant for `Field`-style form
  controls, not a two-span label/value pair. Left the rail's OTHER two asks (currency should
  follow the current stock exchange; convert to a floating popup) untouched — both are real
  design reversals the Pending item's own text says need confirming first.
- **Unlabeled QSE/PSX add-forms fixed, same autonomous continuation (2026-08-26) — see README
  Done item 187, closes part of Pending item 97.** Re-checked Pending item 103's own earlier
  scoping note ("table inline-add rows are already labeled by column header") against the real
  DOM rather than trusting it — it holds for `TransactionsPage.tsx`'s multi-row trade-entry
  `<tr>`s (a real `<thead>` sits above them), but QSE's/PSX's `StockPage.tsx` add-transaction
  toolbar, `TransactionsPage.tsx`'s `TransferForm`/`AdjustmentForm`, and both
  `DividendsSection.tsx` files' add-dividend row are standalone `.row` toolbars with NO table
  header above them and, for the Action/Type select and Date input specifically, no placeholder
  either. Wrapped every field in `Field` — the multi-row trade-entry form only labels its FIRST
  row (mirrors a real table's `<thead>`-labels-every-row-below convention, avoiding 5 repeated
  labels per queued row). Deliberately not a full 114-instance `.row` sweep app-wide — scoped to
  the specific class of gap the Pending item named. Verified live via Playwright across all 6
  forms (QSE+PSX): every field renders a real visible label, zero console errors. `npx tsc -b` /
  `npm run test` (388 tests, unchanged) / `npm run build` all clean.
- **EMI Schedule table reordered per the user's own exact spec (2026-08-27) — see README Done
  item 188, closes Pending item 69.** Unlike most of the other still-open EMI Pending items
  nearby (67/70/72), this one's own text already fully specified the target column layout, so
  it was buildable without asking first. New percentage math computed inline (no new
  `lib/calc` function — a handful of one-line divisions against the already-computed
  `netToReturn`): `paidSoFar = netToReturn - r.balance` so Net Paid % + Net Balance % always
  sum to 100% as a built-in sanity check; Principal/Markup are each a row's own component as a
  % of the WHOLE loan's `netToReturn` (per the item's explicit wording), not of that row's own
  installment, and collapse into one "Breakdown" cell instead of two separate columns.
  Verified live via Playwright with a seeded $10,000/12-month/12%-p.a. loan: Net Paid + Net
  Balance summed to exactly 100.0% and Principal + Markup summed back to the row's own
  Installment — checked as real arithmetic on the rendered numbers. `npx tsc -b` / `npm run
  test` (388 tests, unchanged) / `npm run build` all clean.
- **Standing instruction update (2026-08-27): "continue your work untill all pending items are
  completed."** This explicitly supersedes the earlier default of deferring any Pending item
  that names an open design fork — from here on, pick the most reasonable interpretation
  myself (documenting the choice clearly in both README.md and here, per this file's own
  long-standing "flag a reversal, don't silently guess" practice) rather than stopping to ask.
  Still hard-blocked, not guessable around: item 104 (a second IBAN provider needs a real,
  confirmed, keyless endpoint — fabricating one would ship a dead/wrong code path) and item 107
  (blocked entirely on the user's own sample Excel file, not yet attached). Items 94/95/96 are
  standing app-wide principles, not single scoped tasks, so "complete" for those means keep
  applying them opportunistically per-page rather than a one-shot close-out.
- **App-wide sync-status indicator, first item under the new standing instruction (2026-08-27)
  — see README Done item 189, closes Pending item 76.** The item itself posed 3 options
  (worst-of-N / most-recent / per-module popover) as an open design fork — picked worst-of-N
  as the headline (a single failing module is exactly what a unified indicator exists to catch;
  most-recent-wins would hide it) PLUS the popover breakdown, combining two of the three
  options rather than picking one. New `SyncStatusIndicator.tsx` classifies each module's
  existing free-text status string into 4 ranked tiers, reusing `AppearancePanel`'s own
  `position:fixed` popover trick via new separate `.sync-status-*` CSS. Threaded through
  `App.tsx`→`AppShell.tsx`→`Sidebar.tsx`, covering all 11 primary sync hooks (deliberately
  excludes the 3 "planned" secondary stores, same reasoning as their own upload-to-cloud
  affordance). Only renders once signed in. **Verification pattern worth repeating for any
  future sign-in-gated UI logic this session can't exercise live**: added a direct isolated
  component test (`SyncStatusIndicator.test.tsx`, 5 cases) rather than only a live signed-out
  smoke check — same approach `priceInputRemount.test.tsx` already established. `npx tsc -b` /
  `npm run test` (393 tests, 5 new) / `npm run build` all clean.
- **EMI markup annual/monthly equivalents, second item under the new standing instruction
  (2026-08-27) — see README Done item 190, closes Pending item 69's neighbor, item 70.** Item's
  own text already named the most-likely fixedTotal interpretation (markup-per-month ÷
  principal) as an unconfirmed assumption — built it as exactly that, flagged both in the new
  `markupRateEquivalents()` function's own doc comment and in the UI's tooltip, so nobody reads
  it as a real lender rate later. `fixedTotal`'s "annual" is always derived as monthly×12, never
  independently — a built-in consistency guarantee, same "make the two figures unable to
  contradict each other" instinct as Done item 188's Net Paid/Net Balance summing to 100%.
  Verified live via Playwright with a 12%-p.a. interest loan and a 1000/1120-fixedTotal loan
  (both over 12 months, chosen so their annual-equivalent numbers happen to coincide at 12% —
  confirmed this isn't a coincidence hiding a bug by also adding a dedicated "uneven tenure"
  unit test where they don't). `npx tsc -b` / `npm run test` (397 tests, 4 new) / `npm run
  build` all clean.
- **A real app logo designed, third item under the new standing instruction (2026-08-27) — see
  README Done item 191, closes Pending item 87.** Checked `public/favicon.svg` before assuming
  "no asset exists at all" from the Pending item's own wording — it turned out to BE a file, but
  Vite's own leftover generic scaffold art (purple/blue abstract shape), never actually
  replaced since the project's first commit, so the item's underlying claim held. New
  `LogoMark` in `icons.tsx`: 3 ascending bars (growth-chart motif) on a deep-navy badge, fixed
  brand colors rather than `currentColor` — same deliberate exception this file already makes
  for `GoogleIcon`, since a real logo should read as a stable identity independent of the
  viewer's own chosen in-app color theme, not reskin with it. Same mark duplicated as the
  static favicon file. Dropped into `Sidebar.tsx`'s existing title row with zero CSS changes
  needed (`.sidebar-title-row` was already a flex row). Verified live via real screenshots in
  both light and dark theme — legible in both, zero console errors.
- **Planning promoted to its own nav page, fourth item under the new standing instruction
  (2026-08-27) — see README Done item 192, closes Pending item 93.** The item posed its own
  design fork explicitly (a real `CategoryNav` entry vs. just more-visible-within-existing-nav)
  — picked the more literal reading of "should be part of the main nav" and the Transfers
  precedent the item itself named. New `features/planning/pages/PlanningPage.tsx` is genuinely
  thin: exports each module's existing `PlanningTab` (previously a private function inside
  `CashPage.tsx`/`BankPage.tsx`) unchanged and wraps both in `CollapsibleCard`s — zero
  duplicated balance-projection/plan-list logic. New `/planning` route reuses the same
  `plannedCashSync`/`plannedBankSync` props the existing `/cash`/`/bank` routes already thread
  through `App.tsx`. Each module's own "Planning" tab is untouched — this adds a second way to
  reach it, doesn't replace the first. Verified live via Playwright with seeded Cash/Bank data:
  nav entry renders and highlights correctly, both modules' real balance numbers render inside
  the new page — zero console errors.
- **Net Worth's daily snapshot made automatic, fifth item under the new standing instruction
  (2026-08-27) — see README Done item 193, closes Pending item 73.** This DIRECTLY REVERSES a
  previously locked decision (Done item 157's own explicit on-demand-only choice) — flagged
  prominently in both README.md and here, per this file's own long-standing practice, rather
  than silently changing behavior. Built exactly the "reasonable low-risk implementation" the
  Pending item's own text had already proposed: a `useEffect` in `NetWorthPage.tsx` auto-saves
  once per calendar day, guarded to be idempotent (skips once today's snapshot exists) and to
  NEVER fire for a signed-out visitor — checks `useAuthState()`'s real `user`, not the
  write-time `ensureSignedIn()` gate the manual button uses, since an automatic effect popping
  a sign-in modal with no user gesture behind it would be a genuine new UX regression, not just
  a cadence reversal. `types/netWorthSnapshot.ts`'s own doc comment (the actual source of the
  original locked decisions) updated in place, not just the two markdown docs — future sessions
  reading that file directly see the reversal, not stale "locked" language. Verified live via
  Playwright signed-out (this sandbox can't sign in as the user): confirmed no snapshot gets
  auto-created and no sign-in modal pops on page load, zero NEW console errors (2 pre-existing
  FX-fetch network-block errors, already documented, unrelated to this change).
- **`StatCard` background made more solid, sixth item under the new standing instruction
  (2026-08-27) — see README Done item 194, closes Pending item 91.** Explicitly named as a
  reversal of Done item 153's own softening pass — flagged again here, third reversal in this
  same continuation (after items 73/93). Measured first: a real before screenshot at the old 7%
  hue-mix ratio confirmed the "vague" complaint was accurate across 4 theme combinations, not
  just subjective. Bumped all three identical `.stat-card` background rules from 7% to 24% —
  deliberately past even the ORIGINAL pre-softening 16%, since "solid colors" asked for more
  than either prior state. Left the glassy sheen overlay completely untouched, since the user's
  own wording explicitly wanted that kept. Verified with real after screenshots across the same
  4 combinations — clearly saturated now, text/contrast still readable in dark mode.
- **Two new Net Worth distribution charts, seventh item under the new standing instruction
  (2026-08-27) — see README Done item 195, closes Pending item 78.** The item's own text
  guessed at the likely gap (a per-currency asset/liability breakdown, since the existing
  doughnut only shows net) — built exactly that. New "Assets vs. liabilities by currency" bar
  chart deliberately uses a SEPARATE data array from the existing doughnut's `splitData` — the
  doughnut excludes any currency with net ≤ 0 (can't render a negative slice), but an
  Assets-vs-Liabilities bar chart handles that fine, so including it would have silently hidden
  exactly the currencies most worth showing this comparison for. New "Breakdown within X, by
  module" bar chart reuses Done item 169's already-computed `r.breakdown` array unchanged — a
  charted view of the same data the small module cards already show, not new calc logic.
  Followed Personal Loans'/Rentals' own established horizontal-bar-colored-by-sign pattern
  rather than inventing a new chart shape. Verified live via Playwright with seeded multi-
  currency (USD/PKR) data including a real EMI liability, plus real chart screenshots (not
  just checking the title text renders) — both charts showed distinct, correctly-labeled,
  non-zero bars matching the seeded data.
- **EMI's "Big EMI"/"Link to bank" moved into an Advanced edit-form section, eighth item under
  the new standing instruction (2026-08-27) — see README Done item 196, closes Pending item
  67.** The item itself had already proposed the concrete design (tuck into a collapsed
  "Advanced" section of the EDIT form, not the add-loan form, since Big EMI needs a real
  schedule with elapsed months known) — built exactly that. **Real trap worth remembering for
  any future "move X into a section of Y" request where Y is already a Card**: a naive nested
  `CollapsibleCard` inside `LoanDetail`'s own outer `CollapsibleCard` would have reintroduced
  the exact "cards inside cards" visual pattern Pending item 90 separately complains about —
  used a plain bordered `<div>` sub-section instead (uppercase label + top border, matching
  this file's own `zone()` heading convention), not a second nested card. All underlying
  state/handlers unchanged, purely a JSX relocation. Verified live via Playwright: confirmed
  both controls are genuinely absent before entering Edit mode (not just collapsed), appear
  correctly once Edit is clicked, and the moved "Generate" button still hits the real sign-in
  gate — zero console errors.
- **EMI "Balance over time" chart, ninth item under the new standing instruction (2026-08-27) —
  see README Done item 197, closes Pending item 72.** The item named its own likely candidate
  (a balance-over-time line, matching Personal Loans' equivalent from Done item 172) — built
  exactly that, no guessing at a different chart set. No new calc function: unlike Personal
  Loans' repayment-event-driven `loanBalanceHistory()`, an EMI loan's entire balance curve is
  already known from day 1 via the amortization formula, so this just reuses
  `schedule.rows`/`resolvedDueDate`, the same data the Schedule table already displays. Placed
  directly after the existing Amortization chart, inside the already-established Stats →
  Schedule → Charts → What-if page order (Done item 168) rather than a new zone. Verified live
  via a real chart screenshot with a seeded $10,000/12-month/12%-p.a. loan: a genuine declining
  curve from ~9,000 to 0 across the tenure, zero console errors.
- **Banking account rows navigate to a real routed page, tenth item under the new standing
  instruction (2026-08-27) — see README Done item 198, closes Pending item 83 for Banking.**
  The item posed the fork itself and said the user's own wording favored a real navigable page
  over the existing modal — built that reading. `AccountDetailModal({account, onClose})` became
  `AccountDetailPage()` at a new `/bank/account/:id` route, resolving the account from
  `useParams()` against the live store — same content, just a page instead of a modal, with a
  back link matching QSE/PSX StockPage's own convention. **Real rules-of-hooks trap worth
  remembering for any future prop→route-param conversion of a component that assumed its
  subject always exists**: the account can now be `undefined` (stale bookmark, typo'd id), but
  React requires every hook to run unconditionally every render — so the "not found" early
  return has to come AFTER every `useState`/`useMemo` call, not before; each of those needed an
  `account ? ... : fallback` guard, and the two write handlers each got their own `if (!account)
  return;` guard. Scoped to Banking only — Cash/Personal Loans still use their own modal
  pattern, same "ship one page first" precedent as Done item 58. Verified live via Playwright:
  real URL navigation with no modal overlay, correct balance math and real transaction data on
  the page, working back link, and a graceful "Account not found" for a bad id instead of
  crashing — zero console errors.
- **Banking's `AddTransactionsForm` labeled, closing item 97's remaining scope (2026-08-27) —
  see README Done item 199.** Found while working on the account-detail-page conversion above:
  Banking's own multi-row `AddTransactionsForm` is the exact same "toolbar `.row`, no `<thead>`,
  no labels" pattern Done item 187 already fixed for QSE/PSX. Audited the other 6 non-exchange
  modules FIRST before assuming Banking was the only remaining gap — none of them has a
  multi-row toolbar-style add form at all, each adds one record at a time already `Field`-
  wrapped per the required-field rollout — so this really was the one genuine remaining
  instance, not a partial fix leaving others unchecked. Same first-row-only labeling convention
  as the QSE/PSX fix. Verified live on the account detail page (its newer of two call sites):
  every field shows a real visible label, zero console errors.
- **Required-field marking rollout closed for QSE/PSX's trade-entry forms, closing README
  Pending item 103 in full (2026-08-27) — see README Done item 200.** Picked up while auditing
  what's left in the Pending backlog after draining the notification queue from the prior PRs
  (#28-#39, all merged clean, nothing actionable). Item 103's own "still open" note claimed
  these forms used raw `<input>`s not wrapped in `Field` — checking the live code found that
  claim stale: Done item 187 (2026-08-26) had already `Field`-wrapped
  `TransactionsPage.tsx`'s multi-row add table and `StockPage.tsx`'s per-stock add-trade
  toolbar for labeling purposes, just without the `required` prop itself. Added `required` to
  exactly what each form's own submit-time validation checks (`ticker && shares>0 &&
  price>0`): Ticker/Shares/Price on `TransactionsPage.tsx`'s first row (QSE+PSX), Shares/Price
  on `StockPage.tsx`'s toolbar (QSE+PSX — Ticker's fixed by the route there, not a field).
  **Lesson reinforced**: a Pending item's own "still open" reasoning can go stale when an
  unrelated later fix incidentally covers part of the ground it named — worth re-checking the
  live code before trusting a Pending item's stated reason, not just its existence, the same
  "check git history before assuming it needs work" discipline already noted elsewhere in this
  file. Edit-in-place forms deliberately excluded, same reasoning as Done item 199's labeling
  fix — they share the same `<table>`/`<thead>` as their own add-row. Verified live via
  Playwright with real seeded data: QSE/PSX Transactions show `TICKER*`/`SHARES*`/`PRICE*` on
  row one; QSE StockPage (after expanding its collapsed "Trades" section — a reminder that
  every section on a `StockPage`/similar `Tabs`-driven page now renders collapsed-by-default
  behind an accordion, so a verification script needs to expand the right section first or it
  reads as "field not found" when it's really just hidden) shows `SHARES*`/`PRICE*` — zero
  console errors. `npx tsc -b` / `npm run test` (397 tests, unchanged) / `npm run build` all
  clean.
- **Budget Planner: 6-month scrollable summary table + a Net Worth trend row (2026-08-27) —
  see README Done item 201, closes README item 107's remaining UI half.** User clarified item
  107 wanted a scrollable multi-month table matching their reference Google Sheet (their real
  data was already imported, Done item 178), plus a way to "zoom in" on Net Worth's trajectory
  rather than just a permanently-negative headline while a 36-month EMI runs. Confirmed via
  `AskUserQuestion` (recommended options both picked): extend Budget Planner rather than a new
  page, and add a per-month Net Worth trend row to the same table rather than a currency-
  exclusion toggle or new asset-tracking. New `monthRange(startOffset, endOffset, asOf)` in
  `budgetPlanner.ts` generalizes `threeMonthWindow` (kept, now built on it). New
  `MonthlySummaryTable` in `BudgetPlannerPage.tsx`: 6-month sliding window (default 3 past +
  current + 2 future), ◀ Earlier/Today/Later ▶ controls, Income/Expense/Net/Net worth as rows.
  **No reference image was actually available in this session** (the one the user mentioned
  earlier had scrolled out of visible context) — built from their text description, flagged for
  their own visual confirmation once they can re-share it.
  **The Net Worth trend row is the substantial new calc** — new `lib/calc/netWorthTrend.ts`'s
  `projectedNetWorthTrend()`: past months read from real `NetWorthSnapshot`s (Done items
  157/193) — undefined/"—" where none was ever saved, never guessed; current/future months
  project today's real Net Worth (`useNetWorthSummary()`) plus (1) cumulative non-EMI cash flow
  from Budget Planner's own activities after today through that month, and (2) the EMI
  outstanding-balance delta between today and that month, reusing `emiModule.ts`'s existing
  `totalsByCurrency(loans, asOf)` unchanged. **Term (1) deliberately excludes any activity
  tagged `sourceEmiLoanId`** (new passthrough field on `BudgetActivity`) — without it, an EMI
  installment plan would double-count: once as a full cash expense, again by not crediting back
  the principal portion term (2) already credits via the schedule. Same double-counting shape
  as the Trade Planner's executed-leg bug (Done item 64) — designed around up front here, not
  fixed after the fact. **A real bug was still caught by a hand-traced test, not just avoided by
  design**: the first cut called `totalsByCurrency(emiLoans)` for "today's" EMI figure with no
  explicit `asOf`, silently defaulting to the real wall-clock `new Date()` instead of the
  function's own `todayISODate` param — invisible in production (today always literally is
  today) but caught immediately by a test using a fictional date, exactly why that test used
  one. Fixed by passing `new Date(todayISODate)` explicitly. **Rule worth repeating for any
  future pure function that takes a `todayISODate`/`asOf`-shaped param and then calls another
  function with its OWN default-`new Date()` fallback**: always pass the param through
  explicitly — a default that reads real wall-clock time inside an otherwise-pure function is a
  latent test-only bug waiting to happen. Verified live via Playwright with seeded Cash/Bank/
  EMI/snapshot data, hand-checked against the rendered numbers: August's Net worth (850.00 USD)
  matched 1,350 assets − 500 EMI outstanding by hand; September's projection (750.00) matched
  850 + (−200 planned expense) + 100 (EMI paid down another 100 by month-end); October's
  (850.00) matched 850 + (−200 cumulative) + 200 — the debt-paydown term visibly pulling the
  trend back up over time, the exact effect asked for. Clicking "◀ Earlier" shifted the window
  back one month correctly. Zero console errors. `npx tsc -b` / `npm run test` (404 tests, 7
  new) / `npm run build` all clean.
- **Large UI/UX critique batch received mid-turn, 2026-08-27, screenshot-backed — see README
  Done item 202 for what shipped, Pending items 108-111 for what's tracked but not started.**
  User's screenshot showed the Net Worth page with what looked like a real card/chart overlap
  at their own "50% browser zoom" (their words), plus a list of complaints: an "Assets vs.
  Liabilities" chart that reads as one-currency-only, and a repeated push that adding/editing an
  ENTITY (Bank, EMI, Fund, Property...) isn't a routine task and shouldn't live permanently on
  the main screen — use FABs, matching the pattern already built for EMI/Banking/Cash-Bank
  Planning (Done items 166/170). **Audited before acting, found 4 real remaining gaps**: Funds
  ("Add fund"), Personal Loans ("Add loan"), Rentals ("Add property"), Subscriptions ("Add
  subscription") still had a permanently-visible add-form — converted all 4 to the identical
  FAB+`Modal`+`Tooltip` pattern, verified live via Playwright (FAB present, form hidden by
  default, shows correctly on click) across all 4, zero console errors. Left each module's own
  routine per-record transaction/entry forms alone — exactly the daily-vs-rare distinction the
  user drew.
  **Investigated the "Assets vs. Liabilities" complaint rather than assuming it — seeded a real
  2-currency (QAR+PKR) scenario with known cross-rates and confirmed via screenshot the chart
  ALREADY renders one bar-pair per currency correctly.** The real problem was the title's
  wording: `"...by currency (converted to X)"` reads as "reduced to one currency," when it
  actually means "each currency's own bars, heights normalized to X so they're comparable on one
  axis." Reworded the title rather than touching chart logic that wasn't broken — a case worth
  remembering for any future "X only shows 1 of my Y currencies" report: verify the actual
  rendered data before assuming the calc is wrong, since here the data was already correct and
  only the label was misleading.
  **The reported overlap itself could NOT be reproduced**, despite two real attempts: a
  realistic multi-currency seed at 1280px (clean, no overlap) and a CSS `document.documentElement
  .style.zoom = '0.5'` simulation with a forced resize afterward (also clean) — the closest
  approximation to a real browser's native Ctrl+- zoom available through this session's
  automation tooling, which has no direct API for that specific browser-chrome feature. Rather
  than claim a fix for an unreproduced bug, added two defensive-only hardening measures that are
  correct regardless of whether they're the actual cause: `.chart-canvas-wrap{overflow:hidden}`
  (theme.css) as a safety net against any future canvas-sizing edge case bleeding past its card,
  and bumped the specific gap between Net Worth's "Income vs. expense" chart and the "Net Worth
  Summary"/"Exchange Rates" cards below it from 16px to 24px. **This is explicitly flagged as NOT
  closing the complaint** (README Pending item 108) — needs the user's real zoom percentage/
  browser or a fresh screenshot at that zoom to actually chase down, rather than another blind
  guess.
  **Three larger items from the same message were deliberately NOT attempted, tracked as Pending
  items 109-111 instead**: sidebar nav re-nesting (genuinely ambiguous which concrete UI element
  "subnav dumped in main nav" refers to — the top-level category list is a deliberate, already-
  reversed-once design per Done item 181, so guessing wrong here means a SECOND reversal and real
  rework, not a small tweak; the more literal candidate is QSE/PSX's own inline numbered page
  list, which no other module has); "prefer charts over tables" (a real, broad preference, in
  some tension with the very Budget Planner table just shipped the same session to the user's own
  explicit spec — flagged rather than silently reconciled); and "most tables need horizontal
  scroll" (real, but too broad to act on without a named table or treating it as a standing
  per-table principle like Pending items 94-96 already are).
- **Editable price-history entries + Trend/Value/P&L stat cards + two real layout bugs
  (2026-08-27) — see README Done item 203.** Same-day follow-up batch, screenshot-backed. Items
  1/2 were confirmed as real gaps by reading the live code first, not assumed from the user's
  framing alone: `setMarketPrice` only ever appends a new point dated TODAY, with no way to
  correct a mistaken PAST entry (item 1); the Holdings table's Trend/Value/P&L columns had never
  actually landed on the per-stock detail page (item 2), despite Done item 152's own text
  claiming parity — it only added Exit targets/Status, not these three.
  **New `updatePricePoint`/`deletePricePoint` in `createWorkbookStore.ts`** (shared by QSE/PSX/
  Funds at once) — addressed by array index within `priceHistory[ticker]` (no stable id on
  `PricePoint`), and **re-syncing `marketPrices[ticker]`** (the separate cached "current price"
  `getMarketPrice()` prefers) whenever the edited/deleted point was the chronologically latest
  one, so the two fields can't drift apart — the same "keep two related fields in sync in one
  write" discipline used throughout this project. `PositionDetail.tsx` (both exchanges)
  now has Edit/Delete `IconButton`s on its "Recent updates" rows, matched back to their real
  store index via `indexOf` on the displayed row object (object identity survives
  `computePriceStats`'s sort/slice/reverse chain — verified by reading it, not assumed). Trend/
  Value/P&L added as three new stat cards in "Current position," reusing the exact `Sparkline`+
  `getDailyPriceHistory` combo the Holdings table itself already uses for Trend.
  **Two real, measured-not-guessed layout bugs from the same batch (items 4/5)**:
  (4) "Account and backups ui inconsistent" — `.account-sub-btn` overrides `padding-left` to
  34px to indent the Backup/Sync rows under the account row, but `.account-btn` never got the
  same treatment; measured via Playwright bounding boxes: a real 22px icon misalignment (25px vs
  47px) between the "Signed in as X" row and its own siblings. One-line CSS fix, confirmed broken
  before and fixed after via the identical measurement — the same "measure, don't guess"
  discipline this file has repeated many times over. (5) The Dashboard right-rail (Done item 164)
  visibly clipped at the viewport edge on a smaller display — root cause: `.rail-split`'s `1fr`
  grid track has an implicit `min-width:auto`, so its wide left-column content (many stat cards,
  the Holdings table) refuses to shrink and instead pushes the WHOLE grid, fixed-width rail
  column included, past the viewport's right edge. **Classic CSS Grid trap worth remembering for
  any future `1fr` + fixed-width-column layout**: an `1fr` track's minimum size defaults to its
  content's own intrinsic width, not 0 — a wide child needs an explicit `min-width:0` on the
  grid item to actually let it shrink and hand overflow to its OWN internal scroll container
  instead of blowing out the whole grid. Fixed on both `.rail-split` and `.position-split` (the
  latter audited proactively — same grid shape, now carrying an even wider stat-card row after
  this same item's own Trend/Value/P&L additions) with `min-width:0` on the grid children.
  Confirmed via a real before/after bounding-box measurement at 1200px: rail's right edge at
  1385px (past viewport) before, 1170px (safely inside) after. Item 3 ("side nav poorly
  arranged") stayed genuinely ambiguous even after investigation — tracked as README Pending item
  112 rather than guessed at, likely overlapping with Pending item 109's own open nav question.
  New tests: `createWorkbookStore.test.ts` gained 2 cases (edit-the-latest-point resync,
  delete-down-to-zero resync). Verified live via Playwright throughout — sign-in gate fires
  correctly on price-history edit/delete (same verification depth as every other gated write in
  this project), Value/P&L numbers hand-checked correct on both exchanges, zero console errors.
  `npx tsc -b` / `npm run test` (406 tests, 2 new) / `npm run build` all clean.
- **Mid-turn, urgent trust/correctness question (2026-08-27, not yet resolved): user says PSX
  calculations are wrong and caused real financial losses, asked specifically how Break-even is
  computed.** Read `breakEvenPrice()` (`lib/calc/fees.ts`) and `calcFeeBreakdown()`/
  `makePSXFeeCalculator()` (`lib/calc/psxFees.ts`) directly rather than explaining from memory —
  confirmed the algorithm itself is a legitimate iterative solver (converges P such that net sell
  proceeds after the REAL fee schedule equal total cost basis) and hand-traced it against the
  user's own real OGDC position numbers from their screenshot (327.80 cost → ~328.6 BE using
  default settings, close to their shown 328.56) — the formula is not obviously broken.
  **Noted a strong, concrete lead, not yet confirmed**: the exact two tickers in the user's own
  screenshot, OGDC and PSO, are the SAME tickers Done item 127 already identified as needing
  manual review for a stale `manualSameDay: true` flag left over from the old (reverted) same-day
  default-checking bug (Done item 67) — that item explicitly said this couldn't be auto-corrected
  and needed the user's own check. Asked the user: (1) whether they've checked those specific
  OGDC/PSO buy transactions' Fee Mode for a wrongly-set manual same-day flag, (2) their real
  Settings → Fees & CGT values, (3) which specific number looks wrong and what they expect
  instead. **Do not assume this is resolved or that the flagged transactions have been checked**
  — a future session picking this up should wait for the user's answer rather than assuming the
  stale-flag theory is confirmed or ruled out.
- **Resolution of the above, same session (2026-08-27) — see README Done item 204, "PSX Simple
  fee mode."** The user's real screenshot showed OGDC's Cost at exactly 327.80 with no commission
  reflected — confirming the manualSameDay-flag theory (a Manual/netted Fee Mode with no matching
  sell yet). Suggested switching it back to Auto; the user pushed back hard: "Auto is totally
  wrong... how can you add fee until the day end/market close?" This needed a real, honest
  back-and-forth, not just restating the same position — walked through the CONCRETE evidence for
  why Auto (charge immediately, net automatically once a real matching sell exists) is what it is:
  it's the reversal of Done item 67, which tried exactly the user's own instinct (assume netted by
  default) and was found — by checking against the user's OWN real broker backup, not in the
  abstract — to under-count fees by 24.69 PKR across 5 transactions. That evidence held up; citing
  it precisely (not just asserting "trust me") is what moved the conversation forward instead of
  going in circles. **The user's actual ask, once it came out clearly, wasn't about the default at
  all** — it was that reconciling 6 itemized fee fields by hand is unnecessary friction when their
  real broker's effective rate is one number they already know from comparing against another app
  (which took a single flat commission % and got a BE closer to what they consider correct). Built
  `PSXSettings.feeMode: 'itemized' | 'simple'` + `allInFeePct` — Simple mode makes `calcFeeBreakdown`
  compute one flat `amount × allInFeePct%` instead of the itemized commission+SST+levies chain,
  stuffed into the existing `commission` field so `makePSXFeeCalculator`/`feeScenarios` (same-day
  netting, tie-goes-to-BUY, etc.) needed ZERO changes — they already just read `.total` and the
  (now-zeroed) levy fields, so Simple mode's netted leg automatically costs nothing extra, for
  free, matching the user's own "levies are negligible" framing. Both new fields optional,
  `undefined` behaves as itemized — no existing workbook silently changes. **Verified against the
  user's own literal numbers, not synthetic ones**: seeded their exact OGDC scenario (1@327.80,
  0.021% all-in, their own stated rate) and hand-confirmed every downstream figure via Playwright
  — Fees paid 0.07, Cost 327.87, BE 327.94, P/L -0.14 — a BE much closer to raw price, the exact
  effect they described from the comparison app. **Lesson for any future "the user is pushing back
  on an explanation" moment**: don't just repeat the position more firmly — find the SPECIFIC
  historical evidence (a real number, a real prior investigation) that either confirms or
  overturns it, and lead with that; here it turned out both things were true at once — Auto's
  default was correctly evidenced AND the user had a real, legitimate, previously-unbuilt need
  (automation via one flat rate) that a mode toggle solves without touching the validated default
  at all. `npx tsc -b` / `npm run test` (411 tests, 5 new) / `npm run build` all clean.
- **Critical sign-in flow bug fixed, user-reported (2026-08-27) — see README Done item 205.**
  "Sign in with Google somehow becomes successful in opening google popup but after, window may
  stay or disappear, no status update... You are not logged in!" — plus Signup/Forgot Password
  "not working" and general UI inconsistency ("designed by a junior student"). **Root cause,
  found by reading the actual code, not guessed**: `signInWithPopup` needs a `postMessage`
  bridge between the popup and opener window across DIFFERENT origins (authDomain
  `qse-app.firebaseapp.com` vs. the app's own `ranamrameez.github.io`) — exactly the cross-
  origin popup case modern Chrome's COOP defaults and third-party storage partitioning are
  documented to break. Firebase's own fix (a `Cross-Origin-Opener-Policy:
  same-origin-allow-popups` response header) isn't available on GitHub Pages' static hosting.
  **Fix: switched to `signInWithRedirect` + `getRedirectResult()`** (called once on app load in
  `useAuthState.ts`, same spot as the existing email-link handler) — a full-page nav to Google
  and back, sidestepping the popup/postMessage mechanism entirely. **Real, stated tradeoff**: a
  redirect tears down the page, so a `requireSignIn()` promise a gated write was waiting on
  can't resolve in that page load — the user returns already signed in and has to retry
  whatever write they were doing (succeeds immediately, no re-prompt). Judged strictly better
  than the popup hanging forever with zero resolution.
  **A second real gap found WHILE testing this fix in this session's own sandbox, kept
  regardless of root cause**: every Firebase auth call (`signInWithRedirect`,
  `signInWithEmailAndPassword`, `resetPassword`) makes a real network request that can HANG
  rather than fail fast on a bad connection — reproduced live here, since this sandbox's own
  network policy blocks the Firebase domain, so every one of these calls sat pending forever
  with the busy button never reverting (the exact "no status update, stuck forever" bug being
  fixed, caught red-handed reproducing itself). Added a shared `withTimeout()` (12s) in
  `SignInModal.tsx` racing every auth call — worst case for a real user is now "a clear error
  after 12s and a clickable button again," never silence.
  **Two more concrete fixes from the same report**: (1) "Forgot password not working" —
  the button was silently `disabled` whenever the email field was empty, with zero visual
  explanation; a disabled button with no reason shown reads exactly like "broken." Made it
  always clickable, validating on click with a toast instead. (2) UI consistency — the modal
  used raw unstyled `<input>`s with no labels, the only form in the whole app that did; swapped
  in the same `Field`/`TextInput` components everywhere else uses, added real busy-state button
  labels ("Signing in…"/"Opening Google…"/etc.) instead of just a disabled cursor, and mapped
  the handful of Firebase auth error codes a user actually hits to plain language via a new
  exported `friendlyAuthError()` instead of surfacing Firebase's raw SDK message text.
  **Verification note worth repeating**: the 12s-timeout Playwright check wasn't just testing
  the timeout code in isolation — because this sandbox's network policy genuinely blocks the
  Firebase call, watching the button get stuck and then correctly recover at the 12s mark WAS a
  live reproduction of the exact bug being fixed, not a synthetic test. **Not verified, flagged
  rather than assumed**: an actual successful Google-redirect-and-back round trip needs a real
  Google account and real network access, neither available here — the user (or a future
  session) should confirm the success path lands back on the app correctly signed in. New
  tests: `friendlyAuthError.test.ts` (4 cases). `npx tsc -b` / `npm run test` (415 tests, 4
  new) / `npm run build` all clean.
- **QSE/PSX "Closed trades" ledger, closing point #1 of the same 5-item critique (2026-08-27) —
  see README Done item 206.** User's own words: "Individual stock should be marker as open/
  close with its own buy & selling price, B&S taxes, net Buy/sale — so that sold/closed shares
  do not ruin the calcs." Investigated `computePositions`/`computeFIFOPositions` first, not
  guessed at: both aggregate rollups are already correct (a fully closed round-trip cleanly
  zeroes out before a later buy starts fresh; FIFO already tracks each buy as its own lot) — the
  real gap was that nothing surfaced a per-trade, itemized "here's exactly what this closed
  round-trip cost and made" view anywhere. The existing Open/Closed split on Trade Transactions
  (Done item 73) groups by TICKER, not by trade, so a ticker with any open shares shows every
  past transaction for it (including old closed round-trips) mixed under "Open." New
  `lib/calc/closedTrades.ts`'s `computeClosedTrades()` reconstructs a per-trade ledger via FIFO
  matching — deliberately independent of `PSXSettings.costBasisMethod`, since it's a reporting
  ledger only that never feeds back into either position calc: each sold share matches the
  oldest open buy lot, and every match becomes its own record with that specific buy/sell date/
  price, each leg's own prorated fee, net P&L, and days held. A sell draining more than one buy
  lot produces one record per lot touched (not blended into an average); a buy lot split across
  multiple sells produces one record per sell that touched it, each with its own prorated share
  of that buy's fee. New "Closed trades (realized round-trips)" collapsible section on both
  QSE's and PSX's Trade Transactions → Trade list tab, below the existing Open/Closed-by-ticker
  sections (kept unchanged for raw browsing), sortable and respecting the page's ticker filter.
  New tests: `closedTrades.test.ts` (6 cases: simple match, partial sell, split-across-two-lots
  with independent fee proration, cross-ticker independence, unmatched buy → no record, same-day
  round trip). Verified live via Playwright on both exchanges with a seeded 2-lot/1-sell scenario
  (5@100 + 5@120, sold 8@130): confirmed the 2-record split (5 from the older lot, 3 from the
  newer) with hand-checked fee/net-P&L math matching exactly under both QSE's flat-rate and
  PSX's itemized commission+SST+levies models — zero new console errors. `npx tsc -b` / `npm run
  test` (421 tests, 6 new) / `npm run build` all clean.
- **PSX per-stock page: "Break-even, same-day vs. other day" scenario card, closing the
  accepted "do it" ask from the same trust conversation (2026-08-27) — see README Done item
  207.** The existing `be` figure in `PositionDetail.tsx` already IS the "other day / full
  commission" scenario, since `breakEvenPrice()` always calls `calcFee` with no `tx` context,
  and `makePSXFeeCalculator`'s own `if (!tx) return ...total` branch means that always returns
  the full fee, never netted — nothing needed to change there. New: a second break-even
  computed via a small inline `FeeCalculator` that always returns `feeScenarios()`'s `netted`
  figure (government levies only — the same same-day-netting math the Trade Planner's own
  `feeScenarios()`/`WhatIfExitCalculator` already used, README Done item 104), fed into the
  same `breakEvenPrice()` solver. New "BE: same-day vs. other day" stat card in "Current
  position," with a tooltip explaining PSX's real same-day rule (smaller-quantity leg netted,
  ties go to the buy) and the assumption this scenario makes. PSX-only — QSE has no same-day
  netting concept at all. Verified live via Playwright with the user's own real numbers (OGDC,
  1 share bought today at 327.80): same-day BE (328.63) correctly came out lower than other-day
  BE (329.39) — same relationship as the user's own hand-worked example. `npx tsc -b` / `npm
  run test` (421 tests, unchanged) / `npm run build` all clean.
- **Same scenario extended to the PSX Trade Calculator popup, same day (2026-08-27) — see
  README Done item 207's update.** `TradeCalculator.tsx`'s "Break-even" stat card shows the
  CURRENT open position's BE — the same figure the user's own worked example was about — and
  is distinct from "New break-even" (an already-existing, separate figure for a hypothetical
  ADDITIONAL buy, deliberately left untouched here since it's answering a different question).
  Added the identical `nettedCalcFee`/`feeScenarios` pattern used in `PositionDetail.tsx`.
  Verified live via Playwright with the same OGDC scenario, opening the calculator through its
  real `aria-label="Trade calculator"` FAB button: the card showed "329.39 / other day ·
  same-day 328.63" — matching `PositionDetail`'s own numbers exactly — zero new console
  errors. `npx tsc -b` / `npm run test` (421 tests, unchanged) / `npm run build` all clean.
- **QSE/PSX "Show all" price-update history, user-reported (2026-08-27) — see README Done item
  208.** "Current price updates are shown upto recent 8. no view to see them all." The "Recent
  updates" table in `PositionDetail.tsx`'s "Price range" card was hard-capped to
  `computePriceStats()`'s `stats.recent` (last 8, newest-first) with no in-app way to see the
  rest (only the CSV export button reached full history). Added a `showAllPrices` toggle that
  swaps the table's source between `stats.recent` and the full `stats.chronological` (also
  newest-first) — safe for the existing edit/delete `rawHistory.indexOf(p)` row resolution
  since `computePriceStats()` builds both arrays from the SAME `PricePoint` object references,
  never clones. Toggle button only renders when there's actually more than 8 to show; summary
  line always states both counts. Verified live via Playwright on both exchanges with 12-15
  seeded updates: collapsed shows exactly 8, expanding shows the full count in correct order,
  and — the case most likely to silently break — editing a row from beyond the original 8
  correctly resolved to that exact row's own date/price. `npx tsc -b` / `npm run test` (421
  tests, unchanged) / `npm run build` all clean.
- **Sidebar restructured, closing README Pending items 109/112/113 (2026-08-27) — see README
  Done items 209/210.** Two independent complaints ("subnav dumped in main nav" and "side nav
  poorly arranged") converged on the same real outlier: Stock Exchanges' numbered page list
  (01 Dashboard...08 Settings) rendered permanently inline in the sidebar, unlike every other
  module (which keeps Settings/Account/Export behind in-page `Tabs`, not the sidebar). Both
  README items explicitly said this needed the user's own confirmation first — collapsing the
  app's primary QSE/PSX navigation is architecturally significant, not a small tweak, and a
  wrong guess costs real rework. Asked via `AskUserQuestion` (collapse into an accordion vs.
  just a visual separator vs. leave it alone) — user picked collapse. New `usePagesOpen()`
  hook in `Sidebar.tsx`: a "▸ Pages" toggle (same rotate-90 chevron convention as
  `CollapsibleCard`, but not wrapped in an actual `Card` — a sidebar nav section shouldn't
  carry card styling) collapses the list by default, persisted to `localStorage`
  (`financerecorder_stock_pages_open_v1`, same try/catch pattern as `AppShell.tsx`'s existing
  whole-sidebar collapse) so once expanded it stays expanded across reloads. Also picked up
  the smaller companion item (a visual separator between the category list and the exchange
  block) in the same pass without asking again, since it's pure CSS with no navigation-
  behavior change: a `1px solid var(--border)` top border now makes that boundary explicit.
  **Verification note worth repeating**: an initial Playwright check for "collapsed by
  default" read as a false failure (count of 1, not 0) because `CategoryNav` itself also uses
  the `.navlist` class — refined the selector to `nav.navlist:not(.category-list)` to
  distinguish the two, then confirmed collapsed/expanded/persisted-across-reload/hidden-on-
  other-categories all behave correctly, plus a real screenshot confirming the divider and
  accordion render cleanly together. `npx tsc -b` / `npm run test` (421 tests, unchanged) /
  `npm run build` all clean.
- **Workflow rule change (2026-08-27, user-stated, supersedes the earlier "continue
  autonomously" standing instruction for anything beyond a single already-agreed task): "you
  will plan & propose me the changes. After my approval you will continue your work until all
  done."** After that same sidebar accordion change shipped, the user said it was "totally
  wrong" — not because the mechanism was broken, but because it didn't match what they actually
  wanted (see the next entry) — and asked to be shown a plan before code from here on. In
  practice: for a request with real design/scope ambiguity, write out the concrete plan
  (what changes, what stays, what's still undecided) and wait for explicit approval BEFORE
  touching any file — do not treat "propose a plan" as optional context to skim past. Once a
  plan is approved, execute it through to completion without re-asking at each step (matching
  the original autonomous-execution instruction), flagging only genuinely new ambiguity that
  surfaces mid-build. A single, narrow, already-agreed task (like this session's Funds balance
  request below) doesn't need a fresh planning round each time — the rule is about not
  guessing on open design questions, not about re-approving obviously-scoped work.
- **Funds: "Update balance" quick action, urgent user request (2026-08-27) — see README Done
  item 211.** "I only have info of daily balance update rather than NAV. so give me an option
  to update fund balance other than deposit and withdraw." New `impliedFundNav(balance, units)`
  in `lib/calc/fundsDailyHistoryImport.ts` — the same formula the Daily History Import (Done
  item 151) already uses per-row for a no-cash-flow day (`newBlc / units`), exposed standalone
  for a single quick entry instead of a full spreadsheet upload. Returns `null` when no units
  are held yet (nothing to divide across); the new "Update balance" field next to "Update NAV"
  in `FundsPage.tsx`'s `FundDetail` is disabled in that case. Reuses the existing
  `setMarketPrice` action unchanged — this only changes how the NAV number gets computed, not
  how it's saved, so `priceHistory`/`marketPrices` stay in sync exactly as they already did.
  New tests: `fundsDailyHistoryImport.test.ts` gained 2 cases for `impliedFundNav`. Verified
  live via Playwright with a seeded 100-unit position: sign-in gate correctly fires on save.
  `npx tsc -b` / `npm run test` (423 tests, 2 new) / `npm run build` all clean.
- **Stable per-record sequence numbers (`seq`), app-wide, closing a critical user-reported gap
  (2026-08-27) — see README Done item 212.** "auto generate unique int ids for each single
  item so that even matching dates cannot stop us from loosing the correct order of the data.
  in transactions, correct order is everything." Ordering relied on comparing a real instant
  and, on an exact tie (the common case for an untimed record, which defaults to noon UTC),
  falling back to `Array.prototype.sort`'s stability — implicitly trusting array order, which
  doesn't survive a delete-and-re-add, an import reordering the array, or a merge from another
  source. New `lib/seq.ts`: `nextSeq(existing)` (one more than the highest `seq` already
  present — used by every "add a new record" action) and `backfillSeq(records, chronological)`
  (fills in `seq` on real pre-existing data missing it, walking a caller-supplied best-available
  chronological order, without touching the records' own stored array order). `seq?: number`
  added to every record type that participates in chronological ordering:
  `Transaction`/`Transfer`/`Adjustment`/`Dividend` (shared by QSE/PSX/Funds via
  `createWorkbookStore.ts`), `CashEntry` (via the generic `createEntryStore.ts`, backfilled in
  array order since that factory can't assume a `date` field), `BankTransaction`,
  `PersonalLoanRepayment`, `RentalEntry` (each hand-written store, own `normalize()` backfill
  added). **Deliberately scoped out, after checking rather than assuming**: EMI's
  `EMIRepayment` (addressed by `month`, an inherently unique index — verified no chronological
  sort exists for it); `PricePoint` (a price observation, not a money movement, with no stable
  id of its own today either — a bigger separate change); `TradePlanLeg` (already narrower-
  scope, addressed by index within its own plan); `WatchlistItem` (keyed by its own natural
  key). Every relevant comparator updated to use `seq` as the tie-breaker AFTER any real domain
  rule that must stay first for financial correctness — `sortTransactionsChronological`'s
  BUY-before-SELL rule (Done item 128) and `buildCashLedger`'s transfer-before-trade rule both
  still win a tie before `seq` is consulted, so this is additive to those fixes, not a
  replacement. Sorts updated: `sortTransactionsChronological`, `buildCashLedger`,
  `cashRunningLedger`, `accountRunningLedger`, `personalLoansModule.ts`'s
  `repaymentRunningOutstanding`/`loanBalanceHistory`, `transferBalance.ts`'s
  `transferRunningBalance` (also upgraded from a plain date-string compare to real-instant,
  matching the rest of the app's convention while already in the file), and `getMarketPrice`'s
  same-day-buys fallback. **A real "weak type" TypeScript gotcha hit repeatedly while wiring
  this into the generic store factories**: a plain object type with all-optional properties
  (like `{seq?: number}`) is rejected by TS when assigned a concrete object with ZERO
  properties in common (e.g. `{id: string, date: string}`), even though structurally an
  absent optional property should satisfy it — worth remembering for any future optional-field
  helper generic over an unconstrained `T`: either widen the constraint explicitly or cast at
  the call site, plain structural typing isn't enough. New tests: `lib/__tests__/seq.test.ts`
  (6), `sortTransactions.test.ts` (4, new file), `cashLedger.test.ts` (3, new file), plus
  seq-tie regression cases in `cashModule.test.ts`/`bankModule.test.ts`/
  `personalLoansModule.test.ts`/`transferBalance.test.ts`/`createWorkbookStore.test.ts` — 19
  new tests total. Verified live via Playwright: a seeded QSE workbook with two same-day BUYs
  stored in reverse chronological order loaded and computed correctly with zero console
  errors — same-type position merges are associative, so this mainly confirms nothing crashes
  on real backfilled data; the ordering correctness itself is what the 19 new unit tests
  directly prove. `npx tsc -b` / `npm run test` (442 tests, 19 new) / `npm run build` all
  clean.
- **App-wide "Transfers" FAB replaces every module's own add-transaction UI (2026-08-28) — see
  README Done item 216.** User's own design, entered via plan mode: a single "Transfers" FAB
  (opens an expandable `FabPanel` when a page also has its own "add entity" action) reachable
  from every module, opening one shared `TransactionEntryModal` — "This entirely removes the
  transfers page and the problem of duplicated transaction cards." Removed 7 modules' own
  separate add-transaction UI (Bank/Cash/Rentals/Personal Loans/Funds/QSE/PSX) in favor of the
  one shared modal; EMI's own more-precise schedule pencil-editor is deliberately untouched,
  gaining Transfers only as an additional entry point. The standalone `/transfers` page and its
  `CategoryNav` entry are gone — `TransferLinksPage.tsx` is now a shared-utilities-only module
  (`SideFields`/`useSideCurrency`/`linkTargetPath`) imported by the new modal and by every
  module page. Every module's own transaction list gained a "🔗 Linked" tag with a nav link to
  the other side, replacing the removed page's own links list. **Found and fixed a real
  pre-existing CSS cascade bug while building this, not caused by it but made newly relevant**:
  `.fab-btn`/`.fab-btn-secondary` were bare single-class selectors, same specificity as (and
  positioned before) the base `.btn` rule in `theme.css` — equal-specificity CSS resolves by
  source order, so `.btn`'s later width/min-width/border-radius silently won, flattening every
  round 52px FAB button down to a ~40px non-round default shape the whole time (confirmed via a
  real `getComputedStyle` check, not assumed). This also fully neutralized the new
  button-width-consistency rule this same change was adding. Fixed both with compound
  `.btn.fab-btn`/`.btn.fab-btn-secondary` selectors (specificity 0,2,0 beats 0,1,0, correct
  regardless of file order) and folded the new `min-width:100px` directly into the base `.btn{}`
  rule rather than a separate block the same trap would have shadowed again. **Lesson for any
  future CSS class meant to override a shared base class**: check whether it's a bare
  single-class selector at the SAME specificity as what it's overriding — if so, it only wins
  by accident of file position, not by design; a compound selector (or `:where()`/`!important`
  if compounding isn't possible) is the robust fix. `npx tsc -b` / `npm run test` (442 tests,
  unchanged) / `npm run build` all clean. Opened as PR #57 (draft), self-reviewed and merged
  per the user's standing "review and merge yourself" instruction.
- **New feedback received mid-session (2026-08-28), NOT yet started — explicitly deferred by
  agreement with the user until the Transfers-FAB work above was finished and verified.** (1) A
  future Calendar widget (day/month/year expense-income-by-category view) — not yet scoped. (2)
  EMI's add-loan popup has no fields for irregular/custom installment plans — a real user
  scenario: a plot bought on installments in 2024 with a partial booking payment, a recurring
  "major EMI" every 6 months, and randomly-timed real payments (after 5, 3, 6 months). Needs:
  the 6-month major-installment generator to actually work for an OLDER start date (currently
  doesn't), the ability to edit dates/amounts on an existing custom schedule, recording actual/
  irregular payments (including fines) while the regular schedule stays intact, a "link this
  payment to a finance" option in the add/edit flow, and each loan remembering its own default/
  last-used finance. (3) Net Worth page: "UI gaps inconsistent" — vague, needs investigation to
  find what's actually meant before doing anything. (4) Funds/Mutual Funds: a way to log
  Invest/Withdraw by AMOUNT ALONE, since the user doesn't know NAV/units — check against the
  existing "Update balance" quick-action (Done item 211) before assuming this is a from-scratch
  gap; it may already partially cover this. (5) An open design question, not a decided feature:
  whether to build a new module (or extend Personal Loans) for tracking money the user has LENT
  to OTHER people who repay via their own EMI-style schedule — "TRUE Wealth tracker should do
  that," per the user's own words. None of these are scoped/planned yet — per this file's
  standing "plan & propose" rule, each needs real clarifying questions (especially 2 and 5)
  before any code gets written.
- **Picked up 3 of the 5 deferred items above (2026-08-28) — see README Done item 217 for the
  full writeup.** Net Worth's Assets/Liabilities/Net stat-card trio was the one uncolored group
  on an otherwise fully-hued page (fixed with `hueStyle`, sign-based for Assets/Net, fixed loss
  tint for Liabilities matching EMI's own Outstanding convention); the "Assets vs. liabilities"
  chart's title was a full sentence getting mangled by the app-wide title-case CSS rule, fixed
  with a new `ChartCard.titleTooltip` prop (mirrors `StatCard.labelTitle`). Funds' Add-
  transaction form gained a 3-way-linked Amount field (NAV/Units/Amount, editing any one
  recomputes the third — same pattern as `RiskCalculator`'s Target price/shares/amount trio),
  with NAV auto-prefilled from the fund's own last known price. **EMI turned out to have 3 real
  bugs behind items 2's own listed symptoms, found by reading the live code rather than
  assuming**: `applyBigEmi` hardcoded its Big-EMI generator to start from `sum.elapsed + 1`
  ("remaining months only"), which for an old loan (this feature's actual primary use case)
  meant nearly every historical major interval was already before that point and silently
  skipped — fixed with a user-editable "Start from month #" field defaulting to 1. The Schedule
  table's pencil-edit button was gated `canEdit = r.month > sum.elapsed`, locking every PAST
  month from editing at all — backwards for a feature whose whole point is recording what
  actually happened; fixed by making every row editable, which also fixes "no option to link a
  past payment to a finance" as a free side effect (the link checkbox lives inside that same
  row). Checked `useLastTransferSource.ts` before assuming "1 default finance per EMI" was
  broken — it isn't: `entityKey()` only reads `.module`/`.ref`, ignoring the `emiMonth` field
  `loanSide` also carries, so the remembered finance already correctly spans every month of one
  loan. Also: saving a new loan now jumps straight into its own detail view in EDIT mode (Big
  EMI no longer needs elapsed history per the fix above, so this closes the "add form is
  missing these options" gap without duplicating Advanced's UI into the add-form itself). **Rule
  worth repeating**: three of these four EMI findings were real, previously-undiscovered bugs
  sitting underneath a user complaint that read, on its surface, like a request for a brand-new
  feature — reading the actual calc/UI code before assuming "not built yet" found root causes a
  guess would have missed entirely. Verified live via Playwright with a seeded 2024-started
  36-month loan matching the user's own described scenario (plot bought on installments) —
  "Start from month #" defaults to 1, a "Paid" (past) month shows a working pencil-edit + link
  checkbox, sign-in gate fires correctly on both Generate and Add loan. `npx tsc -b` / `npm run
  test` (442 tests, unchanged) / `npm run build` all clean. **Still genuinely open, not
  attempted**: a separate itemized "fine paid" field (today a fine just gets folded into that
  month's own `amount`, which works but isn't broken out separately — a real design decision,
  not guessed at); the new lending-to-others module question (item 5 above); the future
  Calendar widget.
- **User called out (2026-08-28, same day): the round above only chased surface symptoms and
  left the actual named asks undone — a fair criticism, worth remembering the shape of.**
  Three real gaps closed as a direct follow-up (README Done item 218 has the full writeup):
  (a) Big EMI now lives on the ADD-loan form itself, not just reachable-sooner on the edit
  form — computed via the same pure `generateBigEmiOverrides()`, set as `installmentOverrides`
  directly on the loan object at creation (no existing id/ledger needed at that point, so this
  is actually simpler than the edit-flow version). (b) `EMIRepayment` gained a real `fine?:
  number` field, deliberately kept OUT of `amount`/`installmentOverrides` so a penalty never
  distorts the loan's own balance/interest math — shown as a "+ X fine" note, editable from the
  Schedule table's pencil-edit row. (c) A second, more thorough Net Worth pass (reading the
  whole file against the 9 design rules, not a quick surface check) found a real rule-1
  violation the first pass missed: the cloud-sync-empty prompt wrapped its `Notice` in its own
  `Card`, inconsistent with the SAME file's own renewals-alert `Notice` rendered standalone —
  fixed to match. Deliberately did NOT touch the per-currency `<details className="card">`
  sections nesting `.stat-card.card` totals inside them, even though that looked like the same
  nested-card pattern at first glance — grepped EMI's `OverallSummary` first and found the
  identical structure already used there, an accepted cross-module convention, not a
  Net-Worth-specific gap. **Lesson worth repeating for any future "you didn't actually fix
  this" report**: a fix that only removes the loudest symptom (an old loan's stuck schedule)
  while leaving the literal thing asked for (options on the ADD form itself) unbuilt reads as
  "nothing happened" to the person who asked, even when real bugs did get fixed — match the
  literal ask, not just a workaround that produces a similar outcome. Verified live via
  Playwright: Add-loan form's Big EMI section renders/expands correctly, the Fine field is
  present and editable on the Schedule table, zero console errors on Net Worth post-fix. `npx
  tsc -b` / `npm run test` (442 tests, unchanged) / `npm run build` all clean. **Still open**:
  the lending-to-others module (see this session's own reply to the user for a concrete
  recommendation, not yet built pending their go-ahead) and the future Calendar widget.
- **User pushed back again ("verify last 3 PRs, they are ignoring what is asked for") — this
  time the right response was a real audit, not another apology-plus-small-fix cycle. See
  README Done item 219 for the full writeup; worth internalizing the METHOD here, since it's
  what actually found the bug the previous two rounds both missed.** Wrote a live Playwright
  script that checked, for every one of the 8 `LinkModule` pages, whether "Transfers" was
  reachable ON PAGE LOAD with zero extra navigation — the literal original ask ("add it to our
  FAB panel in the whole app," one button reachable everywhere) — rather than re-reading my own
  code and reassuring myself it looked right. **This found a real, confirmed gap**:
  Rentals/Personal Loans/Funds' landing pages only ever had "Add [entity]," with Transfers
  reachable only after drilling into a specific record's own detail view — genuinely
  contradicting the ask, not a misunderstanding of it. Fixed by giving their landing FABs the
  same 2-action shape Bank's/EMI's already correctly had. **A second, independently-real bug
  surfaced investigating the first**: QSE's and PSX's Transfers FAB — `position:fixed`, meant to
  float over the whole page — lived inside `TransfersSection`, which is `Tabs`/`CollapsibleCard`
  content that literally isn't mounted into the DOM until that specific tab (third in the list,
  not first) is expanded (`{open && <div>{children}</div>}`, not a CSS visibility toggle) — so
  the floating button silently didn't exist anywhere on the page by default. Fixed by lifting it
  to the page's own top level. **A third instance of the identical bug** (Funds' own per-section
  `FundsTransfersFab`, same "nested in a non-first tab" placement) turned out to be a pure
  duplicate of the just-fixed landing FAB (byte-identical `defaultFinance`) — deleted rather than
  relocated, since fixing both would leave two floating "+" buttons stacked in the same corner.
  **Lesson for any future "did I actually build what was asked" doubt, especially after being
  told directly that something isn't right**: don't re-read your own code for reassurance — write
  a script that exercises the literal, exact wording of the original ask ("reachable... in the
  whole app," "on load," etc.) against the live running app, across every instance the claim
  covers, not just the ones already spot-checked. A `grep` confirming a component is imported
  everywhere proves it EXISTS everywhere, not that it's actually REACHABLE everywhere — those are
  different claims, and this session's own earlier verification (Done items 216/217/218) had only
  ever checked the former. Rentals' own per-property `EntriesFab` has the same "nested in a
  non-first tab" placement and was deliberately left as-is (not purely redundant — it pre-fills a
  specific property, a real convenience the landing fix doesn't replace) — flagged as a known,
  lower-priority remainder, not silently dropped. Verified live via Playwright (twice, after the
  first broad script hit this sandbox's own dev-server/HMR flakiness under repeated sequential
  browser launches — confirmed unrelated to the code by isolating and re-running each check):
  all 8 modules now show a real, clickable Transfers control on first load, zero real console
  errors. `npx tsc -b` / `npm run test` (442 tests, unchanged) / `npm run build` all clean.
- **Critical, user-reported (2026-09-03): Funds "Net P/L" wrong after a withdrawal — see README
  Done item 220.** User attached a fresh full-app backup and said JCSLM's real Net P/L (~269
  PKR) was showing as only 30.97 PKR after withdrawals. Confirmed by seeding the exact uploaded
  `funds` slice: `FundsPage.tsx`'s "Net profit" stat cards all computed `value - invested`, where
  `Position.invested` (`computePositions()`) is only the cost basis of units STILL HELD — a sell/
  withdrawal shrinks `invested` right along with `shares`, so that formula only ever captured the
  *unrealized* gain on what's left, silently dropping every past withdrawal's own already-
  computed `realized` profit (`Position.realized`, sitting right there unused). Same shape as the
  bug class already documented above for Trade Planner double-counting and Rentals'
  from/to-sign exception — a value split across two fields where only one was being read. Fixed
  with `fundNetProfit(position, currentValue) = realized + (currentValue - invested)`, the exact
  `realizedPL + unrealizedPL` shape `cashSummary()`'s app-wide `netPL` already uses for the whole
  portfolio — Funds' own per-fund stat cards (3 call sites: `OverallSummary`, `FundList`,
  `FundDetail`) just never read `.realized` at all. Verified against the user's own real JCSLM
  transaction log (2 buys, 3 partial sells): old formula → 30.97 (matches what the user saw
  exactly); fixed formula → 268.66 (matches their expected ~269). New tests in
  `fundsModule.test.ts` pin these exact numbers as a regression. Verified live via Playwright
  with the user's real uploaded backup seeded into `localStorage` — fund list row and per-fund
  detail page both now show the correct ~269 figure. `npx tsc -b` / `npm run test` (445 tests, 3
  new) / `npm run build` all clean.
- **Shared `Finance`/`Category` base model for Cash/Bank/Rentals, user-requested (2026-09-03) —
  see README Done item 221.** This was a genuinely large, real-schema-touching request ("create
  1 base model and inherit all others from it... use categ ids, instead of texts"), handled per
  this file's own "plan & propose, get approval, then execute" standing rule — two rounds of
  `AskUserQuestion` up front resolved the real forks (scope: Cash/Bank/Rentals only, Exchanges/
  Funds/EMI/Personal Loans excluded as "fundamentally different"; categoryID stays required with
  an Uncategorized fallback; safe-merges-only category consolidation; `isLinked` as a plain
  boolean) before any code was written, followed by a design proposal the user then corrected on
  3 concrete points (`is`-prefix naming, "Credit Card Payment" not an abbreviation, editing moved
  into a popup) before building started.
  **Design decisions worth remembering for any future session touching these 3 types**:
  `types/finance.ts`'s `Finance` interface is a plain TS interface (structural inheritance via
  `extends`, not runtime OOP classes — this codebase has never used real classes anywhere).
  Bank's `amount` deliberately stays SIGNED (its running-ledger/credit-card-liability math
  already depends on the convention) with `isDeposit` re-derived from the sign at every store
  write — Cash/Rentals' `isDeposit` is the real authoritative field (their old `type` enum,
  1:1 renamed). `isLinked` is NEVER stored — always resolve it live via
  `isRecordLinked(module, id)` (`lib/linkCascade.ts`) at display time, since a persisted copy
  could silently go stale the moment a link is created/removed elsewhere.
  **The Category registry** (`lib/categories.ts`'s `DEFAULT_CATEGORIES`, `store/categoryStore.ts`,
  Firebase path `users/{uid}/categories`) is seeded from THIS app owner's own real historical
  category strings (26 real + Uncategorized) — flagged in that file's own comment as personal,
  not generic, data, worth reconsidering if this app ever serves more than one independent user.
  `findCategoryByName`/`categoryName`/`resolveLegacyCategoryId` in `lib/categories.ts`/
  `lib/financeMigration.ts` are the one place every category lookup/migration goes through —
  reuse them, don't re-derive.
  **Editing moved from inline table-row edits into a real popup** (`FinanceEditModal.tsx` +
  `CategorySelect.tsx`) in all 3 modules, directly closing the "editing UIs are missing fields"
  report — the old inline edit had quietly drifted out of sync with each module's own add flow
  (no time/timezone editing, free-text category instead of a picker). Also fixed the concrete
  "app puts a value instead of taking input" bug: `TransactionEntryModal.tsx`'s Bank rows had no
  description input at all, silently defaulting to the category text or the literal string
  "Transaction" — added a real required Description field.
  **A critical regression was found ONLY via live Playwright testing against the real uploaded
  backup — neither the type checker nor the first round of unit tests caught it, because every
  test fixture I wrote used the new `isDeposit` field directly rather than raw legacy JSON.**
  Removing `type: 'IN'|'OUT'`/`'RENT_INCOME'|'EXPENSE'` from the TS interfaces left no migration
  path for real pre-restructure data, which has `type` and NO `isDeposit` key at all — every
  existing "IN"/"RENT_INCOME" record silently evaluated `isDeposit` as `undefined` (falsy),
  rendering and behaving as OUT/EXPENSE everywhere. Caught by seeding the real 225-entry Cash
  backup and a synthetic Rentals property into a live browser: a real RENT_INCOME entry rendered
  as a red "Expense" with a negative amount. **Lesson worth repeating for any future field
  rename/removal on a type that has real, already-synced production data**: a TypeScript
  interface change has zero effect on data already sitting in localStorage/Firebase — always
  keep the old field as an explicitly `@deprecated`-marked optional fallback and write a real
  migration function, then verify by loading actual old-shaped JSON (not just new-shaped test
  fixtures) through the real store. Fixed with `resolveIsDeposit()` in
  `lib/financeMigration.ts`, wired into both `cashWorkbookStore.ts`'s and
  `rentalsWorkbookStore.ts`'s `withDerivedFields()`; verified the fix with an exact cross-check
  against the real data (82 rendered "Cash in" rows / 143 "Cash out" rows, matching the raw
  file's 82 IN / 143 OUT exactly) plus 2 new regression tests reproducing the bug directly by
  loading raw legacy-shaped objects with no `isDeposit` key. `npx tsc -b` / `npm run test` (466
  tests, 21 new) / `npm run build` all clean.
- **`BankAccount.isActive` — archive accounts, user-requested (2026-09-03) — see README Done
  item 222, the first slice of README Pending item 115(c).** Optional
  (`isActive?: boolean`, absent = active) — zero-migration, same as every other optional
  `BankAccount` field. Archiving only affects VISIBILITY, never a total: hidden from
  `AccountsList`'s default `EntityCard` grid (new "Show archived (N)" toggle + an "Archived"
  pill badge) and from every "pick where a NEW transaction/plan goes" picker
  (`SideFields`'s bank case in `TransferLinksPage.tsx`, Banking's own `useAccountPicker` for
  its Planning tab, EMI's "Link to bank" picker, Subscriptions' "Pays via" picker) — but
  `totalBalanceByCurrency`/`assetBalanceByCurrency`/Net Worth all keep counting an archived
  account's balance unchanged. **A real distinction worth remembering for any future "hide
  from pickers" feature**: a picker resolving an *already-linked* record's display name (EMI's
  `linkedAccount`, Subscriptions' `linkedLabel`) must read the FULL unfiltered account list —
  only the "choose a NEW target" picker filters — otherwise an already-archived-but-still-
  linked account would wrongly render as "a removed account." New Archive/Restore button
  (`ArchiveIcon`/`RestoreIcon`, new icons) on `AccountDetailPage`, grouped top-right next to
  Delete (rule 7) — reversible and non-destructive, so it only needs the standard sign-in gate,
  no confirm dialog. Verified live via Playwright: a seeded archived account is hidden by
  default and reappears with its badge under "Show archived"; Net Worth's total for a seeded
  Checking(1200 USD)+archived-Savings(450 USD) pair still read exactly 1,650 USD, confirming
  the "never touch a total" guarantee holds. `npx tsc -b` / `npm run test` (466 tests,
  unchanged) / `npm run build` all clean.

## Redesign decision (2026-08-27): staying in this repo, no fork/no new codebase

**Locked, final decision — read this before touching anything below.** The user floated a
genuine question ("maybe we develop this as a fresh 'MoneyTracer' codebase in a new folder/
new GitHub repo, since the current themes/density/font system is fundamentally shallow — 'same
jokers in different color costumes'") and then explicitly closed it out themselves: *"I know
rename app is no effort. i just proposed new codebase to let this app work without any issues.
If redesigning is safe, no need to go for new efforts. we will work with this same repo."*
**No fork. No new repo. No new codebase folder.** Every redesign step below happens in place,
in this same `FinaceMaster`/`FinanceRecorder` repo, on real production data, under this file's
existing cloud-sync-safety and "commit into main directly / verify before every commit"
standing rules. A cosmetic rename/rebrand (e.g. to "MoneyTracer") remains cheap to do LATER,
once the redesign has actually landed and stabilized — it is not a prerequisite and nobody has
asked for it yet; don't preemptively rename anything.

**A NEW standing workflow rule was set the same day, superseding blanket autonomy for
anything with real design ambiguity** (verbatim): *"you will plan & propose me the changes.
After my approval you will continue your work until all done."* In practice: for a change with
genuine scope/design ambiguity, write the concrete plan and get explicit approval BEFORE
touching any file; once approved, execute the whole approved plan to completion without
re-asking at each step (the original full-autonomy instruction still applies for execution
once a plan is approved); flag only NEW ambiguity that surfaces mid-build. A single, narrow,
already-agreed task doesn't need its own fresh planning round — this rule is about not guessing
on open design questions, not about re-approving already-scoped work.

## App-wide UI/UX redesign — the Main/Often/Rare model + 9 design rules (2026-08-27)

**This is the active, top-priority redesign initiative for the whole app — Phase 1 (shared
foundation) and a full Banking pilot are DONE as of 2026-08-27; see the "Progress" note below
before assuming anything here is unstarted.** The user gave this as a full reframing after a
long back-and-forth about scattered nav/footer content ("plenty of stuff down there like
import/export, synced status, disclaimer... side + top chips menu is also scattered... use
arrow signs for open/collapsed status") — rather than patch those individually, redesign around
one content model applied everywhere. **Explicit instruction: "Audit this app page by page and
update the app as per guidance."** A future session should treat rolling this out to the
remaining modules as the standing top-of-backlog item, ahead of the numbered README Pending
list, until it's done or the user redirects.

### The Main/Often/Rare content model (user's own definitions, verbatim — do not paraphrase
away the distinctions)

- **Main** (frequent data — lives directly on the module's landing page): stats, charts, Entity
  items as CARDS rather than long tables with custom reordering options, FAB(+) + popups for
  adding a single or a batch of new transactions, and any other relevant frequent
  data/components.
- **Often** (used sometimes, not every visit — reached via a FAB or a light click, never
  permanently on-screen): FAB + popup for adding a new Entity Item (a Bank account, an EMI
  loan, a Rental property, etc. — the "rare to create, but you do look at the list often"
  layer). Clicking an existing item opens its own detail view, READ-ONLY by default with an
  Edit icon to switch into editing. **The detail view must show every single attribute of that
  entity, every transaction, every chart — nothing may be dropped in the move.**
- **Rare** (settings-shaped, visited occasionally): Account, general & per-module settings,
  backup & recovery, disclaimers, T&C, privacy policy links — all living under one Settings
  submenu, not scattered across page footers/toolbars.

### Entity-detail decision (resolved, locked)

Asked whether "Often" tier entity detail should be a popup or a dedicated page — user's answer:
**a dedicated PAGE is fine, even preferred**, explicitly because it matches the pattern
Portfolio's own per-stock detail already uses (`/stock/:ticker`, `/psx/stock/:ticker`) — no
need to force everything into a popup. The one hard constraint, repeated for emphasis by the
user: **the detail page must show every attribute the entity has — none may be silently
dropped when migrating a module's existing modal (e.g. Banking's `AccountDetailPage`, Rentals'
`PropertyDetailModal`) into this pattern.**

### The 9 UI design rules (verbatim, apply to every page as the redesign reaches it)

1. Never use nested cards (a card whose only child is another card with its own border/shadow
   — already partially fixed once, Done item 114/Pending item 90, but treat as a standing rule
   for all new/touched UI, not just that one historical fix).
2. Leave good vertical space between UI components.
3. Use wrap flex grids instead of shrinking UI to fit.
4. Use lighter shadows to make UI less dense.
5. Stat cards should have concrete, solid-color backgrounds with clear (unvague) boundaries and
   only a little gradient effect — note this directly informs Done item 194's already-shipped
   7%→24% `--card-hue` bump; keep that direction, don't re-soften it.
6. Arrange UI/form components vertically rather than spreading across the full page width.
7. Action buttons belong at the top-right corner of their card/section, grouped together
   adjacent to each other — not scattered inconsistently across a page (this is the existing
   `headerExtra`/`IconButton` pattern from Done items 121/113/196 — the rule now is to finish
   applying it everywhere, not invent a new mechanism).
8. Move descriptions/explanatory text into tooltips rather than permanent on-page paragraphs —
   they make the UI dense and cluttered (same direction as the existing `Tooltip` rollout, Done
   items 85/89/105/140/144/169 — again, keep applying, don't reinvent).
9. Charts should share a consistent size/height across the app (the existing
   `.chart-canvas-wrap` cap from Done item 181 is a start, audit for stragglers), and should NOT
   always force the Y-axis to start at 0 — use a relative/appropriate scale instead so real
   variation is visible (this is a reversal of the OPPOSITE historical fix in Done item 138,
   which forced `autoSkip:false` on a category axis, not a value-axis zero-baseline — those are
   different concerns, don't confuse them; check `ChartJS.defaults` and each chart's own
   `scales.y.beginAtZero` before changing anything).

### Other standing rules from the same conversation, still to apply app-wide

- **"Relevant info should be present in one place rather than sifting through UI puzzle
  pieces."** A general instruction to consolidate, not a specific page — apply it as each page
  gets touched during the audit.
- **"Each financial module should have the right to create, see, or update its own
  transactions. Link it with other financial entities rather than going to a [separate]
  page just to link itself with others."** This means every module should be able to do inline
  cross-entity linking from its own native add/edit flow, not just via the standalone
  `/transfers` page. **Before building anything here: audit what's already done.** Per this
  file's own existing history, most modules likely already have exactly this (QSE/PSX Done
  item 125, Rentals/Personal Loans/Funds Done item 131, EMI Done item 162) — verify against the
  live code module-by-module and only build what's genuinely still missing, rather than
  assuming a rebuild is needed.
- **Credit card as its own normalized entity, linked to a Bank; Bank/Branch/Account-type
  become real normalized reference data.** Currently: a credit card is modeled as
  `BankAccount.isLiability=true` (Done item 175) with `bankName`/`branch`/`accountType` as
  free-text fields with a suggestion datalist (Done items 82/171) — the user wants this
  upgraded to real, structured entities: a `Bank` (with its own `Branch` list) that both bank
  accounts AND credit cards point to, and `CreditCard` split out as a genuinely distinct record
  type belonging to (linked to) one bank. **This is flagged as the single highest-risk piece of
  the whole redesign** — real production data (the user's actual imported GCC/PCC credit-card-
  as-liability-account records from the big real-data import, Done item 178) is at stake. A
  migration for this must, at minimum: (a) design the new `Bank`/`Branch`/`CreditCard` types
  first and get them reviewed/approved per the new plan-and-propose rule before writing any
  migration code; (b) write a one-time, idempotent conversion from any existing
  `isLiability: true` `BankAccount` into a real linked `CreditCard` record, preserving every
  transaction and the account's own running balance calculation unchanged; (c) verify the
  migration against a REAL copy of the user's actual data (the same discipline already
  established for the Excel/RTDB import work, Done items 178-180) before it ever runs against
  the user's real signed-in account; (d) keep `computeNetWorthByCurrency`'s existing
  `assetBalanceByCurrency`/`creditCardLiabilityByCurrency` split (Done item 175) working
  correctly post-migration — a credit card must keep counting as a liability, never flip to
  being silently double-counted or dropped.

### Progress (2026-08-27) — Phase 1 + Banking pilot DONE, see README Done item 213 for the full
write-up. Read this before assuming any of the below is still "not started."

- **Phase 1 shared foundation, done**: `--shadow-card`/`--shadow-lg` lightened (rule 4);
  `Tabs`' inter-section spacing bumped 12px→20px (rule 2); new `.entity-card-grid`/
  `.entity-card` CSS + a shared `EntityCard` component (`components/Card.tsx`) for "Main tier:
  entity items as cards, not tables" (rule 1/3); rule 9's "no forced zero baseline" was already
  satisfied app-wide (confirmed via grep — no `beginAtZero`/`min:0` anywhere, `ChartJS.defaults
  .scales.linear.grace` already auto-pads), no code change needed there. New global **Account
  hub** at `/account` (`features/account/pages/AccountPage.tsx`) — Profile (new shared
  `components/ProfileEditor.tsx`, deduplicating what used to be two byte-identical copies in
  QSE's/PSX's SettingsPage.tsx), Security (sign-in method summary from `user.providerData`,
  Sign out, a new "Switch account" flow — this settles the Security-scope question below),
  Sync status (reuses `SyncStatusIndicator`), Appearance (new shared `AppearanceFields`,
  extracted from `AppearancePanel.tsx` so the sidebar popover and this page share one
  implementation), a Data card linking to `/app-data`, and a Disclaimer link. Sidebar's
  "Signed in as X" now correctly points at `/account` (the mislink bug is fixed); the footer's
  permanent disclaimer paragraph, "Backup/restore" link, and sync-status popover all moved into
  the hub, leaving just the account row + a compact "© year · Legal" line.
- **Banking pilot, done, full Main/Often/Rare pass**: `AccountsList` rewritten from a sortable
  table to an `EntityCard` grid (still grouped by currency — the sortable-column header does
  NOT carry over on purpose, rule 1 explicitly asks for cards instead of a table with its own
  reorder controls). `AccountDetailPage`'s "Account details" section converted to true
  **read-only + Edit icon** (new shared `components/ui/AttributeList.tsx` — skips attributes
  with no value, shows every populated one). Stray permanent paragraphs converted to
  `Tooltip`s (rule 8). Settings tab now links to `/account` for the global stuff, keeping only
  Banking-specific content (its own cloud-sync-empty upload affordance, its own JSON export/
  import/clear). Verified live via Playwright + real screenshots — see README Done item 213.
- **Confirmed via `AskUserQuestion` before starting** (both questions below are now settled,
  not still open): pilot module = **Banking**; Settings hub's **Security section = sign-in
  summary only** (no new account-security feature — exactly what got built); the older
  `?section=`-URL-param sidebar-children idea is **dropped, superseded** by the Main/Often/Rare
  model — do not build it.

### Still-open / unconfirmed (genuinely open — ask, don't guess)

- **"Defaults" scope** (mentioned in the very first nav-redesign message, "Import/Export...
  signs ins, security, defaults, all at one place") — still unclear what "defaults" refers to.
  My own standing proposal (never confirmed): fold it into Appearance only, since this app's
  own locked design deliberately keeps currency per-module/per-entity, not a single global
  default currency (no live FX source to convert against) — needs the user's explicit sign-off
  before treating this as settled.

### Suggested phased execution order for whichever session picks this up next

1. This documentation (done) — a stable design reference so the rules don't have to be
   re-derived or re-asked for every time.
2. Shared mechanics (done — see "Progress" above): `EntityCard`, the `/account` hub,
   `AttributeList`, the lightened-shadow/spacing CSS tokens.
3. The Banking pilot (done — see "Progress" above), verified live via Playwright before
   rolling out further — this project's own repeated lesson (see the many "measure before
   fixing"/"verify live" notes throughout this file) is that a pattern that looks right in
   isolation can still have real, only-visible-when-tested gaps.
4. **Next up**: roll out to the rest of the modules (Cash, Personal Loans, EMI/Loans, Funds,
   Rentals, Subscriptions, QSE/PSX's own entity-ish lists if any apply, Transfers, Planning,
   Budget Planner, Net Worth) one at a time, in the same incremental, verify-before-commit
   style this whole project has followed throughout — do not attempt a single giant
   all-modules-at-once change. Each module's own "Settings" tab should link to `/account` for
   the global bits, same as Banking's now does. Also worth doing per-module: audit (don't
   blindly rebuild) whether that module already has inline cross-entity linking from its own
   native add/edit flow — most do (Done items 125/131/156) — before assuming it needs building.
5. The Credit-card/Bank-normalization migration is its own separate, higher-risk track — do
   not bundle it into the same PR/session as the general UI reshuffle; it touches real stored
   financial data and needs its own focused review.

## Redesign progress update (2026-08-27) — large real-usage critique of the Banking pilot

The user tested the Phase-1/Banking-pilot work above live, with real imported data (UBL, GCC
Card, QIB Misk), and reported it back as "ridiculous... pure mess" with a long, specific list.
**Most of it is fixed — see README Done item 214 for the full accounting.** Highlights: two
real app-wide CSS bugs found and fixed (the `.row > *{min-width:140px}` rule was stretching the
Modal's circular close button into an oval; `.row > *{flex:1}` was ignoring every field's own
`width` prop and dividing row width evenly among children — root cause of "input sizes
inconsistent, taking whole 100% width"); the sidebar's "Signed in as [name]" rebuilt as a
strict single line (was wrapping 3 lines); a new shared `FabButton` (`components/ui/Fab.tsx`)
replacing 9 duplicated FAB implementations, now with a real hover/press animation; stat cards
switched from a fading diagonal gradient to a solid fill + one small radial highlight, borders
removed; the Modal background switched off flat `--panel` (pure white) to the same tinted
gradient `.card` uses; the standalone "Transactions" and "Import statement" tabs (each with
their own account-picker `<select>`) were DELETED — both were the exact "don't ask the user to
pick an entity on the module homepage" anti-pattern the user called out, and both were fully
redundant with `AccountDetailPage`; the Settings tab's nested "Account"/"Data management" cards
were un-cardified into plain sub-sections (no card-in-card left on that tab); Banking's
homepage entity cards lost Edit/Delete (moved to the detail page, Delete now a real `.btn.danger`
button); and a new inline "link this transaction to another module" flow was added to Bank's own
add-transaction flow (Bank was the one module missing the reverse of the "link to Bank/Cash"
shortcut every other module already had — reused the exact same `createLinkedTransfer` engine,
just exported `SideFields`/`useSideCurrency` out of the standalone Transfers page instead of
duplicating them).

**Explicitly NOT built this round, flagged rather than guessed at — see README Pending item
115 for the full writeup, read it before starting any of this:**
1. **Bank as a normalized parent entity, multiple accounts per bank.** The user's own words:
   "A bank is main entity... add bank first and then on its details page, give ability to add
   extra accounts... see the total balance with that bank." This is real schema surgery on the
   user's actual live imported accounts (UBL, GCC, PCC, QIB Misk, etc.) — needs a proposed
   `Bank`/`Branch` type design CONFIRMED with the user before any migration code is written,
   same "ask before touching real financial data structure" discipline this file already
   applies to the still-pending Credit Card normalization (see the "App-wide UI/UX redesign"
   section above) — these two migrations likely overlap (a `Bank` entity that both plain
   accounts and credit cards belong to) and may end up designed together, not as two separate
   passes.
2. **The same parent-entity pattern for Funds/brokerages** — "I have 4 brokerage... i want to
   see my amounts with each broker... and overall sums" — mirrors (1)'s design once settled.
3. **Entity active/inactive + favorite + a visible Sr#/Index#**, across Bank/Funds/Personal
   Loans/EMI/Rentals/Subscriptions — additive fields, not a restructuring, so lower-risk than
   (1)/(2) and a reasonable concrete next step. Not yet built.
4. Bank's own Analytics tab was never audited against the date-range-filterable chart pattern
   other Analytics pages already have.

A future session picking this up should read README Pending item 115's own text (kept in sync
with this note) before starting, and should propose the `Bank`/`Broker` entity design and get
it confirmed before writing any migration code — per this project's own standing plan-and-
propose rule for exactly this class of change.

## Redesign progress update (2026-08-28) — second real-usage critique, all fixed same day

The user tested live again and posted a real screenshot showing a tooltip rendering nowhere
near its trigger (measured via Playwright before fixing: ~690px/230px off), plus a fresh
9-item list. **All fixed same day — see README Done item 215 for the full accounting.**
Highlights: the tooltip bug's real root cause was CSS, not the position math — `.entity-card:
hover{transform:translateY(-2px)}` (the hover-lift animation from the previous round) makes the
hovered card establish a new containing block for any `position:fixed` descendant per the CSS
spec, so `Tooltip.tsx` now portals its popup straight to `document.body`; "linking should be a
part of the transaction, not a separate card" was fixed by merging the standalone
`LinkTransactionSection` card into `AddTransactionsForm` itself as an inline "Transferred to or
from another module" checkbox; "Link To always shows USD" was a real gap — Cash had no currency
picker at all in `SideFields`, only ever fell back to a hardcoded `'USD'` in
`buildSideRecord` — fixed with a real `<Select>` there; "Account details buried in middle" was
fixed by reordering `AccountDetailPage`; "Make Create/Edit form same, it's a loophole" turned
out to be a REAL regression (not just cosmetic) — the prior round's move of Edit onto the
detail page never carried Name/Currency/Opening-balance into that edit form's draft state, so
those three fields had become completely uneditable on an existing account — fixed with a new
shared `AccountFormFields` component used by both Add and Edit so they structurally can't
diverge again; "use grids... small side by side cards" got a new `.detail-grid` CSS class
wrapping Account details/Upcoming plans/By category; the "nested cards (Analytics -> carded
charts)" complaint was fixed with a new `flat` prop on `ChartCard` (renders just a heading +
chart, no `CollapsibleCard` chrome) applied to Banking's 3 Analytics charts, since `Tabs`
already wraps every tab's content in its own `CollapsibleCard` — a `ChartCard` inside it was a
genuine card-inside-a-card. **The biggest single item turned out to be app-wide, not
Banking-specific**: "Settings & 'Plans — account Synced...' still present... clearly mentioned
multiple times to move into single page" — grepped the whole codebase for the pattern and found
the identical redundant sync-status-text card duplicated in literally every module (Cash,
Personal Loans, Rentals, Funds, EMI, Subscriptions, Transfers, Net Worth, QSE/PSX Settings), not
just Banking. Fixed once per module: the card now renders nothing at all unless there's an
actual cloud-empty upload prompt, and every module with a Settings tab gained the same "...live
on the Account page →" link Banking already had. **Lesson reinforced (this is at least the
third time this exact shape of gap has shown up in this project)**: when a user's complaint
sounds like it's about one page, grep for the underlying pattern across the whole app before
declaring the fix done — a fix applied to only the reported instance, while real sibling
instances of the identical bug sit elsewhere untouched, is exactly what re-triggers the same
complaint in a later round. Verified live via Playwright across all 14 routed pages in the
app — zero new console errors anywhere. `npx tsc -b` / `npm run test` (442 tests, unchanged) /
`npm run build` all clean. **Still open, unchanged from the round before**: README Pending item
115's four structural items (Bank-as-parent-entity, Funds/broker-as-parent-entity, entity
active/favorite/Sr#, Bank's Analytics date-range filtering) — none of this round's fixes
touched those.

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
