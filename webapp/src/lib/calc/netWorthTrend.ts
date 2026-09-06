import { emiScheduledCashOutflowByCurrency, totalsByCurrency } from './emiModule';
import { netWorthAsOfDate, type NetWorthAsOfInputs } from './netWorthAsOf';
import { includedEmiLoans } from './netWorthInclusion';
import type { CurrencyNetWorth } from './netWorth';
import type { EMILoan } from '../../types/emiWorkbook';
import type { BudgetActivity } from './budgetPlanner';

export function endOfMonthAsOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  // `Date.UTC(y, m, 0)` = day 0 of the month AFTER `m` (1-indexed) = the
  // last day of `m` itself, all in UTC so there's no local/UTC boundary to
  // cross (same discipline `installmentDueDate` uses, see its own doc
  // comment for the exact bug this avoids).
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export interface MonthlyNetWorthPoint {
  month: string;
  /** `undefined` per currency = that currency had no activity yet as of
   * this month (a genuinely honest "doesn't exist yet," not a missing
   * snapshot — see this file's own doc comment). */
  byCurrency: Record<string, number | undefined>;
  assetsByCurrency: Record<string, number | undefined>;
  liabilitiesByCurrency: Record<string, number | undefined>;
}

/**
 * A per-month Net Worth "trend" for the Net Worth page's scrollable Monthly
 * summary widget (moved there from Budget Planner, README/user-requested
 * 2026-09-04 — "this widget belongs to the main Net Worth page").
 *
 * User-reported (2026-09-04): "Monthly Net Worth should be the sum of all
 * accounts on the last day of a month... the app is misleading wealth flow
 * with Net Worth!" This REPLACES the previous design (past months read from
 * sporadically-saved `NetWorthSnapshot`s, showing "—" for any month with no
 * snapshot) with a REAL computation for every past/current month, via
 * `netWorthAsOfDate` — the exact same per-module total functions "today"'s
 * live figure already uses, just re-run with each module's own transaction/
 * entry log filtered to that date. This works for ANY past month with real
 * transaction history, regardless of whether a snapshot was ever saved —
 * `undefined` now means "this currency genuinely had no activity yet,"
 * never "we just don't have a record of it."
 *
 * Two different sources depending on whether a month is fully in the past,
 * the current (still in progress) month, or the future:
 * - **Past months** (before the current calendar month): `netWorthAsOfDate`
 *   as of that month's real LAST DAY.
 * - **Current month**: `netWorthAsOfDate` as of TODAY, not the (not-yet-
 *   arrived) end of the month — we can't know what the rest of this month
 *   holds, so "today" is the most honest real figure available.
 * - **Future months**: still PROJECTED from today's real Net Worth (there's
 *   no real transaction history yet to compute from) — Assets grow by
 *   Budget Planner's own planned income/expense flow through that month;
 *   Liabilities are today's real liabilities with today's own EMI
 *   contribution swapped out for that future month's own EMI outstanding
 *   (via `emiModule.ts`'s `totalsByCurrency`) — every OTHER liability
 *   (credit cards, personal loans) is held at today's value, the same
 *   scope this projection has always had. `net = assets - liabilities`
 *   here is algebraically identical to the original combined formula
 *   (`currentNet + flow + emiDelta`) that predates the assets/liabilities
 *   split — this is a strict refinement (a breakdown for the SAME net
 *   figure), not a behavior change to what "future net worth" means.
 *
 *   **The flow term deliberately EXCLUDES any Budget Planner activity
 *   tagged `sourceEmiLoanId`** (an EMI's own auto-generated "Link to bank"
 *   installment plan) — that cash outflow is instead accounted for
 *   directly from the loan's own SCHEDULE, unconditionally, via
 *   `emiModule.ts`'s `emiScheduledCashOutflowByCurrency` (see its own doc
 *   comment for the bug this fixes — README Done item 231, user-reported
 *   2026-09-06: "EMI is giving me unrealistic values"). Counting both the
 *   Budget Planner flow AND the schedule-based figure would double the
 *   hit — the same "blend real cash flow with liability data without
 *   excluding what's already accounted for" double-counting shape this
 *   project hit before with the Trade Planner's executed-leg handling —
 *   so a linked plan's own not-yet-executed flow stays excluded exactly
 *   as before, just now REPLACED by the schedule-derived figure instead of
 *   silently dropped with nothing standing in for it (the actual bug: a
 *   loan that was never linked to a bank account had NOTHING capture its
 *   future cash cost at all, letting Net Worth look like it improved for
 *   free purely from the loan quietly amortizing in the model).
 *   `collectBudgetActivities` (README/user-requested 2026-09-04) also now
 *   excludes both sides of any inter-account linked transfer from
 *   `activities` entirely — so this flow term is never inflated by money
 *   simply moving between the user's own accounts either.
 */
export function projectedNetWorthTrend(params: {
  months: string[];
  currentMonth: string;
  todayISODate: string;
  currentRows: CurrencyNetWorth[];
  activities: BudgetActivity[];
  emiLoans: EMILoan[];
  netWorthAsOfInputs: NetWorthAsOfInputs;
}): MonthlyNetWorthPoint[] {
  const { months, currentMonth: nowMonth, todayISODate, currentRows, activities, netWorthAsOfInputs } = params;
  // Filtered here (not just relying on the caller), same self-contained
  // pattern `netWorthAsOfDate` already uses for every other entity array —
  // see `netWorthInclusion.ts`'s own doc comment for the full "let the
  // user choose which accounts count" feature this belongs to.
  const emiLoans = includedEmiLoans(params.emiLoans);
  const currencies = currentRows.map((r) => r.currency);
  // Explicit `asOf` derived from `todayISODate`, never `totalsByCurrency`'s
  // own `new Date()` default — keeps this pure/testable and avoids a real
  // (if usually invisible, since `todayISODate` is normally literally
  // today) mismatch between the two "today"s.
  const emiToday = totalsByCurrency(emiLoans, new Date(todayISODate));
  const currentAssets = Object.fromEntries(currentRows.map((r) => [r.currency, r.assets]));
  const currentLiabilities = Object.fromEntries(currentRows.map((r) => [r.currency, r.liabilities]));
  const currentNet = Object.fromEntries(currentRows.map((r) => [r.currency, r.net]));

  return months.map((month) => {
    const byCurrency: Record<string, number | undefined> = {};
    const assetsByCurrency: Record<string, number | undefined> = {};
    const liabilitiesByCurrency: Record<string, number | undefined> = {};

    if (month < nowMonth) {
      const rows = netWorthAsOfDate(endOfMonthAsOf(month), netWorthAsOfInputs);
      const rowByCurrency = new Map(rows.map((r) => [r.currency, r]));
      currencies.forEach((c) => {
        const row = rowByCurrency.get(c);
        byCurrency[c] = row?.net;
        assetsByCurrency[c] = row?.assets;
        liabilitiesByCurrency[c] = row?.liabilities;
      });
    } else if (month === nowMonth) {
      // The month is still in progress — we can't know what the rest of it
      // holds, so use TODAY's already-known real figure directly (the exact
      // headline number shown elsewhere on the page) rather than
      // re-deriving it a second time from the same inputs.
      currencies.forEach((c) => {
        byCurrency[c] = currentNet[c];
        assetsByCurrency[c] = currentAssets[c];
        liabilitiesByCurrency[c] = currentLiabilities[c];
      });
    } else {
      const emiAtMonth = totalsByCurrency(emiLoans, new Date(endOfMonthAsOf(month)));
      const emiCashOutflow = emiScheduledCashOutflowByCurrency(emiLoans, todayISODate, endOfMonthAsOf(month));
      const flow: Record<string, number> = {};
      activities
        .filter((a) => a.date > todayISODate && a.date.slice(0, 7) <= month && !a.sourceEmiLoanId)
        .forEach((a) => { flow[a.currencyCode] = (flow[a.currencyCode] ?? 0) + a.amount; });
      currencies.forEach((c) => {
        const assets = (currentAssets[c] ?? 0) + (flow[c] ?? 0) - (emiCashOutflow[c] ?? 0);
        const liabilities = (currentLiabilities[c] ?? 0) - (emiToday[c]?.outstanding ?? 0) + (emiAtMonth[c]?.outstanding ?? 0);
        assetsByCurrency[c] = assets;
        liabilitiesByCurrency[c] = liabilities;
        byCurrency[c] = assets - liabilities;
      });
    }
    return { month, byCurrency, assetsByCurrency, liabilitiesByCurrency };
  });
}
