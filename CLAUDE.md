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
- **PSX module: calc engine + store + types only, no UI yet.** See
  `webapp/src/lib/calc/psxFees.ts` (itemized commission/SST/PSX/NCCPL/SECP/
  CDC/CVT fees, same-day trade netting, CGT filer/non-filer rates — this
  already fixes README bugs items 5/6/7), `webapp/src/types/psxWorkbook.ts`,
  `webapp/src/store/psxWorkbookStore.ts`,
  `webapp/src/lib/firebase/usePSXFirebaseSync.ts`. **Next task: build PSX's
  pages** mirroring `webapp/src/features/qse/` structure, plus an exchange
  switcher in the nav (Stocks → QSE/PSX), then eventually restructure routes
  to something like `/stocks/:exchange/...` so mutual funds / banking / cash
  / property can slot in as sibling top-level domains later.
- **Legacy static apps** (`index.html` = QSE, `PSX_Trade_Planner.html`,
  `Risk_Analysis_Calculator.html`) still live unchanged at the repo root and
  still deploy — **do not delete these** until PSX reaches parity and the
  user explicitly approves a cutover.

## Live URLs

- New React app (QSE): **https://ranamrameez.github.io/FinaceMaster/webapp/**
- Legacy apps (still authoritative for PSX/Risk Analysis for now):
  **https://ranamrameez.github.io/FinaceMaster/**

## Repo layout

```
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
  src/features/qse/         QSE-specific pages/components/hooks — mirror this structure for
                            src/features/psx/ when building PSX's UI
  src/components/           shared UI: Modal, ConfirmDialog, SignInModal, Sparkline, Tabs, Sidebar, etc.
  src/types/workbook.ts     QSE types; psxWorkbook.ts has PSX's parallel types
.github/workflows/static.yml   CI: builds webapp/ and deploys it to /webapp/ alongside the legacy
                                root files (see Deployment below — this had a real bug, now fixed)
```

## Design decisions worth knowing before you change anything

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
(`webapp/src/lib/calc/__tests__/fixtures/`) — that copy is pinned to
specific hand-verified expected values in `calc.test.ts`; don't casually
overwrite it when refreshing the root backup file, or the tests will need
their expected values recomputed too.

## Firebase

Same Firebase project (`qse-app`) and RTDB paths as the legacy apps are
reused deliberately, so existing users' cloud data loads unchanged:
`users/{uid}/workbook` (QSE), `users/{uid}/psx` (PSX, not wired to UI yet),
`users/{uid}/profile` (display name + emoji avatar). There's also a shared
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
