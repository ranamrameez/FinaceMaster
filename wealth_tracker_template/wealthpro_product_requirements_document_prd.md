# Product Requirements Document (PRD): WealthPro
**Version:** 1.0  
**Status:** Approved / Core Architecture Defined  
**Product Category:** Personal Multi-Currency Wealth & Asset Tracker  
**Target Audience:** Expatriates, global investors, and multi-jurisdictional individuals (primarily focused on Pakistan, Qatar, UK, US, and EU markets) managing diversified, multi-currency assets without reliance on paid/live bank/brokerage APIs.

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
Modern personal finance apps typically suffer from three major issues for global cross-border individuals:
1. **Aggregator Fragility & Geographic Blindspots:** Services like Plaid/Yodlee fail in regions like Pakistan (PSX) or Qatar (QSE), or break frequently across regional accounts.
2. **Forced Currency Conversion:** Most platforms force-convert all assets into a single base currency using fluctuating real-time FX, obscuring the actual local performance, local tax exposure, and nominal balances.
3. **Over-engineered "Live" Features:** Real-time stock news, ticking order books, and automated feeds add visual noise and complexity when the user simply needs a high-fidelity manual ledger and valuation control center.

### 1.2 Product Vision
**WealthPro** is a modular, high-fidelity personal wealth tracker designed for users with global footprints. It operates on a **manual-first / free-API hybrid model**, providing absolute clarity by grouping accounts and investments by native currency, offering manual price updates, trade cycle & average-down planners, localized tax/levy calculations (e.g., PSX Filer/Non-Filer, QSE schedules), Zakat tracking, cross-linked transfers, and property management.

---

## 2. Core Architecture & Guiding Principles

1. **Currency-Grouped Display Hierarchy:**
   - Accounts, bank ledgers, cash reserves, and stock holdings are listed **grouped by native currency** (e.g., USD section, PKR section, QAR section, GBP section, EUR section).
   - Users view accounts in their native denomination directly without switching currencies.
   - The global currency toggle in the top navigation is reserved strictly for high-level consolidated overviews (total net worth conversion) and consolidated forecasting.
2. **Manual-First / Free API Hybrid:**
   - No paid brokerage or bank feed requirements.
   - Users manually log balances, purchase lots, and transactions, with quick inline "Update Price" / "Update Balance" actions.
   - Free or delayed APIs can be optionally hooked for benchmark indices, but all portfolio math functions independently of external data feeds.
3. **No Unnecessary Market Noise:**
   - No live order books, no streaming news tickers, and no auto-execution broker routing. WealthPro is a tracking, calculation, and planning suite.
4. **Bi-Directional Transfer & Expense Linking:**
   - Logging a transfer between accounts or allocating cash to property maintenance automatically logs offsetting entries across modules with an audit log.

---

## 3. Detailed Functional Modules & Requirements

### 3.1 Global Navigation & Shell
- **Top Navigation Bar:**
  - Active Global Currency selector (e.g., View summary in USD, PKR, QAR, EUR, GBP).
  - Quick Search across portfolios, tickers, and accounts.
  - Global Action Bar (Quick deposit/withdrawal, transfer logging FAB).
  - Notification Center & Profile Management.
- **Expandable Side Navigation:**
  - Modular hierarchy categorized into:
    - **Wealth Overview:** Consolidated Dashboard, Unified Multi-Currency Summary, Financial Forecast.
    - **Markets & Trading:** Stock Exchange (Grouped by Currency), Trade & Risk Workstation (Average-Down & Cycle Planner), Specialized Market Schedules (PSX, QSE, LSE).
    - **Banking & Cash:** Multi-Currency Banking Hub, Physical Vaults & Cash Holdings, Cash & Credit Hub.
    - **Real Estate & Physical Assets:** Property Portfolio, Rental Yields, Maintenance Reserve.
    - **Operations & Compliance:** Cross-Border Transfer Hub, Linking History / Audit Log, Zakat Calculator, Subscriptions Manager.

---

### 3.2 Multi-Currency Banking & Cash Hub
- **Currency-Grouped Ledgers:**
  - Dedicated sections per currency (USD, PKR, QAR, EUR, GBP, AED, etc.).
  - Displays accounts under each currency (Checking, Savings, Business/Corporate, Money Market).
  - Inline "Update Balance" modal/popover for rapid reconciliation.
  - Recent transactions list per account with debit/credit indicators.
- **Physical Vaults & Cash Tracking:**
  - Safe deposit box tracking, gold bullion (grams/kg with manual purity and valuation), bearer certificates, and physical foreign cash reserves (e.g., USD cash, AED cash).
  - Audit date logging ("Last audited: Oct 15").
- **Manual Adjustments Ledger:**
  - Chronological transaction audit trail with verification statuses (Verified, Pending).

---

### 3.3 Global Investments & Stock Exchange Workstation
- **Currency-Grouped Equities Ledger:**
  - Sections grouped by exchange / denomination (e.g., USD: NYSE/NASDAQ; GBP: LSE; PKR: PSX; QAR: QSE; SAR: Tadawul).
  - Metrics per holding:
    - Asset Ticker & Exchange
    - Units / Shares held
    - Average Buy Price
    - Current Market Price (with inline edit trigger)
    - Break-Even (BE) Price (factoring commissions, taxes, and levies)
    - Total Invested Capital
    - Current Worth
    - Net Unrealized Profit/Loss ($ value and % return)
- **Manual Workstation Tool: Average-Down & Trade Cycle Planner:**
  - Interactive calculator for accumulation strategies during market volatility.
  - Input: Holding selection, additional planned share purchase, target execution price.
  - Output: Projected new total shares, composite break-even average price, total additional capital required.
- **Market-Specific Tax & Levies Engine:**
  - **Pakistan (PSX):** Filer vs. Non-Filer toggle (15% vs 30% WHT on dividends, Capital Gains Tax, SECP/CVT levies, broker commission ~0.15%).
  - **Qatar (QSE):** Flat trading fees, exempt personal capital gains treatment.
  - **UK (LSE):** Stamp Duty Reserve Tax (SDRT 0.5%) calculation.

---

### 3.4 Multi-Currency Forecasting, Budget & Cash Flow
- **Side-by-Side Account Summary:**
  - Snapshot of liquid vs. invested vs. illiquid assets across all active currencies.
- **Forecast Projections (Current + 2 Months Forward):**
  - Stacked column visualization of incoming cash flow, scheduled loan payments, and recurring expenses.
  - Overlay line graph showing projected composite net worth trajectory.
- **Sharia-Compliant Support & Fixed Markup Financing:**
  - Dedicated categorization for Murabaha, Ijara, and Diminishing Musharaka financing.
  - Terminology toggle: "Profit Rate" instead of "Interest Rate", "Fixed Markup" instead of APR.

---

### 3.5 Real Estate & Property Management
- **Property Ledger:**
  - Property acquisition cost, estimated current market valuation, and equity tracking.
  - Rental income collection status, lease expiration dates, tenant details.
  - Gross & Net Rental Yield calculation.
- **Maintenance Reserve Fund:**
  - Dedicated capital pool linked directly to property expenses and cash buffers.
  - Auto-allocation rules from monthly rental income into the maintenance reserve.

---

### 3.6 Cross-Module Linking & Audit Trail
- **Bidirectional Transaction Linking:**
  - When a transfer occurs between a USD Checking Account and an investment cash account, a single entry automatically logs both corresponding debit and credit legs.
  - Automatic linking between rental income and cash accounts, or property expenses and liability tracking.
- **Linking History Report:**
  - Full audit log displaying source module, destination module, conversion rates applied, timestamp, and verification flag.

---

### 3.7 Zakat & Compliance Calculator
- **Asset Assessment Engine:**
  - Categorizes assets into Zakatable (liquid cash, physical gold/silver, tradable equity shares) vs. Non-Zakatable (primary residence, equipment, fixed long-term investment property).
- **Nisab Benchmark & Auto-Estimate:**
  - Evaluates current gold/silver nisab threshold and applies the 2.5% lunar / 2.577% solar zakat rate automatically, grouped per currency.

---

## 4. User Personas

| Persona | Description | Key Need in WealthPro |
|---|---|---|
| **Tariq (Global Expat / Dual Resident)** | Resident of Doha (Qatar) with family and property in Lahore (Pakistan) and investments in the US/UK. | Needs side-by-side visibility of QAR, PKR, and USD without messy FX conversions distorting local bank figures. |
| **Ayesha (Active Regional Trader)** | Actively accumulates dividend blue chips on PSX and growth tech on NASDAQ. | Uses the Manual Trade Cycle Planner to calculate average-down prices and accurately forecast local withholding taxes (PSX filer rules). |
| **Kareem (Asset & Real Estate Owner)** | Owns rental properties, physical bullion in safe deposit boxes, and Sharia-compliant home financing. | Needs maintenance reserve tracking linked to property income and automated Zakat estimation. |

---

## 5. Technical Specifications & UX Requirements

- **Design System:** Equilibrium Finance / WealthPro Design Tokens (Light theme, slate/navy primary `#0f172a`, emerald positive accent `#10b981`, ruby negative accent `#ef4444`, surface neutral `#f8f9ff`, font: Manrope).
- **Responsiveness:** Desktop-first (optimized for dense financial workstations: 1440px wide screens) with responsive tablet/mobile considerations.
- **Data Persistence:** Local/Client-side storage & manual backup JSON exports; no forced cloud authentication required for offline privacy.
- **Accessibility:** WCAG AA contrast compliance for numeric tables, high legibility font hierarchy, distinct color-independent badges for profit/loss.

---

## 6. Release Roadmap & Milestones

- **Phase 1 (MVP - Current Baseline):**
  - Currency-grouped Banking & Cash Hub.
  - Currency-grouped Stock Exchange Workstation with inline price updates.
  - Trade Cycle Planner (Average-Down calculator).
  - Global Wealth Dashboard with primary currency switcher.
- **Phase 2 (Cross-Module Operations):**
  - Bidirectional transfer linking & audit log.
  - Maintenance Reserve linking for property management.
  - Zakat calculation engine.
  - Recurring notifications and manual reminder engine.
- **Phase 3 (Reporting & Portability):**
  - End-of-year tax summary exports (PDF/CSV) with PSX/QSE localized tax formats.
  - Offline JSON encrypted backup & restoration.
  - Mobile-responsive companion layouts.
