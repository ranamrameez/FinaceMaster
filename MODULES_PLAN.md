# New Modules Plan: Funds, Banking, Cash, Rentals

Design/proposal document for the four modules beyond Stock Exchanges (QSE + PSX) that make
up FinanceRecorder's full vision (see `README.md`'s Migration Plan Overview and
`CLAUDE.md`'s "What this project is"). **Per a 2026-08-23 sequencing decision, none of these
get built until the Stock Exchanges module is considered finished** — this doc exists so
that work can start from a real design instead of a blank page once that time comes, not as
an invitation to start now. Update this doc as decisions change; it's a plan, not a spec
frozen in time.

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

## Suggested build order

Simplest and most self-contained first, each one a smaller step than the last render it
riskier to get wrong:

1. **Cash** — a single running ledger, no external data source, smallest possible module.
   Good first exercise in generalizing the workbook factories beyond stock exchanges.
2. **Banking** — builds directly on Cash's ledger concept, adds multiple accounts and
   statement import (the first real use of the "manual entry + statement parsing" pattern).
3. **Funds** (mutual funds) — structurally closest to QSE/PSX (buy/sell units, a "price"
   equivalent in NAV-per-unit, cost basis, P/L) — most reuse of the existing calc engine.
4. **Rentals** — the most different shape (recurring income/expense on a property, not
   discrete buy/sell trades) — do this last since it borrows the least from existing code.

This is a suggestion, not a mandate — reorder freely if priorities change.

---

## 1. Cash

**Purpose**: track physical/informal cash holdings (cash in hand, cash gifts, small
informal loans) that don't live in a bank account or brokerage — the simplest module,
closer to a manual ledger than anything else.

**Data model**:
```ts
interface CashEntry {
  date: string;
  type: 'IN' | 'OUT';
  amount: number;
  category?: string;   // e.g. "gift", "personal loan", "misc"
  note?: string;
  source: 'manual';    // only source for v1 — no statement to parse for physical cash
}
interface CashWorkbook {
  settings: { currency: string };
  entries: CashEntry[];
}
```

**v1 features**: add/edit/delete entries, running balance, simple category breakdown,
export/import JSON (same pattern as QSE/PSX Settings → Data management).

**Explicitly out of scope for v1**: categorization rules/auto-tagging, multi-currency
conversion (single `currency` setting is enough to start), budgets/spending limits.

---

## 2. Banking

**Purpose**: bank account balances and transaction history (deposits, withdrawals, card
spending), entered manually or imported from a statement — no live bank API (locked
decision above).

**Data model**:
```ts
interface BankAccount {
  id: string;
  name: string;         // "Meezan Checking", "QNB Savings"
  currency: string;
  openingBalance: number;
}
interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;       // signed: negative = debit, positive = credit
  description: string;
  category?: string;    // "groceries", "utilities", "salary", ...
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

## 3. Funds (mutual funds)

**Purpose**: track mutual fund unit holdings and performance — structurally the closest of
the four to QSE/PSX (a "buy N units at NAV X" is the same shape as "buy N shares at price
X"), so this module should reuse the calc engine most directly.

**Data model**:
```ts
interface FundTransaction {
  date: string;
  fundCode: string;      // fund's ticker/symbol equivalent
  action: 'BUY' | 'SELL';
  units: number;         // same role as `shares` in Transaction
  nav: number;           // NAV per unit — same role as `price`
  source: 'manual';
}
interface FundWorkbook {
  settings: { currency: string; managementFeePct?: number };
  transactions: FundTransaction[]; // same shape family as Transaction — same computePositions-style rollup applies almost unchanged
}
```

**Reuse note**: `computePositions`/`cashSummary`/`computeRealizedPLTimeSeries` in
`lib/calc/` are already parametrized by a `FeeCalculator` and operate on
`{date, ticker, action, shares, price}`-shaped records — a `FundTransaction` can likely be
adapted to that exact shape (units→shares, nav→price, fundCode→ticker) and reuse those
functions directly rather than reimplementing position rollup from scratch. Worth actually
attempting a shared `Transaction`-compatible shape before assuming a parallel type is
needed, unlike PSX's genuinely different fee model which justified `psxFees.ts`.

**v1 features**: per-fund position (units held, avg NAV cost, invested amount), realized/
unrealized P/L given a current NAV entered manually (same pattern as QSE/PSX market price
entry), a fund-list dashboard mirroring QSE/PSX's Portfolio page.

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
  currency: string;
  purchasePrice?: number; // for a lifetime ROI figure, optional
}
interface RentalEntry {
  id: string;
  propertyId: string;
  date: string;
  type: 'RENT_INCOME' | 'EXPENSE';
  amount: number;
  category?: string;     // "maintenance", "property tax", "management fee", ...
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

## 5. Cross-entity transaction linking

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
  fromModule: 'cash' | 'bank' | 'qse' | 'psx' | 'funds' | 'rentals';
  fromRef?: string;   // e.g. a BankAccount id, when fromModule needs one
  toModule: 'cash' | 'bank' | 'qse' | 'psx' | 'funds' | 'rentals';
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
balance) transfers — the most common real flows. Funds/Rentals linking can follow once
those modules exist.

---

## Navigation (README item 18, referenced here for context)

Once at least one of these modules is real, the Sidebar's `ExchangeSwitcher` chip pair
(QSE/PSX) generalizes into a category dropdown: "Stock Exchanges / Funds / Banking / Cash /
Rentals," with only the built categories enabled — this doc doesn't attempt that redesign
itself since it's a UI change that can happen independently and earlier if wanted (see
README item 18). The routing shape most likely moves from today's flat `/psx/...` to
something like `/stocks/:exchange/...`, `/cash/...`, `/bank/...`, matching the note already
in `CLAUDE.md`'s "Not yet restructured" section.
