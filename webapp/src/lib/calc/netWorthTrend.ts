import { totalsByCurrency } from './emiModule';
import type { EMILoan } from '../../types/emiWorkbook';
import type { BudgetActivity } from './budgetPlanner';
import type { NetWorthSnapshot } from '../../types/netWorthSnapshot';

function endOfMonthAsOf(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  // `Date.UTC(y, m, 0)` = day 0 of the month AFTER `m` (1-indexed) = the
  // last day of `m` itself, all in UTC so there's no local/UTC boundary to
  // cross (same discipline `installmentDueDate` uses, see its own doc
  // comment for the exact bug this avoids).
  return new Date(Date.UTC(y, m, 0));
}

export interface MonthlyNetWorthPoint {
  month: string;
  /** `undefined` per currency = no data available for this month (a past
   * month with no snapshot at or before it yet). */
  byCurrency: Record<string, number | undefined>;
}

/**
 * A per-month Net Worth "trend" figure for the Budget Planner's scrollable
 * summary table (README item 107 / user-requested 2026-08-27) — the
 * concrete answer to "an EMI makes Net Worth look permanently negative for
 * 36 months; we must zoom in to see the deeper picture." Rather than one
 * flat headline number, this shows the trajectory: does it improve month
 * over month as debt gets paid down, even while the total stays negative.
 *
 * Two different sources depending on whether a month is in the past or the
 * present/future:
 * - **Past months** (before the current calendar month): read from real
 *   `NetWorthSnapshot`s (the existing on-demand/daily-auto history
 *   feature, see `types/netWorthSnapshot.ts`) — the latest snapshot at or
 *   before that month. Never fabricated; a month with no snapshot yet
 *   returns `undefined` for that currency rather than guessing at a number
 *   that was never actually recorded.
 * - **Current/future months**: PROJECTED from today's real Net Worth, not
 *   re-derived from scratch, as two additive terms:
 *   1. Cumulative net cash flow (income − expense) from Budget Planner's
 *      own activities (Cash/Bank/Rentals, real + planned) strictly after
 *      today through the end of the target month.
 *   2. The change in EMI/Loans' own outstanding balance between today and
 *      the end of the target month, via each loan's own amortization
 *      schedule (`emiModule.ts`'s `totalsByCurrency`, the exact same
 *      function Net Worth's own real-time figure already uses for
 *      "today," just called with a different `asOf`).
 *
 *   **Term 1 deliberately EXCLUDES any Budget Planner activity tagged
 *   `sourceEmiLoanId`** (an EMI's own auto-generated "Link to bank"
 *   installment plan) — that cash outflow's effect on Net Worth is ALREADY
 *   captured correctly by term 2's schedule-based liability reduction.
 *   Counting both would double the hit: once as a full-installment cash
 *   expense, and again by not crediting back the principal portion that
 *   installment actually pays down — the same "blend real cash flow with
 *   liability data without excluding what's already accounted for" double-
 *   counting shape this project hit before with the Trade Planner's
 *   executed-leg handling. An EMI loan with no "Link to bank" plan simply
 *   isn't in Budget Planner's activities at all, so it only ever affects
 *   the trend via term 2 — never a gap, never a double count.
 */
export function projectedNetWorthTrend(params: {
  months: string[];
  currentMonth: string;
  todayISODate: string;
  currentNetWorthByCurrency: Record<string, number>;
  activities: BudgetActivity[];
  emiLoans: EMILoan[];
  snapshots: NetWorthSnapshot[];
}): MonthlyNetWorthPoint[] {
  const { months, currentMonth: nowMonth, todayISODate, currentNetWorthByCurrency, activities, emiLoans, snapshots } = params;
  const currencies = Object.keys(currentNetWorthByCurrency);
  // Explicit `asOf` derived from `todayISODate`, never `totalsByCurrency`'s
  // own `new Date()` default — this keeps the function pure/testable and
  // avoids a real (if usually invisible, since `todayISODate` is normally
  // literally today) mismatch between the two "today"s.
  const emiToday = totalsByCurrency(emiLoans, new Date(todayISODate));
  const sortedSnapshots = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  return months.map((month) => {
    const byCurrency: Record<string, number | undefined> = {};
    if (month < nowMonth) {
      const candidates = sortedSnapshots.filter((s) => s.date.slice(0, 7) <= month);
      const snap = candidates[candidates.length - 1];
      currencies.forEach((c) => { byCurrency[c] = snap?.byCurrency[c]; });
    } else {
      const emiAtMonth = totalsByCurrency(emiLoans, endOfMonthAsOf(month));
      const flow: Record<string, number> = {};
      activities
        .filter((a) => a.date > todayISODate && a.date.slice(0, 7) <= month && !a.sourceEmiLoanId)
        .forEach((a) => { flow[a.currencyCode] = (flow[a.currencyCode] ?? 0) + a.amount; });
      currencies.forEach((c) => {
        const emiDelta = (emiToday[c]?.outstanding ?? 0) - (emiAtMonth[c]?.outstanding ?? 0);
        byCurrency[c] = currentNetWorthByCurrency[c] + (flow[c] ?? 0) + emiDelta;
      });
    }
    return { month, byCurrency };
  });
}
