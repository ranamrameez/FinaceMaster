# New Modules Plan: Funds, Banking, Cash, Rentals, EMI/Loans, Personal Loans

Design/proposal document for the modules beyond Stock Exchanges (QSE + PSX) that make up
FinanceRecorder's full vision (see `README.md`'s Migration Plan Overview and `CLAUDE.md`'s
"What this project is"). **Per a 2026-08-23 sequencing decision, none of these get built
until the Stock Exchanges module is considered finished** — this doc exists so that work
can start from a real design instead of a blank page once that time comes, not as an
invitation to start now. Update this doc as decisions change; it's a plan, not a spec
frozen in time.

Two modules were added to the original four (2026-08-23) after reviewing a user-supplied
reference prototype covering an overlapping but not identical feature set — see
[`reference/finance-suite-prototype/`](reference/finance-suite-prototype/NOTE.md) for that
prototype itself and what was/wasn't worth taking from it. **EMI/Loans** (structured
repayment schedules) and **Personal Loans** (informal, bidirectional debt) turned out to be
genuinely distinct concepts from Banking/Cash, not naturally folded into either.

## Cross-cutting decisions that already apply to all four modules

These are locked in already (see `CLAUDE.md`'s "Design decisions" section) and apply to
every module below, not just Stock Exchanges:

- **No live third-party API calls, ever, from the app itself.** Any external data (bank
  feeds, fund NAVs, property valuations) gets fetched by a scheduled job into our own
  database, never live per-request.
- **No bank account API / open-banking integration.** SBP (Pakistan) and QCB (Qatar) both
  require regulator licensing for that — a business/compliance process, not engineering.
  Primary data-entry path for Banking (and Cash) is **manual entry + statement upload with
  parsing** (PDF/CSV → transactions). SMS/email alert parsing is an optional, later,
  additive input source layered on the same transaction model — not a v1 requirement, and
  not something to design the core model around.
- **A "transaction" doesn't care about its source.** Manual entry, a parsed statement row,
  or (far later) a live feed should all produce the same shape of record, distinguished only
  by a `source` field. This is the same principle already used for QSE/PSX's `Transaction`
  type and should extend to every new module's transaction-like records.
- **Reuse the existing generic factories, don't hand-roll new ones.** `createWorkbookStore`
  (`webapp/src/store/createWorkbookStore.ts`) is already a generic "local-first,
  cloud-synced" store factory parametrized by a `BaseWorkbook<TSettings>` shape; same for
  `useWorkbookCloudSync` (per-exchange Firebase sync). Each new module should get its own
  `<Module>Workbook` type and its own store instance from the same factories, exactly like
  QSE and PSX do today — not a third bespoke state-management pattern.
- **Firebase path convention**: `users/{uid}/<module>` (e.g. `users/{uid}/cash`,
  `users/{uid}/bank`, `users/{uid}/funds`, `users/{uid}/rentals`), matching the existing
  `users/{uid}/workbook` (QSE) and `users/{uid}/psx` paths.
- **Cloud sync safety rule is non-negotiable for every module**: never write to the cloud
  based on an assumption of emptiness. Reuse `useWorkbookCloudSync` as-is; it already
  enforces this.
- **Every entry must be editable, not just add/delete (locked 2026-08-23).** The reference
  prototype in `reference/finance-suite-prototype/` only supports add/delete on every single
  entity — a typo means losing the record and recreating it. FinanceRecorder's own QSE/PSX
  Transactions already do this right (an inline edit-row, same pattern used throughout this
  codebase); Transfers/Adjustments/Dividends/Watchlist had the same add/delete-only gap and
  were fixed for exactly this reason (2026-08-23). Every new module's every record type
  (transactions, entries, balances, repayments, schedules) must ship with edit from day one,
  matching that same inline edit-row UX — not deferred to a "v2 polish" pass.
- **User-definable categories, not a fixed enum (locked 2026-08-23).** Anywhere a module has
  a "category" concept (Cash entries, Bank transactions, Rental expenses), the field must be
  a free-form user-editable string (with autocomplete/datalist over categories the user has
  already typed, for convenience — not a hardcoded dropdown list). The reference prototype's
  `EXPENSE_CATEGORIES` is a hardcoded array with no way to add a custom one — don't repeat
  that. The category sketches below already use `category?: string` for this reason; treat
  that as a requirement, not an implementation detail that's free to change later.
- **Per-entity currency, not per-module (revised 2026-08-23).** Every fund/loan/expense/
  property *entry* should carry its own `currencyCode`, not just one currency per module
  setting — the target user base (US/EU/GCC/Pakistan) plausibly holds, say, a Funds
  portfolio spanning USD and SAR at once. Any view that aggregates across entities (module
  totals, dashboard net worth) groups amounts by currency and shows one figure per currency
  present — **never a fake blended conversion**; there's no live, auditable FX-rate source
  in v1 (matching the existing "no live third-party API calls" rule above), so a single
  converted total would just be wrong. See `reference/finance-suite-prototype/NOTE.md` for
  the `sumByCurrency`/`mergeCurrencyMaps` grouping pattern this is based on. This revises the
  module sketches below, which had settled for one `currency` per module — update each to a
  per-entity `currencyCode` field when actually building it.

## Suggested build order

Simplest and most self-contained first, each one a smaller step than the last render it
riskier to get wrong:

1. **Cash** — ✅ built 2026-08-23. A single running ledger, no external data source,
   smallest possible module. Good first exercise in generalizing the workbook factories
   beyond stock exchanges (see §1 below for what that generalization actually required).
2. **Personal Loans** — ✅ built 2026-08-23. Almost as simple as Cash (principal +
   repayments, no schedule math), a good second exercise before tackling real calculation
   logic — also where a real zustand selector bug was hit and fixed (see §6 below).
3. **Banking** — ✅ built 2026-08-23. Builds directly on Cash's ledger concept, adds
   multiple accounts and CSV statement import (the first real use of the "manual entry +
   statement parsing" pattern).
4. **EMI / Loans** — ✅ built 2026-08-23. Introduces real calculation (amortization
   schedule) but no market-price dependency — a good bridge before Funds' XIRR/cost-basis
   complexity.
5. **Funds** (mutual funds) — ✅ built 2026-08-23. Structurally closest to QSE/PSX (buy/sell
   units, a "price" equivalent in NAV-per-unit, cost basis, P/L, XIRR) — most reuse of the
   existing calc engine (genuinely reused the full `createWorkbookStore` factory, unlike
   every other new module), but was also the most calculation-heavy of the six.
6. **Rentals** — ✅ built 2026-08-23. The most different shape (recurring income/expense on
   a property, not discrete buy/sell trades) — done last since it borrowed the least from
   existing code. All six modules are now built.

This is a suggestion, not a mandate — reorder freely if priorities change.

---

## 1. Cash — ✅ built 2026-08-23

**Purpose**: track physical/informal cash holdings (cash in hand, cash gifts, small
informal loans) that don't live in a bank account or brokerage — the simplest module,
closer to a manual ledger than anything else.

**Built as designed below, with one real architecture change worth knowing**:
`createWorkbookStore` (the stock-exchange factory) turned out not to be genuine reuse for
a single-array module — its CRUD actions (`addTransaction`, `addTransfer`, ...) are all
trade-specific and Cash needs none of them, so forcing Cash's shape through
`BaseWorkbook<TSettings>` would mean carrying a pile of irrelevant empty arrays just to
satisfy the type. Built a smaller sibling factory instead:
`webapp/src/store/createEntryStore.ts` (`BaseEntryWorkbook<TSettings, TEntry>` = just
`{ settings, entries }`, with generic `addEntry`/`updateEntry`/`deleteEntry`/
`updateSettings`). `useWorkbookCloudSync` (`lib/firebase/useWorkbookCloudSync.ts`) was
generalized to match — it only ever touched `workbook`/`setWorkbook` at runtime anyway, so
its type constraint was relaxed from the full `WorkbookStoreState` to a minimal
`{ workbook, setWorkbook }` interface, letting both factories' stores share the exact same
sync hook (same safety guarantees, one implementation) instead of writing a second one.
Files: `types/cashWorkbook.ts`, `store/{createEntryStore,defaultCashWorkbook,
cashWorkbookStore}.ts`, `lib/firebase/useCashFirebaseSync.ts`,
`lib/calc/cashModule.ts` (+ tests), `features/cash/pages/CashPage.tsx`, route `/cash`. Nav
entry is a minimal "More → Cash" link in the Sidebar for now (see README item 18 — the real
category-dropdown redesign is still pending and will replace this placeholder).

**Data model**:
```ts
interface CashEntry {
  date: string;
  type: 'IN' | 'OUT';
  amount: number;
  currencyCode: string; // per-entry, not per-module — see the cross-cutting decision above
  category?: string;    // free-form, user-definable — e.g. "gift", "misc" (not a fixed enum)
  note?: string;
  source: 'manual';     // only source for v1 — no statement to parse for physical cash
}
interface CashWorkbook {
  settings: { defaultCurrency: string }; // pre-fills new entries only, never converts
  entries: CashEntry[];
}
```

**v1 features**: add/edit/delete entries, running balance, simple category breakdown,
export/import JSON (same pattern as QSE/PSX Settings → Data management).

**Explicitly out of scope for v1**: categorization rules/auto-tagging, multi-currency
conversion (single `currency` setting is enough to start), budgets/spending limits.

---

## 2. Banking — ✅ built 2026-08-23

**Purpose**: bank account balances and transaction history (deposits, withdrawals, card
spending), entered manually or imported from a statement — no live bank API (locked
decision above).

**Built as designed below.** Third module, hand-written store (accounts nested under
`settings`, plus a top-level `transactions` array — a third distinct shape from Cash's
single array and Personal Loans' two top-level arrays), same idiom as the other two.
CSV import was NOT deferred — built as specified: a lightweight custom parser
(`lib/csv.ts`, handles quoted fields/escaped quotes/CRLF, no external dependency) plus a
column-mapping UI (pick which detected header is Date/Description/Amount, optional "flip
sign" toggle for banks that export spending as positive numbers) and a 5-row preview before
committing. Files: `types/bankWorkbook.ts`, `store/{bankWorkbookStore,
defaultBankWorkbook}.ts`, `lib/firebase/useBankFirebaseSync.ts`, `lib/calc/bankModule.ts` +
`lib/csv.ts` (+ tests for both), `features/bank/pages/BankPage.tsx` (Accounts/Transactions/
Import statement/Settings tabs), route `/bank`, nav under "More" in the Sidebar. Followed
the zustand-selector rule from §6 throughout (checked explicitly before shipping — every
selector in `BankPage.tsx` is a raw property accessor; derived values like known-categories
are computed in `useMemo`, never inside the selector).

**Data model**:
```ts
interface BankAccount {
  id: string;
  name: string;          // "Meezan Checking", "QNB Savings"
  currencyCode: string;  // an account has one currency (real-world bank accounts do)
  openingBalance: number;
}
interface BankTransaction {
  id: string;
  accountId: string;     // currency is implied by the account, not repeated per-transaction
  date: string;
  amount: number;        // signed: negative = debit, positive = credit
  description: string;
  category?: string;     // free-form, user-definable — "groceries", "salary", ... (not a fixed enum)
  source: 'manual' | 'statement-import';
  statementRef?: string; // which imported statement this row came from, for traceability
}
interface BankWorkbook {
  settings: { accounts: BankAccount[] };
  transactions: BankTransaction[];
}
```

**v1 features**: multiple accounts, manual transaction entry (multi-row form, same UX
pattern as QSE/PSX Transactions), running balance per account, category breakdown/spending
by category chart, CSV statement import mapped to `BankTransaction[]` with a
column-mapping step (bank CSV exports vary widely — a simple "map these columns" UI, not a
per-bank-format hardcoded parser).

**v2 candidate**: PDF statement import (text extraction + heuristic row parsing — harder
than CSV, do CSV first and validate the transaction model before tackling PDFs). SMS/email
alert parsing (explicitly deferred, additive-only, per the locked decision above).

**Explicitly out of scope for v1**: any live bank API/open-banking connection (locked
decision), automatic categorization via ML/rules (manual category field is enough to
start), multi-user/shared accounts.

---

## 3. Funds (mutual funds) — ✅ built 2026-08-23

**Purpose**: track mutual fund unit holdings and performance — structurally the closest of
the four to QSE/PSX (a "buy N units at NAV X" is the same shape as "buy N shares at price
X"), so this module should reuse the calc engine most directly.

**Built as designed below — this is the one module that could genuinely reuse the full
`createWorkbookStore` factory** (not `createEntryStore`, and not a hand-written store),
because a `Fund.id` playing the role of `ticker` in `Transaction` records makes
`computePositions`/`cashSummary`/`computeRealizedPLTimeSeries`/`marketPrices`/
`priceHistory`/`getMarketPrice` all work completely unmodified — genuinely zero changes to
any shared calc file. `FundsWorkbook extends BaseWorkbook<FundsSettings>` plus its own
`funds: Fund[]` array; Fund CRUD (unlike Transaction CRUD) has no dedicated store action
since the factory doesn't know about that extra field, so the Funds page mutates it via the
store's already-generic `setWorkbook`. `transfers`/`watchlist`/`dividends`/`tradePlans`
inherited from `BaseWorkbook` are unused (no UI for them) — an accepted, documented tradeoff
for genuine reuse over a parallel type. No fee model (`calcFee` is a no-op — NAV is already
net of fund fees). XIRR was ported to a new `lib/calc/xirr.ts` (Newton-Raphson + bisection
fallback, hand-traced in tests including an exact-10%-return case and null-for-same-sign-
flows). Files: `types/fundsWorkbook.ts`, `store/{fundsWorkbookStore,
defaultFundsWorkbook}.ts`, `lib/firebase/useFundsFirebaseSync.ts`,
`features/funds/hooks/useFundsDerived.ts`, `features/funds/pages/FundsPage.tsx`, route
`/funds`, nav under "More". Verified live in a fresh browser tab against the reference
prototype's own worked example (two buys, $5000+$2000 invested, NAV rising to $214):
position rollup, current value, net P/L%, and XIRR all matched; NAV update and transaction
edit both recalculate everything live; sign-in gate fires on both fund-add and NAV-update;
no console errors.

**Data model**:
```ts
interface Fund {
  id: string;
  name: string;
  code: string;          // fund's ticker/symbol equivalent
  platform: string;      // "Fidelity", "Al Rajhi Capital", ...
  category: 'Equity' | 'Debt' | 'Hybrid' | 'International' | 'Other';
  currencyCode: string;  // per-fund, not per-module
}
interface FundTransaction {
  fundId: string;
  date: string;
  action: 'BUY' | 'SELL';
  units: number;         // same role as `shares` in Transaction
  nav: number;           // NAV per unit — same role as `price`
  source: 'manual';
}
interface FundWorkbook {
  settings: { defaultCurrency: string; managementFeePct?: number };
  funds: Fund[];
  transactions: FundTransaction[]; // same shape family as Transaction — same computePositions-style rollup applies almost unchanged
  balances: { fundId: string; date: string; value: number }[]; // manual NAV/balance snapshots, like QSE/PSX market-price updates
}
```

**Reuse note**: `computePositions`/`cashSummary`/`computeRealizedPLTimeSeries` in
`lib/calc/` are already parametrized by a `FeeCalculator` and operate on
`{date, ticker, action, shares, price}`-shaped records — a `FundTransaction` can likely be
adapted to that exact shape (units→shares, nav→price, fundId→ticker) and reuse those
functions directly rather than reimplementing position rollup from scratch. Worth actually
attempting a shared `Transaction`-compatible shape before assuming a parallel type is
needed, unlike PSX's genuinely different fee model which justified `psxFees.ts`.

**XIRR, not just simple net-profit %** (from `reference/finance-suite-prototype/`): the
reference prototype computes each fund's return via XIRR (cash flows = every transaction,
negative for money out/positive for money back, plus a final synthetic +currentValue flow
dated at the latest balance snapshot; solved via Newton-Raphson with a bisection fallback,
returns null if there isn't at least one negative and one positive flow) rather than a flat
"(current − invested) / invested" percentage. XIRR properly accounts for *when* each
investment happened, which a simple percentage doesn't — worth porting as a new
`lib/calc/xirr.ts` (exchange-agnostic pure function, could arguably also improve QSE/PSX's
own return-percentage displays later, though that's a separate decision for a separate day).

**v1 features**: per-fund position (units held, avg NAV cost, invested amount), realized/
unrealized P/L and XIRR given a current NAV entered manually (same pattern as QSE/PSX market
price entry), a fund-list dashboard mirroring QSE/PSX's Portfolio page.

**Explicitly out of scope for v1**: live NAV fetching (locked decision — would need a
scheduled job + shared `stockData`-style Firebase node, same pattern as QSE/PSX), dividend/
distribution reinvestment tracking beyond what `Dividend` already models for QSE/PSX (reuse
that type if the shape fits).

---

## 4. Rentals — ✅ built 2026-08-23

**Purpose**: track rental property income and expenses — the most structurally different
module: not discrete buy/sell trades, but recurring income (rent received) and expenses
(maintenance, property tax, management fees) against one or more properties.

**Built as designed below.** Same shape as Banking (`settings.properties` +  top-level
`entries`), so `store/rentalsWorkbookStore.ts` is hand-written following the identical idiom
as `bankWorkbookStore.ts`. `lib/calc/rentalsModule.ts` has per-property net income,
per-currency portfolio totals, category breakdown, and a monthly income/expense/net rollup
— all tested. Files: `types/rentalsWorkbook.ts`, `store/{rentalsWorkbookStore,
defaultRentalsWorkbook}.ts`, `lib/firebase/useRentalsFirebaseSync.ts`,
`features/rentals/pages/RentalsPage.tsx` (Properties/Income & expenses/Settings tabs),
route `/rentals`, nav under "More". Verified live in a fresh browser tab: net income summary
grouped by currency, category breakdown and monthly rollup both correct against hand-traced
numbers, property/entry edit recalculates everything live, sign-in gate fires on both
property-add and entry-add, no console errors. **This completes all six modules originally
planned in this document** — see the top of the file for what's next (nav redesign,
cross-entity linking, and whatever comes after that, per the user's direction at the time).

**Data model**:
```ts
interface Property {
  id: string;
  name: string;          // "Apartment 4B", "House on Main St"
  currencyCode: string;  // a property has one currency (real-world rentals do)
  purchasePrice?: number; // for a lifetime ROI figure, optional
}
interface RentalEntry {
  id: string;
  propertyId: string;    // currency is implied by the property, not repeated per-entry
  date: string;
  type: 'RENT_INCOME' | 'EXPENSE';
  amount: number;
  category?: string;     // free-form, user-definable — "maintenance", "property tax", ... (not a fixed enum)
  note?: string;
}
interface RentalWorkbook {
  settings: { properties: Property[] };
  entries: RentalEntry[];
}
```

**v1 features**: multiple properties, income/expense entry, per-property and portfolio-wide
net income (income − expenses) over time, a simple monthly/yearly rollup chart.

**Explicitly out of scope for v1**: tenant/lease management (names, lease terms, due-date
reminders), property valuation tracking over time, mortgage/loan amortization tracking
(could be a natural Banking-module extension later — a property's mortgage is really a
loan account — worth revisiting once both modules exist rather than deciding now).

---

## 5. EMI / Loans — ✅ built 2026-08-23

**Purpose** (added 2026-08-23, from `reference/finance-suite-prototype/`): track a loan
you're repaying on a fixed schedule — a mortgage, car financing, or similar — with an
auto-calculated amortization schedule. Distinct from Banking (which just tracks account
transactions) and from Personal Loans below (informal, no schedule).

**Built as designed below, with one shape change**: the data model's `loans: EMILoan[]`
field is named `entries` instead (`EMIWorkbook.entries: EMILoan[]`) specifically so this
module could reuse `createEntryStore` (the single-array generic factory built for Cash)
rather than needing a fourth hand-written store — EMI/Loans has only one array (no
repayments log, since it's a computed schedule), so it genuinely fits that shape. All
amortization math (`lib/calc/emiModule.ts`'s `emiSchedule`/`emiSummary`) was ported directly
from the reference prototype's formulas and hand-traced in tests (both repayment modes,
including a 0%-rate edge case and elapsed-time clamping once a loan is fully repaid). Files:
`types/emiWorkbook.ts`, `store/{emiWorkbookStore,defaultEmiWorkbook}.ts`,
`lib/firebase/useEMIFirebaseSync.ts`, `lib/calc/emiModule.ts` (+ tests),
`features/emi/pages/EMIPage.tsx`, route `/emi-loans`, nav under "More". Verified live in a
fresh browser tab: sign-in gate on add, the amortization schedule table and summary stats
matched hand-calculated expectations for both a standard mortgage and a no-interest/Sharia
loan, editing recalculates the whole schedule immediately, delete confirms and removes
correctly — no bugs this time (the §6 selector rule was checked before shipping).

**Data model**:
```ts
interface EMILoan {
  id: string;
  name: string;             // "Home Mortgage", "Car Financing"
  lender: string;
  currencyCode: string;
  principal: number;
  tenureMonths: number;
  startDate: string;
  repaymentMode: 'interest' | 'fixedTotal';
  annualRatePct?: number;   // used when repaymentMode === 'interest'
  totalToReturn?: number;   // used when repaymentMode === 'fixedTotal'
}
interface EMIWorkbook {
  settings: { defaultCurrency: string };
  loans: EMILoan[];
}
```

**Two repayment modes** (both from the reference prototype, both worth keeping):
- **Interest mode** — standard reducing-balance EMI:
  `r = annualRatePct/12/100; EMI = P·r·(1+r)^n / ((1+r)^n − 1)`; each month,
  `interest = balance·r`, `principalComponent = EMI − interest`, `balance −= principalComponent`.
- **Fixed-total mode** (for no-interest / Sharia-compliant loans, where a lender states a
  total amount to be returned instead of a rate) — straight-line, no compounding:
  `installment = totalToReturn / n`, `principalPerMonth = principal / n`,
  `markupPerMonth = (totalToReturn − principal) / n`; each month,
  `balance −= principalPerMonth`.

Outstanding balance, amount paid so far, and interest/markup paid so far are read off the
schedule at the row corresponding to full months elapsed since `startDate` — this **assumes
on-schedule payment**, not real payment tracking; the reference prototype makes the same
simplification and explicitly defers missed/late-payment tracking to a later version. Same
call here for v1.

**v1 features**: add a loan (either mode), auto-calculated amortization schedule (per month:
installment, interest/markup, principal, remaining balance), summary stats (monthly
installment, outstanding, paid so far, months remaining, lifetime interest/markup).

**Explicitly out of scope for v1**: missed/late payment tracking (elapsed-time assumption
only, matching the reference prototype's own deferred decision), any category field (kept
intentionally simple, no grouping by loan type), early-payoff/extra-payment recalculation.

---

## 6. Personal Loans — ✅ built 2026-08-23

**Purpose** (added 2026-08-23, from `reference/finance-suite-prototype/`): informal loans
with another person, tracked in **either direction** — money lent out, or money borrowed —
as one module rather than two, with a combined net-position view. No repayment schedule
automation (unlike EMI/Loans above): just principal and ad-hoc repayments.

**Built as designed below, with one architecture note**: this has *two* related arrays
(`loans` + `repayments`), so it doesn't fit `createEntryStore`'s single-array shape any
better than it fit `createWorkbookStore`'s stock-exchange shape — rather than add a third
generic factory just for "two arrays", `store/personalLoansWorkbookStore.ts` is hand-written
following the identical idiom (mutate/persist/localStorage, `{workbook, setWorkbook}` shape
satisfying `useWorkbookCloudSync`'s `MinimalWorkbookStore`) rather than a generic factory.
Files: `types/personalLoansWorkbook.ts`, `store/{personalLoansWorkbookStore,
defaultPersonalLoansWorkbook}.ts`, `lib/firebase/usePersonalLoansFirebaseSync.ts`,
`lib/calc/personalLoansModule.ts` (+ tests), `features/personalLoans/pages/
PersonalLoansPage.tsx`, route `/personal-loans`, nav under "More" in the Sidebar.
**One real bug hit and fixed during this build** (not hypothetical, worth remembering for
any future module using zustand): a selector that computes a derived array *inside* the
selector callback itself (e.g. `(s) => s.workbook.repayments.filter(...)`) returns a new
array reference on every call, which `useSyncExternalStore` (which zustand's hook is built
on) reads as "the store changed," causing a real infinite-render loop with a "getSnapshot
should be cached" console error — confirmed by reproducing it, then fixing it by selecting
the raw stable array and filtering in a separate `useMemo` instead. Any new module's
selectors should follow that same rule: **select raw state, derive in `useMemo`, never
inside the selector callback**.

**Data model**:
```ts
interface PersonalLoan {
  id: string;
  person: string;          // who the loan is with
  direction: 'owed_to_me' | 'i_owe';
  currencyCode: string;
  principal: number;
  date: string;
  note?: string;
}
interface PersonalLoanRepayment {
  loanId: string;
  date: string;
  amount: number;
}
interface PersonalLoansWorkbook {
  settings: { defaultCurrency: string };
  loans: PersonalLoan[];
  repayments: PersonalLoanRepayment[];
}
```

**Calculations**:
```
outstanding = max(0, principal − Σ(repayments for that loan))
netPosition (per currency) = Σ(outstanding where direction='owed_to_me') − Σ(outstanding where direction='i_owe')
```

**v1 features**: add a loan in either direction, log repayments against it, a list
filterable by direction, and a combined net-position summary grouped by currency (per the
cross-cutting currency-aggregation rule above).

**Explicitly out of scope for v1**: no category field (kept intentionally simple, matching
EMI/Loans above), no interest/schedule automation (that's what EMI/Loans is for — if a
"personal loan" actually has a real repayment schedule, it probably belongs in EMI/Loans
instead, not this module).

---

## 7. Cross-entity transaction linking

**Purpose** (README item 19): once more than one module exists, money moving between them
— e.g. a transfer *from* a Bank account *to* a stock exchange's cash balance, or Cash to
Bank — should be one linked record, not two independently-typed entries that can silently
drift out of sync (one side edited or deleted without the other).

**Status: v1 shipped 2026-08-23** (Cash↔Bank, Bank↔QSE/PSX cash, single shared amount, no
currency conversion) — see README Done item 29 and CLAUDE.md for what actually got built.
The design sketch below is the original pre-build plan; **§8 below supersedes it** with the
user-requested extensions (multi-currency amounts, more module pairs). Original sketch kept
for history:

```ts
interface InterEntityTransfer {
  id: string;
  date: string;
  amount: number;
  fromModule: 'cash' | 'bank' | 'qse' | 'psx' | 'funds' | 'rentals' | 'emi' | 'personalLoans';
  fromRef?: string;   // e.g. a BankAccount id, when fromModule needs one
  toModule: 'cash' | 'bank' | 'qse' | 'psx' | 'funds' | 'rentals' | 'emi' | 'personalLoans';
  toRef?: string;
  note?: string;
}
```

The existing QSE/PSX `Transfer` type (`{date, type: 'DEPOSIT'|'WITHDRAWAL', gross, fee}`)
already models money entering/leaving *one* exchange's cash balance from "outside" — an
`InterEntityTransfer` effectively replaces the "outside" half with a real reference to
another module's own ledger, so both sides update from a single write instead of two.
Retrofitting QSE/PSX's existing `Transfer` records into this shape (or leaving them as a
degenerate case where `fromModule`/`toModule` is an opaque "external" placeholder) is a real
migration decision to make carefully when this is actually built, not now.

**v1 scope once started**: linking Cash ↔ Bank and Bank ↔ (QSE cash balance / PSX cash
balance) transfers — the most common real flows. A loan repayment (EMI or Personal Loan) is
naturally a Cash/Bank → loan-module transfer too, once both sides exist. Funds/Rentals
linking can follow once those modules exist.

---

## Navigation (README item 18, referenced here for context)

Once at least one of these modules is real, the Sidebar's `ExchangeSwitcher` chip pair
(QSE/PSX) generalizes into a category dropdown: "Stock Exchanges / Funds / Banking / Cash /
Rentals / EMI & Loans / Personal Loans," with only the built categories enabled — this doc
doesn't attempt that redesign itself since it's a UI change that can happen independently
and earlier if wanted (see README item 18). The routing shape most likely moves from
today's flat `/psx/...` to something like `/stocks/:exchange/...`, `/cash/...`, `/bank/...`,
matching the note already in `CLAUDE.md`'s "Not yet restructured" section.

**Status: built 2026-08-23** — see README Done item 28 (`components/CategoryNav.tsx`).
Routing itself stayed flat (didn't restructure to `/stocks/:exchange/...`) — the dropdown
was layered on top of the existing flat routes rather than requiring a routing rewrite first.

---

# Next wave (2026-08-23, user-requested)

All six original modules and the v1 versions of navigation/linking/chart-filtering above are
built and shipped (PR #1, merged). The user then gave direct feedback/requests that expand
scope beyond what was originally planned here. Recording them here per the standing
instruction to keep this doc current with whatever's been discussed — **this section is
backlog, not yet built** except where marked done. Build order isn't strictly locked; pick
off items as they become tractable, same "don't ask before starting the next one" standing
instruction as the rest of this doc, with the exception of genuinely new infra/cost
decisions (flagged explicitly below).

## 8. Multi-currency-aware, multi-module cross-entity linking

**Status: (a), Rentals, and Personal Loans (part of (b)) built 2026-08-23** — see README
Done items 34 and 39. `fromAmount`/`toAmount` are live, and Rentals + Personal Loans are now
linkable modules (Bank/Cash↔a specific property, Bank/Cash↔a specific loan's repayment
ledger). EMI/Funds remain unlinked per the blockers documented below — nothing changed about
them, they're recorded here for whenever they're picked up next.

Extends README item 19 / MODULES_PLAN §7 (v1 shipped 2026-08-23, Cash↔Bank + Bank↔QSE/PSX,
single shared amount). Two separate asks bundled together by the user, both real:

**a) Genuine multi-currency support for Bank↔Bank and Cash↔Bank.** v1 copies one `amount`
number to both sides and only *warns* on a currency mismatch — it doesn't actually support,
say, moving 500 USD out of a USD bank account into a PKR cash entry credited at whatever the
real conversion was. Locked decision: **no live FX-rate lookup** (unchanged cross-cutting
rule — no auditable rate source). Instead, `InterEntityTransferInput` needs two independent
amounts — `fromAmount` (debited from the `from` side, in its own currency) and `toAmount`
(credited to the `to` side, in its own currency) — entered manually by the user from
whatever real conversion actually happened (their bank's rate, cash exchange receipt, etc.).
When both sides share a currency, `toAmount` can default to `fromAmount` and the form can
hide the second field to keep the common case simple. `buildLinkedRecords` in
`lib/interEntityLink.ts` changes from one `amount` param to `fromAmount`/`toAmount`, and the
link record itself stores both (so a later edit can recompute either side correctly without
losing the original manual conversion).

**b) More module pairs.** Currently Cash/Bank/QSE/PSX/Rentals/Personal Loans participate.
Extending to Funds/EMI hits real per-module blockers, investigated 2026-08-23:
- **Personal Loans**: ✅ investigated and built 2026-08-23. `PersonalLoanRepayment` was
  addressed by a `(loanId, index)` compound key, not a stable `id` — retrofitted the same
  pattern already used for `Transfer`/`CashEntry` (README item 29): added `id: string`,
  an `ensureRepaymentIds()` normalizer in `personalLoansWorkbookStore.ts` applied on load and
  `setWorkbook` (so pre-retrofit user data keeps working), and switched
  `updateRepayment`/`deleteRepayment` to plain id addressing. Now a linkable module: `ref` is
  a `PersonalLoan.id`, and a linked transfer always creates a positive-amount
  `PersonalLoanRepayment` against that loan regardless of link direction (unlike every other
  module, a repayment's sign doesn't depend on which side of the link it's on). See README
  Done item 39.
- **EMI/Loans**: has **no repayment ledger at all** — `EMILoan` is a computed amortization
  schedule (principal/tenure/start-date), not logged payments (see CLAUDE.md's EMI entry).
  Linking a real transfer into it would mean adding a repayments log to EMI's data model,
  which is a bigger design change than "add an id" — don't do this silently; if EMI linking
  is wanted, decide explicitly whether EMI gains a real repayment log (changing what "elapsed
  time" based payoff tracking means) or stays schedule-only and un-linkable.
- **Funds**: technically has a `transfers: Transfer[]` array (inherited from reusing
  `createWorkbookStore`) but it's explicitly unused/not shown in the Funds UI (see CLAUDE.md's
  Funds entry) — a Fund doesn't really have a "cash balance" concept distinct from buy/sell at
  NAV. Wiring linking into an unused, hidden field would be linking into nothing the user can
  see. Exposing that concept in the Funds UI first is a prerequisite, not part of linking
  itself.
- **Rentals**: ✅ investigated and built 2026-08-23. Hand-written store (like Bank), and its
  `updateEntry(id, ...)`/`deleteEntry(id)` were already id-addressed — same check Banking
  already passed, no retrofit needed. Now a linkable module: `ref` is a `Property.id`, and a
  linked transfer maps to `RentalEntry.type` (`RENT_INCOME` when Rentals is the `to` side,
  `EXPENSE` when it's the `from` side).

**Suggested order**: (1) fromAmount/toAmount multi-currency support — ✅ done; (2) Personal
Loans id retrofit + linking — ✅ done; (3) investigate Rentals — ✅ done; (4) EMI and Funds
need their own design decisions first, don't just wire them in — still open.

## 9. Native Risk Calculator (replaces the legacy static-page link) — ✅ built 2026-08-23

**Status: built.** `lib/calc/riskAnalysis.ts` (pure, tested) + shared `components/
RiskCalculator.tsx` + per-exchange pages at `/risk-analysis` (QSE) and `/psx/risk-analysis`
(PSX), replacing the sidebar's link to `Risk_Analysis_Calculator.html`. See README Done item
33 for the full writeup, including two deliberate correctness fixes made vs. a blind port
(reusing the real iterative `breakEvenPrice` solver instead of a flat-fee-only closed-form
formula; including the buy-side fee in a hypothetical purchase's cost basis) and one thing
intentionally *not* ported (a hardcoded "MPHC/IQCD = severe" special-case that was leftover
from one person's real portfolio, not a generalizable rule). The legacy HTML file itself
is left in place — deleting it needs explicit approval, not assumed as part of this change.
Original plan sketch kept for history below:

Currently the sidebar links out to `Risk_Analysis_Calculator.html` (a legacy static page,
predates the React rewrite, shared by both QSE and PSX). User wants a real React-native Risk
Calculator instead of a link-out, per-exchange like the existing Trade Calculator
(`features/qse/components/TradeCalculator.tsx` / `features/psx/components/TradeCalculator.tsx`)
since QSE and PSX have different fee models. **Before building**: read
`Risk_Analysis_Calculator.html`'s actual logic to know what it computes (position sizing?
stop-loss/take-profit levels? portfolio risk %?) — port the real formulas, don't guess new
ones. Once built and verified live, remove the legacy sidebar link and (per the existing
"don't delete legacy apps until PSX reaches parity and the user explicitly approves a
cutover" rule) ask before deleting `Risk_Analysis_Calculator.html` itself, since other things
might still reference it.

## 10. Calculator button should be module-aware

**Status: layer (a) built 2026-08-23** — the button is now hidden entirely outside Stock
Exchanges routes (see README Done item 32). Layer (b), a real per-module calculator, is
still pending on item 11's per-module planning tools existing.

The floating Calculator button (`components/CalculatorLauncher.tsx`) is already rendered
globally (not an exchange-only bug), but it hard-codes the QSE/PSX stock Trade Calculator
regardless of which module you're actually on — confusing on Cash/Bank/EMI/etc. pages.
Clarified 2026-08-23: this is a "wrong content" problem, not a visibility one. Fix in two
layers: (a) immediate — only render/enable the button on Stock Exchanges routes until each
module has something real to calculate, rather than showing an irrelevant stock calculator
elsewhere; (b) longer-term — as each module gains real planning tools (see item 11 below),
`CalculatorLauncher` becomes route-aware across *all* modules (an EMI payoff calculator on
EMI pages, a Cash quick-math tool on Cash pages, etc.), the same pattern it already uses to
switch between QSE and PSX.

## 11. Per-module Analytics & Planning

User feedback: "All modules are very basic. Analysis & planning should be there for each
module" — Cash, Banking, Personal Loans, EMI/Loans, Funds, and Rentals currently have a
ledger/list and basic totals, but nothing like QSE/PSX's Analytics page (18 charts, 4
category tabs) or Trade Planner. This is the largest item in this wave — realistically
several modules' worth of work, not a single sitting. Suggested shape per module (adapt to
what's actually meaningful for each, don't force identical chart sets):

- **Cash**: ✅ built 2026-08-23 — see README Done item 44. Category-breakdown doughnut,
  income-vs-expense-by-month bar chart, balance-over-time line — a currency picker shows up
  only when more than one currency is actually present in the workbook. One new pure
  function needed: `cashMonthlyFlow()` in `lib/calc/cashModule.ts` (category breakdown and
  balance-over-time reused already-computed `cashByCategory`/`cashRunningLedger` as-is).
- **Banking**: per-account balance trend, category breakdown, income vs. spend by month,
  a simple budget/spend-plan tool (e.g. monthly category targets vs. actuals).
- **Personal Loans**: ✅ built 2026-08-23 — see README Done item 45. Outstanding-by-loan bar
  chart (per loan, not netted per person — a person with two loans in opposite directions
  would otherwise hide which is which), repayments-by-month bar chart, and a payoff planner
  living inside a loan's own detail view (a live "months to clear the balance at rate X"
  projection, not persisted). Two new tested pure functions in
  `lib/calc/personalLoansModule.ts`: `outstandingByLoan()`, `repaymentsByMonth()`, plus
  `projectPayoff()` for the planner (linear, no interest concept — unlike EMI's schedule).
- **EMI/Loans**: amortization schedule chart (principal vs. interest per month — the data
  already exists in `emiSchedule()`, just not visualized), a "what-if" planner (extra
  payment → new payoff date, already partially useful given the existing calc engine).
- **Funds**: NAV-over-time line per fund, allocation by category/platform, contribution vs.
  value over time (XIRR already computed, chart it).
- **Rentals**: net income by property over time, category breakdown (already computed in
  `rentalsModule.ts`, not charted), occupancy/vacancy tracking if that data ever gets added.

Build order suggestion: start with whichever module the user actually uses most, or go in
the same build order as the original six modules (Cash → Personal Loans → Banking →
EMI/Loans → Funds → Rentals) for consistency. Each module's Analytics page should follow the
same `ChartFilterBar`/`chartFilters.ts` pattern already built for QSE/PSX (README item 17)
rather than a new filtering mechanism per module.

## 12. Subscriptions module (new, not in the original six)

**Purpose**: track recurring payments (streaming, gym, software, memberships) — the user
explicitly wants each subscription **linked to the entity that pays it** (a Bank account,
primarily, per their wording — "linked to applicable entities like banks").

Sketch (subject to revision when actually built, per this doc's own rule):

```ts
export interface Subscription {
  id: string;
  name: string;              // "Netflix", "Gym membership"
  amount: number;
  currencyCode: string;      // per-entity currency, same cross-cutting rule as every other module
  billingCycle: 'monthly' | 'yearly' | 'weekly' | 'custom';
  customDays?: number;       // used when billingCycle === 'custom'
  startDate: string;
  /** Optional — which Bank account (or 'cash') actually pays this, mirroring the
   * LinkSideConfig.ref pattern from cross-entity linking rather than inventing a
   * separate reference shape. */
  paidVia?: { module: 'bank' | 'cash'; ref?: string };
  category?: string;         // free-form, user-definable — same rule as every other module
  active: boolean;           // toggled off instead of deleted when cancelled, keeps history
  cancelledDate?: string;
}

export interface SubscriptionsWorkbook {
  settings: { defaultCurrency: string };
  entries: Subscription[];   // fits createEntryStore directly, same shape as EMI/Cash
}
```

Whether marking a billing cycle "paid" should auto-create a linked Bank/Cash transaction
(reusing `lib/interEntityLink.ts`'s pattern) or just track the subscription's existence/cost
without auto-generating transactions is a real design choice to make when this is actually
built — auto-generating avoids double-entry drift (matching the whole point of item 8) but
adds complexity (what happens if a payment amount varies, or a cycle is skipped). Lean toward
auto-generating via the same linking mechanism as item 8, once that's solid.

**Analytics for this module** (tying into item 11): total monthly/yearly recurring spend,
upcoming renewals in the next 30 days, spend by category, spend by paying account.

## 13. Import pipeline: CSV/JSON now, PDF/image via a Python backend (locked 2026-08-23)

User request: modules should be able to import data from CSV, JSON, PDF, and images ("use
free services/APIs if needed, or suggest a Python-based backend for processing").

**Decision made with the user**: PDF and (especially) image parsing (photos of receipts/
statements) realistically needs either a paid OCR API or a real backend service — not
something the browser app can do alone for free. **Chosen path: a Python backend service**
(e.g. FastAPI), hosted somewhere the user chooses (a free tier like Render or Fly.io was
suggested, not decided) — this is real new infrastructure, distinct from every other module
built so far, and needs the user's own hosting account/credentials; a Claude Code session
can scaffold the backend's code and a deployment guide, but can't provision a live hosted
service on the user's behalf without their account access.

**Scope split**:
- **CSV/JSON import, browser-only, no new infra**: extend the pattern already proven in
  Banking's CSV statement import (`lib/csv.ts` + the column-mapping UI in `BankPage.tsx`) to
  other modules where a statement-like import makes sense (Cash, Personal Loans repayments,
  Rentals entries). JSON import already exists in a limited form (workbook backup/restore) —
  generalize it per-module if useful. **This can be built now, independent of the backend
  decision. ✅ Now built for Cash, Rentals, and Personal Loans (2026-08-23)** — see README
  Done items 40/41. Cash and Rentals don't have a single signed `amount` field, so the
  mapped Amount column's sign (with an optional flip) decides IN/OUT or RENT_INCOME/EXPENSE
  and the stored amount is the absolute value; Personal Loans repayments skip the sign/flip
  entirely since a repayment is always positive regardless of loan direction. New bulk-add
  actions: `createEntryStore.ts`'s generic `addEntries()` (used by Cash), plus hand-written
  `addEntries()`/`addRepayments()` on `rentalsWorkbookStore.ts`/`personalLoansWorkbookStore.ts`
  (neither uses `createEntryStore`, so each needed its own). **This closes out README item
  25's browser-only CSV/JSON half entirely** — only PDF/image import remains, blocked on the
  Python backend decision below.
- **PDF/image import, needs the Python backend**: the backend receives an uploaded PDF/image,
  runs OCR + parsing (e.g. `pdfplumber`/`PyMuPDF` for text-based PDFs, `pytesseract` or a
  hosted OCR API for images and scanned PDFs), and returns structured transaction-like rows
  in the same shape the browser already expects (matching the "a transaction doesn't care
  about its source" cross-cutting rule — `source: 'statement-import'` or similar). The
  **architecture constraint already locked for market-data APIs applies here too**: no
  parsing logic runs directly against a paid-per-call API from a page load if avoidable —
  prefer a backend that does the work once and returns clean data, not a per-keystroke or
  per-page-load external call.
- **Before writing backend code**: confirm hosting choice and how the browser app
  authenticates to it (an API key? tied to the user's Firebase auth token?) — these are
  small decisions but real ones, best confirmed once actual implementation starts rather
  than guessed here.

## 14. Planning: a "what if I spend on this" scenario planner — ✅ built 2026-08-23

**Status: built for Cash and Banking.** See README Done item 43 for the full writeup. User's
own framing for why this exists: a guardrail against overspending — "a mental deception to
stop the user from overspending... give a realistic idea about what happens if he spends on
something."

**Two design decisions locked with the user before building** (asked via AskUserQuestion,
2026-08-23):
1. **Scope**: Cash and Banking together, in one pass (not one-module-first). Both share the
   same "balance that can go negative if you're not careful" shape, so building the pattern
   once for both was more consistent than prototyping in one and porting later.
2. **Data model**: a **separate "planned" list**, same pattern as the existing QSE/PSX Trade
   Planner (`TradePlan`/`TradePlanLeg` in `types/workbook.ts`) — not a status flag toggled
   in-place on a normal `CashEntry`/`BankTransaction`. A plan is entered as a
   `PlannedCashEntry`/`PlannedBankTransaction`, edited/deleted freely while still "planned,"
   and "Mark as done" creates a real entry in the actual ledger while the plan itself stays
   around flagged `executed: true` — a record of what was planned, independent of the real
   entry it produced. This was the recommended option and the one picked, mainly because it's
   an already-proven pattern in this codebase rather than a new one, and because a plan and a
   real entry genuinely are different things (a plan can be wrong, deleted, or never happen —
   collapsing them into one record with a status flag would make "was this ever really
   planned, or did I just forget to check a box" ambiguous after the fact).

**Architecture**: `PlannedCashEntry`/`PlannedBankTransaction` both fit `createEntryStore`'s
generic `{settings, entries}` shape directly (unlike Personal Loans' two-array shape), so no
new store factory was needed — `plannedCashWorkbookStore.ts`/`plannedBankWorkbookStore.ts`
are two-line `createEntryStore(...)` calls. Deliberately **separate stores** from
`cashWorkbookStore.ts`/`bankWorkbookStore.ts` (own localStorage keys, own Firebase paths)
rather than a second array added to `CashWorkbook`/`BankWorkbook` — this was a real
architecture choice, not a shortcut: `createEntryStore`'s generic type only has room for one
`entries` array, and even if it didn't, touching the existing workbook shape at all carries
migration risk to real user data that a brand-new independent store carries none of (same
reasoning already used for `interEntityTransfersStore.ts`).

**Balance projection**: `lib/calc/plannedBalance.ts`'s `plannedCashProjection`/
`plannedBankProjection` compute **Real** (current balance from actual entries) and
**Planned** (Real + every not-yet-executed plan's signed amount) per currency. A `Planned`
side never double-counts an executed plan, since its real entry is already inside `Real`.

**Display choice is the user's, not the app's** — per their own explicit ask ("we can ask
user what he wants to see one or both"): the Planning tab's summary card has two independent
checkboxes, "Real balance" and "Planned balance" (both on by default), persisted per-module
in the planned workbook's own settings. Nothing is hidden by a hardcoded design choice.

**Deliberately out of scope for v1** (kept small on purpose): Personal Loans, Rentals, EMI,
and Funds don't get a Planning tab; a plan isn't linkable into the cross-entity Transfers
system (§7/§8); there's no reminder/notification when a plan's expected date arrives (this
is a "check when you visit" tool, not a push-notification feature — the app doesn't have a
notification channel of any kind yet). Revisit if the user asks for any of these.

## 15. Planning v2: real-but-pending transfers + balance reconciliation

**Status: design captured 2026-08-23, NOT YET BUILT — explicitly blocked on the user's own
sample Excel data, which they will attach in a future turn.** Per the user's direct
instruction ("I have sample Excel data which will be attached later... update the docs
first, before moving forward"), no code has been written for this yet. This section exists
so a future session picks up the full context instead of re-deriving it.

**The user's own framing**: §14's Planning feature (built) actually needs to work in **two**
distinct ways, not one:
1. **Imaginary / hypothetical plan** — what's already built. A pure "what if" projection
   that may never actually happen.
2. **Real-but-pending transfer** — a transaction the user has *already made* (e.g., sent a
   deposit to a bank/investment account), which is genuinely committed money, but takes a few
   business days to clear/process — so the account's *observed* balance doesn't reflect it
   yet. This is a different situation from (1): not hypothetical, just not-yet-visible.

**Why this is hard, restated in the user's own terms**: this app has a locked rule of never
integrating live bank/broker APIs (restated again by the user in this conversation) — the
user updates their real account balance manually, at whatever cadence they check their bank.
Many real accounts (the user's own example) accrue a small, roughly predictable **daily
profit** even with zero transactions — so a naive "the balance moved, something must have
settled" check can't tell "just another day of ordinary profit accrual" apart from "my
pending deposit cleared."

**Detection logic, from the user's own worked example** (illustrative numbers, to be
verified/refined against the real Excel data before implementing anything):
- Balance is 10,000; the account's known/expected daily profit is ~2 (flat in this example —
  the real accrual rule, flat vs. a %, needs to come from the sample data).
- There's a hanging (not-yet-executed) plan for +1,000 — money already sent, awaiting
  clearance.
- Next observed balance ≈ 10,002 → consistent with *ordinary* daily profit only → the
  pending 1,000 has **not** processed yet.
- Next observed balance ≈ 11,002 → consistent with ordinary profit **plus** the pending
  1,000 → the deposit **has** processed.
- On detecting the second case, the app should **suggest** (never silently apply) that a
  specific hanging plan appears to have settled, and let the user confirm, reject, or adjust
  the settlement date — same "always ask before treating something as final" principle this
  app already applies everywhere else (the sign-in gate, cloud-sync-safety's
  never-assume-emptiness rule, etc.).

**Refinement, added 2026-08-23 (same session): "ordinary daily profit" isn't necessarily
flat across every day of the week.** The user's own example: some funds/accounts pay a
noticeably larger payout on one specific weekday — e.g. every Friday pays 15 instead of the
regular 2 — rather than a uniform daily rate. This directly affects the detection logic
above: the "expected balance if nothing settled" the observed balance gets compared against
must account for *which day of the week it is*, not just "yesterday's balance + one flat
daily increment," or a real Friday bonus payout would itself get misread as a settled
pending plan (a false positive), and conversely a same-day pending settlement could hide
inside a larger expected Friday jump (a false negative — the app might report "nothing
happened" when the deposit actually did clear, just on a day where the ordinary payout was
already large). **Whatever "expected profit rate" field ends up being designed (see the open
gaps below) needs to support at least a day-of-week-varying rate, not only a single flat
number** — the exact shape (a per-weekday table? a "regular rate + optional weekday
override") should still come from the real sample data, not be guessed at here.

**The harder, explicitly-still-open part — which balance did each day's profit accrue on?**
Once a pending plan is confirmed settled, the app also needs to get historical P&L right by
correctly splitting which balance each day's profit was computed against:
- If the account credits a day's profit on the balance as of the *start* of that day (before
  any same-day posting), days during the pending window use the pre-deposit balance for
  their profit calc, and only days *after* the real clearing date switch to the post-deposit
  balance.
- If the account back-dates value differently, the split point moves.
- The user's own words: this needs to be "carefully decided," and the app must "clearly
  highlight... for his final approval" — i.e., show its reasoning/best-guess (which date it
  thinks profit-basis should switch on, and why) but require the user to confirm or correct
  it, never silently pick a convention. **This is exactly the part the sample Excel data is
  meant to clarify** — don't guess at the exact rule ahead of seeing real numbers.

**Scope, per the AskUserQuestion earlier in this session**: Cash and Banking only, for now —
same modules §14's Planning feature already covers. Not QSE/PSX.

**Open design gaps a future session should treat as unresolved, not assumed** (sketch only):
- **No field yet exists for an account's expected regular increment/profit rate.** Neither
  `CashSettings`/`CashEntry` nor `BankAccount`/`BankTransaction` has anything like this today
  — it's new data-model surface, shape TBD from the sample data (flat amount? percentage?
  compounding? does it vary by account? — and, per the weekly-payout refinement above, does
  it need to vary by day of week too, e.g. a bigger Friday payout on top of a smaller regular
  daily rate?).
- **There is no single "the bank told me my balance is X right now" event in today's model.**
  Both Cash and Banking compute the current balance as a derived sum (opening balance +
  every logged entry/transaction) — there's no explicit "observed balance" action a user
  takes that this reconciliation check could hook into. Introducing one (a manual "update
  observed balance" action, distinct from logging an individual transaction) looks necessary,
  but is itself a real design decision, not a given.
- **Matching an ambiguous jump to a specific plan** when more than one hanging plan could
  explain a given delta (or when the "ordinary daily profit" itself isn't precisely known)
  needs a tolerance/ranking rule — not designed yet.
- **Where the resulting "confirmed settlement date" is stored**, and how downstream P&L
  calculations (which don't exist yet for Cash/Banking beyond a running balance — there's no
  P&L concept there today the way QSE/PSX has realized/unrealized P&L) actually consume it,
  is undesigned. This may turn out to matter most for whatever account the user's real
  example describes, so the shape should follow from their data, not be invented ahead of it.

**Next step**: wait for the user's sample Excel data, read it carefully, and only then
design the actual data model + detection algorithm + UI around a real worked example.
