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
