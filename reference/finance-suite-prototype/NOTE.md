# Reference: "Finance Suite" prototype (external, 2026-08-23)

`SRS.md` and `finance-suite-prototype.jsx` are a separate, user-supplied reference project —
**not part of FinanceRecorder, not built by/for this codebase, and not wired into the app in
any way.** They were dropped in here purely as feature/design inspiration for
[`MODULES_PLAN.md`](../../MODULES_PLAN.md) (Funds/Banking/Cash/Rentals), because that
prototype independently covers Mutual Funds, Stock Shares, EMI/Loans, Personal Expenses, and
Personal Loans — several of which map closely onto our own planned modules.

**Different tech stack, don't copy code directly**: that project targets React Native/Expo +
SQLite + Google Drive backup; FinanceRecorder is a React/Vite web app with Firebase. Treat
`finance-suite-prototype.jsx`'s calculation functions (`xirr`, `fundMetrics`, `emiSchedule`,
etc.) as *algorithm* reference to port the logic from, not code to import — same as how this
repo already ports formulas from the legacy `index.html` into typed `lib/calc/*.ts` modules
rather than reusing the JS verbatim.

## What's genuinely worth taking from it (see `MODULES_PLAN.md` for where each lands)

- **Per-entity currency + grouped-not-converted aggregation.** Every fund/stock/loan/expense
  entry carries its own `currencyCode`; anything that aggregates across entities (dashboard
  net worth, module totals) groups by currency and shows one figure per currency present,
  never a fake blended conversion. Our own `MODULES_PLAN.md` had settled for one currency
  per *module*, not per *entity* — worth reconsidering given the actual target user base
  (US/EU/GCC/Pakistan) spans several currencies within, say, a single Funds portfolio.
- **XIRR** (Newton-Raphson + bisection fallback) as the return metric for Funds, not just a
  simple net-profit percentage — accounts for cash-flow timing, not just totals.
- **EMI/Loans** as a genuinely separate module concept from what we'd sketched: a structured
  repayment schedule (reducing-balance interest *or* a fixed-total-to-return mode for
  interest-free/Sharia-compliant loans), amortization table, months-remaining tracking.
- **Personal Loans** (informal, bidirectional — money lent out vs. money owed) as its own
  small module, distinct from Banking/Cash: no category field, just person + direction +
  principal + repayments, with a combined net-position view.

## Two gaps this prototype has that we must NOT repeat

Called out explicitly because they contradict standing product requirements for our own
modules:

1. **No edit capability anywhere** — every entity/transaction/balance/price/repayment can
   only be added or deleted, never edited in place. A typo means delete-and-recreate,
   losing the record's identity. FinanceRecorder's existing QSE/PSX modules mostly avoid
   this already (see the 2026-08-23 fix extending edit support to Transfers/Adjustments/
   Dividends/Watchlist, which had the same gap) — new modules must ship with edit from day
   one, not add it later.
2. **Fixed expense category list** (`EXPENSE_CATEGORIES` is a hardcoded array) — no way for
   a user to add their own category. Our own Cash/Banking module sketches in
   `MODULES_PLAN.md` already use a free-text `category?: string` field specifically to avoid
   this, but call it out explicitly as a requirement, not just an implementation detail, so
   it doesn't regress if the field ever gets "upgraded" to an enum for validation purposes.
