# FinanceMaster Audit — bug finding + fixes

**Audit branch:** `chatgpt-audit-20260916-v2`

**Verified main baseline:** `064102aab1611071cd981dbf1ab2a6b393ce652b` (2026-09-16 18:02:03 UTC)

**Purpose:** Find financial/data/UI anomalies in the current application, fix confirmed defects on the audit branch, and add regression coverage where practical. No PR or merge is performed automatically.

## Fixed findings

- **HIGH — Pending trades in actual cash ledgers:** `buildCashLedger()` now excludes pending BUY/SELL orders itself, preventing cash-summary/ledger divergence.
- **HIGH — Pending PSX orders affecting filled-trade fee pairing:** `sameDayChargedSide()` now excludes pending transactions.
- **HIGH — Same-instant transaction chronology:** persisted `seq` is now authoritative when both tied transactions have sequence values; legacy untimed records retain the BUY-before-SELL fallback.
- **HIGH — Oversells creating fictitious profit:** weighted-average, FIFO, realized-P/L-series and cash-ledger paths now ignore unmatched SELL transactions because this app does not model short positions.
- **HIGH — Transfer IDs missing at insertion:** `addTransfer()` now generates UUIDs immediately.
- **MEDIUM — Trade-plan identity:** `addTradePlan()` and normalization now guarantee a plan ID and `legs` array.
- **HIGH — Pending bank activity in actual analytics:** running ledger, category totals, monthly flows and balance-derived analytics now exclude pending transactions.
- **HIGH — Pending cash activity in actual analytics:** running ledger, category totals and monthly flows now exclude pending entries.
- **HIGH — Pending rental activity in actual analytics:** category and monthly rollups now exclude pending entries, matching net-income behavior.
- **HIGH — Pending personal-loan repayments in actual history:** running repayment history and monthly repayment totals now exclude pending repayments.
- **MEDIUM — Personal-loan payoff date timezone drift:** `projectPayoff()` now uses UTC calendar arithmetic, preventing one-day shifts.
- **HIGH — Pending Cash/Bank activity in net-worth flows/drill-downs:** `flowByCurrency()` and `flowActivity()` now exclude pending records.

## Regression coverage added

`webapp/src/lib/calc/__tests__/calc.test.ts` now covers exact tick break-even behavior, persisted same-instant transaction sequencing, oversell protection, pending position exclusion, pending cash-ledger exclusion, and realized-P/L oversell protection.

Existing FIFO and PSX fee tests were also reviewed; FIFO already has focused coverage for partial sells, fee allocation, oversells, same-day round trips and specific-lot targeting.

## Reviewed without a confirmed defect

- QSE weighted-average position/P&L path after chronology and oversell fixes.
- PSX average-vs-FIFO selection and FIFO lot attribution.
- PSX fee-override precedence.
- Firebase empty-cloud protection, initial-snapshot race protection, undefined-value stripping and remote-echo protection.
- Finance migration helpers for legacy categories, deposit direction and serial numbers.
- Credit Card's separate transaction model.
- Net-worth asset/liability sign conventions.

Firebase whole-workbook writes remain effectively last-write-wins across concurrent sessions. This is a synchronization design limitation, but without a defined conflict-resolution product requirement it was not silently replaced during this audit.

## Verification limitation

Source inspection and commits were performed through the repository connector. A local `npm test`/`npm run build` could not be executed because outbound GitHub/DNS access is unavailable to the container. Regression tests were added and statically reviewed, but their runtime result is not claimed.

## Status

**Financial/data calculation audit and fix pass complete for the reviewed application surface.**

All fixes are on `chatgpt-audit-20260916-v2`. No PR was opened and no merge was performed.
