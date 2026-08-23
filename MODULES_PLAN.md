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
6. **Rentals** — the most different shape (recurring income/expense on a property, not
   discrete buy/sell trades) — do this last since it borrows the least from existing code.

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

## 4. Rentals

**Purpose**: track rental property income and expenses — the most structurally different
module: not discrete buy/sell trades, but recurring income (rent received) and expenses
(maintenance, property tax, management fees) against one or more properties.

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

**This is blocked on at least two modules existing** (there's nothing to link yet) — design
sketch only, revisit once, say, Cash and Banking are both built:

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
