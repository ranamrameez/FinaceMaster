# Finance Suite — Personal Finance Tracker

**A personal finance tracker covering Mutual Funds, Stock Shares, EMI/Loans, Expenses, and Personal Loans — each entry keeps its own currency, with growth analytics (simple % and XIRR) and Google Drive backup.**

This document is the Software Requirements Specification (SRS). It covers what the app must do, how data is modeled, how the numbers are calculated, and what's deferred to a later version.

Companion artifact: `finance-suite-prototype.jsx` — a browser-based UX prototype implementing all five modules plus the dashboard (in-memory data, no persistence, Material Design 3 style).

---

## 1. Introduction

### 1.1 Purpose
Define the functional and non-functional requirements for a mobile app (React Native / Expo) that lets an individual track: mutual funds, stock holdings, EMI/loan schedules, personal expenses with budgets, and informal personal loans (both owed to them and owed by them) — across multiple currencies, without connecting to any brokerage or bank API.

### 1.2 Scope
- Single-user, personal-finance tracking app — not a trading, lending, or advisory platform.
- All fund balances, stock prices, and loan/expense entries are entered manually (no live market data feed in v1).
- **Multi-currency by entity, not by portfolio.** Every fund, stock, loan, and expense entry carries its own currency, chosen at creation. The app never auto-converts between currencies — aggregates (portfolio totals, dashboard net worth) are grouped and shown per currency rather than blended into one number.
- Primary user base: US, EU, GCC, and Pakistan — so the currency list is built around USD, EUR, GBP, the six GCC currencies (SAR, AED, QAR, KWD, BHD, OMR), and PKR (INR included too since it's a natural neighbor).
- Data is stored locally (SQLite) with an optional manual/scheduled backup to the user's own Google Drive.
- Out of scope for v1: multi-user accounts, live market/price feeds, tax reporting, brokerage/bank integrations, push notifications, currency conversion/FX rates.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| **Fund** | A mutual fund holding, tracked via multiple investment/withdrawal transactions and periodic balance snapshots. |
| **Stock Share** | An equity holding tracked by quantity, buy price(s), and periodic current-price updates. |
| **EMI / Loan** | A loan you're repaying on a fixed schedule — either an interest-bearing loan (reducing balance) or a no-interest / Sharia-compliant loan where a fixed total amount is repaid instead of interest accruing. |
| **Personal Loan** | An informal loan with another person, tracked in either direction: money you lent out, or money you borrowed — no interest-schedule automation, just principal and repayments. |
| **Net Invested** | Sum of investments minus sum of withdrawals, to date (mutual funds), or quantity held × average buy price (stocks). |
| **XIRR** | Extended Internal Rate of Return — the annualized return accounting for the size and timing of each cash flow. |
| **Entity currency** | The currency assigned to a specific fund/stock/loan/expense entry at creation. Independent of the app's "default currency," which only pre-fills new entries. |

### 1.4 Assumptions
- No login/auth system in v1 — single-device, single-user. Google Drive is a backup target via the user's own account, not a real-time multi-device sync engine (see §7).
- Currency conversion is explicitly out of scope. Aggregated views group amounts by currency rather than compute a single blended total — this is the only honest option without a live FX-rate feed, and avoids implying false precision.
- Expense budgets are denominated in a single "budget currency" (the app's current default currency setting). Expenses logged in other currencies still get totalled and shown, just not compared against the category budgets.

---

## 2. Overall Description

### 2.1 Product Perspective
Standalone mobile app, local-first and fully usable offline. Google Drive backup is optional and user-initiated, not a real-time sync engine.

### 2.2 User Classes
Single class: an individual with holdings and obligations that may span multiple currencies (e.g. a US brokerage account, a GCC savings fund, a PKR personal loan) who wants one app for all of it.

### 2.3 Operating Environment
- iOS and Android via Expo (React Native).
- SQLite via `expo-sqlite` for local storage.
- Google Drive REST API (`drive.file` scope) for backup.

---

## 3. Functional Requirements

### FR-0 — Currency
- **FR-0.1** Supported currencies: USD ($), EUR (€), GBP (£), SAR, AED, QAR, KWD, BHD, OMR, PKR (₨), INR (₹).
- **FR-0.2** The app has one global "default currency" setting, used only to pre-fill the currency field when creating a new fund, stock, loan, or expense entry.
- **FR-0.3** Every fund, stock, EMI/loan, and expense/personal-loan entry stores its own `currencyCode`, chosen at creation, and is always displayed in that currency — never converted.
- **FR-0.4** Any screen that aggregates entities of potentially different currencies (module totals, dashboard net worth, personal-loan net position) groups amounts by currency and displays one figure per currency present, rather than summing across currencies.

### FR-1 — Mutual Funds
- **FR-1.1** Add a fund with: Name, Code/ISIN, Platform, Category (Equity/Debt/Hybrid/International/Other), Currency, Initial Investment Date, Initial Amount Invested.
- **FR-1.2** Supports multiple investment/withdrawal transactions per fund over time.
- **FR-1.3** Balance snapshots logged manually; latest snapshot = current value; "today's change" compares to the previous logged snapshot (not strictly yesterday's calendar date).
- **FR-1.4** Per-fund and portfolio-level: Net Invested, Current Value, Daily Change (₹/%), Net Profit (₹/%), XIRR.

### FR-2 — Stock Shares
- **FR-2.1** Add a holding with: Company name, Ticker, Platform/Broker, Currency, purchase Date, Quantity, Buy Price per share.
- **FR-2.2** Supports multiple buy/sell transactions per holding over time.
- **FR-2.3** Cost basis uses the **average-cost method** across all buys (not lot-specific FIFO/LIFO) — net invested = quantity currently held × average buy price. Deliberate v1 simplification; flag if exact tax-lot accounting is needed later.
- **FR-2.4** Manual current-price updates (like fund balance snapshots); day change, net profit, and XIRR computed the same way as mutual funds, using cash flows of qty × price.

### FR-3 — EMI / Loans
- **FR-3.1** Add a loan with: Name, Lender, Currency, Principal, Tenure (months), Start Date, and **one of two repayment modes**:
  - **Interest rate mode**: annual interest rate (%) — standard reducing-balance EMI calculation.
  - **Fixed-total mode** (for no-interest / Sharia-compliant loans): user enters the **total amount to be repaid** instead of a rate. The markup (total − principal) is spread evenly across the tenure alongside a straight-line principal reduction, rather than compounding interest on a reducing balance.
- **FR-3.2** Auto-calculated schedule (both modes) shows, per month: installment amount, interest/markup component, principal component, remaining balance.
- **FR-3.3** Summary view: monthly installment, outstanding balance, amount paid so far, interest/markup paid so far, months remaining, total lifetime interest/markup — all based on elapsed months since the start date (assumes on-schedule payment; doesn't yet track individually missed/late payments).
- **FR-3.4** No category field for loans (kept intentionally simple — not grouped by loan type).

### FR-4 — Personal Expenses
- **FR-4.1** Log an expense with: Date, Category (fixed list: Food, Transport, Utilities, Rent, Entertainment, Health, Shopping, Other), Amount, Currency, optional Note.
- **FR-4.2** Set a monthly budget per category, denominated in the app's default currency.
- **FR-4.3** Monthly view shows spend vs. budget per category with a progress indicator that flags overspend; expenses logged in a different currency than the budget currency are still totalled and shown, just separately (not compared to the budget bars).

### FR-5 — Personal Loans
- **FR-5.1** Add an entry with: Person's name, Direction (money I lent out / money I owe), Currency, Principal amount, Date, optional Note.
- **FR-5.2** No category field (kept intentionally simple, same as EMI/Loans).
- **FR-5.3** Log repayments (date + amount) against any entry; outstanding = principal − sum(repayments).
- **FR-5.4** Both directions tracked in the same list, filterable by direction; a combined "net position" (owed to me − I owe) shown per currency.

### FR-6 — Dashboard
- **FR-6.1** Net Worth = (Mutual Funds value + Stock value + money owed to me) − (EMI/loan outstanding + money I owe), computed and displayed per currency.
- **FR-6.2** Per-module summary cards showing each module's key figure(s), tappable to navigate into that module.
- **FR-6.3** This month's total expense vs. budget (in the default/budget currency).

### FR-7 — Backup & Restore (Google Drive)
- **FR-7.1** Export all data as one JSON file to the user's Google Drive (`drive.file` scope — app only sees files it created).
- **FR-7.2** Restore from a previously exported file.
- **FR-7.3 (v1.1, optional)** Scheduled automatic backup — deferred in favor of manual export/import for v1, to avoid background-task and token-refresh complexity.

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Offline-first** | All core features work with no network connection. |
| **Performance** | XIRR and schedule calculations complete in well under 100ms for a realistic dataset (≤50 entities per module). |
| **Data integrity** | Each write is a single local SQLite transaction. |
| **Privacy** | No data leaves the device except an explicit, user-initiated Drive export. No analytics/telemetry by default. |
| **Accessibility** | Minimum tap target 44×44dp; gain/loss is always paired with an icon and sign, not color alone. |
| **Portability** | Export format is plain JSON, so data isn't locked into the app. |

---

## 5. Data Model (SQLite)

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL             -- e.g. key='default_currency', value='USD'
);

-- Mutual Funds --
CREATE TABLE funds (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  platform      TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Other' CHECK (category IN ('Equity','Debt','Hybrid','International','Other')),
  currency_code TEXT NOT NULL,
  gradient_from TEXT NOT NULL,
  gradient_to   TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE TABLE fund_transactions (
  id       TEXT PRIMARY KEY,
  fund_id  TEXT NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  amount   REAL NOT NULL,
  type     TEXT NOT NULL CHECK (type IN ('invest','withdraw'))
);
CREATE TABLE fund_balances (
  fund_id  TEXT NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  value    REAL NOT NULL,
  PRIMARY KEY (fund_id, date)
);

-- Stock Shares --
CREATE TABLE stocks (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  ticker        TEXT NOT NULL,
  platform      TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  gradient_from TEXT NOT NULL,
  gradient_to   TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE TABLE stock_transactions (
  id        TEXT PRIMARY KEY,
  stock_id  TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  qty       REAL NOT NULL,
  price     REAL NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('buy','sell'))
);
CREATE TABLE stock_prices (
  stock_id  TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  price     REAL NOT NULL,
  PRIMARY KEY (stock_id, date)
);

-- EMI / Loans --
CREATE TABLE emi_loans (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  lender           TEXT NOT NULL,
  currency_code    TEXT NOT NULL,
  principal        REAL NOT NULL,
  tenure_months    INTEGER NOT NULL,
  start_date       TEXT NOT NULL,
  repayment_mode   TEXT NOT NULL CHECK (repayment_mode IN ('interest','fixedTotal')),
  annual_rate_pct  REAL,           -- used when repayment_mode = 'interest'
  total_to_return  REAL            -- used when repayment_mode = 'fixedTotal'
);

-- Personal Expenses --
CREATE TABLE expenses (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount        REAL NOT NULL,
  currency_code TEXT NOT NULL,
  note          TEXT
);
CREATE TABLE budgets (
  category TEXT PRIMARY KEY,       -- always denominated in the default/budget currency
  monthly_limit REAL NOT NULL
);

-- Personal Loans (both directions, no category) --
CREATE TABLE personal_loans (
  id            TEXT PRIMARY KEY,
  person        TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('owed_to_me','i_owe')),
  currency_code TEXT NOT NULL,
  principal     REAL NOT NULL,
  date          TEXT NOT NULL,
  note          TEXT
);
CREATE TABLE personal_loan_repayments (
  loan_id  TEXT NOT NULL REFERENCES personal_loans(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  amount   REAL NOT NULL
);
```

---

## 6. Calculation Specifications

### 6.1 Mutual Funds / Stock Shares — Simple Net Profit & XIRR
```
netInvested (fund)  = Σ(invest transactions) − Σ(withdraw transactions)
netInvested (stock) = quantityHeld × averageBuyPrice   [average-cost method]
netProfit = currentValue − netInvested
netProfitPct = netProfit / netInvested × 100
```
XIRR: cash flows = every transaction (negative for money out, positive for money back) + a final synthetic +currentValue cash flow dated on the latest balance/price snapshot. Solved via Newton-Raphson with a bisection fallback (returns null if there isn't at least one negative and one positive flow).

### 6.2 EMI / Loans
**Interest mode** (standard reducing-balance EMI):
```
r = annualRatePct / 12 / 100
EMI = P × r × (1+r)^n / ((1+r)^n − 1)
each month: interest = balance × r; principalComponent = EMI − interest; balance −= principalComponent
```
**Fixed-total mode** (no-interest / Sharia):
```
installment = totalToReturn / tenureMonths
principalPerMonth = principal / tenureMonths
markupPerMonth = (totalToReturn − principal) / tenureMonths
each month: balance −= principalPerMonth   (straight-line, no compounding)
```
Outstanding balance and interest/markup paid-to-date are read off the schedule at the row corresponding to the number of full months elapsed since the start date.

### 6.3 Personal Loans
```
outstanding = max(0, principal − Σ(repayments))
netPosition (per currency) = Σ(outstanding where direction='owed_to_me') − Σ(outstanding where direction='i_owe')
```

### 6.4 Multi-Currency Aggregation
No entity's amount is ever converted. Any aggregate (module totals, dashboard net worth, personal-loan net position) is computed by **grouping entities by `currency_code` first, then summing within each group** — the result is a small map like `{ USD: 8200, SAR: 12000 }`, rendered as one line per currency. This is the only defensible approach without a live, auditable FX-rate source.

---

## 7. Google Drive Backup — Design Notes

**v1:** "Export backup" → serializes all tables to one JSON file → Google Drive `drive.file` scope (least-privilege — app only sees files it created). "Restore from backup" → lists the app's own backup files → user picks one → confirms overwrite.

**v1.1 (optional, deferred):** automatic scheduled backup, versioned backups, true multi-device sync.

---

## 8. Decisions Locked In

1. **"Daily" change** — compares to the previous logged balance/price, not strictly yesterday's calendar date. ✅
2. **Mutual fund categories** — Equity / Debt / Hybrid / International / Other. ✅
3. **Stock cost basis** — quantity + buy price + current price per share, average-cost method. ✅
4. **Personal Loans** — tracked in both directions (owed to me / I owe) as one module, no category field. ✅
5. **EMI tracking** — auto-calculated schedule from principal/rate/tenure, **plus** a fixed-total-to-return mode for no-interest/Sharia loans. ✅
6. **Expense tracking** — category log with notes, plus monthly budgets per category. ✅
7. **Currency** — full multi-currency support: per-entity currency (not one portfolio-wide currency), covering USD/EUR/GBP/SAR/AED/QAR/KWD/BHD/OMR/PKR/INR, with aggregates grouped by currency rather than converted. ✅

## 9. Remaining Open Questions

1. **Currency conversion** — if a blended single-currency net worth becomes a priority later, that needs a live/auditable FX-rate source and a decision on which rate (spot on entry date vs. spot on report date) — deliberately deferred for now.
2. **SQLite library choice** — `expo-sqlite` (simplest, fully managed by Expo) vs. `op-sqlite` (faster, requires a custom dev client). Recommendation: start with `expo-sqlite`.
3. **Missed EMI/loan payments** — v1 assumes on-schedule payment based on elapsed time; explicit tracking of missed or late payments is a natural v1.1 addition if needed.

---

## 10. Tech Stack Summary

| Layer | Choice |
|---|---|
| App framework | React Native + Expo (managed workflow) |
| Local storage | SQLite via `expo-sqlite` |
| Navigation | React Navigation, or a custom tab router matching the prototype's scrollable top-tabs |
| Charts | `react-native-svg` (custom line chart, matching the prototype) |
| Backup | Google Drive REST API v3, `drive.file` scope, via `expo-auth-session` |
| State | React Context + hooks |
| Design | Material Design 3 principles — elevated rounded cards, tonal surfaces, bottom-sheet modals, per-module accent colors |

---

## 11. Out of Scope (v1)

- Live NAV/stock price feeds or brokerage API integration.
- Multi-user accounts or cloud sync across devices.
- Currency conversion / blended multi-currency totals.
- Tax/capital-gains reporting.
- Push notifications or reminders.
- Lot-specific (FIFO/LIFO) cost-basis accounting for stocks.
- Missed/late EMI payment tracking (assumes on-schedule payment based on elapsed time).
