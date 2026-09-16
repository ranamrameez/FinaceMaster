import { categoryName } from '../categories';
import type { BudgetActivity } from './budgetPlanner';
import type { Category, CategoryGroup } from '../../types/finance';

/** The set of category display NAMES a group currently resolves to.
 * `BudgetActivity.category` is already a resolved display name (real
 * entries via `categoryName(categoryID, categories)`, planned entries via
 * their own legacy free-text field — see `Finance`'s doc comment in
 * `types/finance.ts` for why those differ), so matching by name here
 * (rather than threading `categoryID` through `BudgetActivity`, which
 * would need a wider type change) is the simplest correct join — a
 * renamed category is transparently picked up the next time this runs,
 * since it re-resolves the name from `categoryID` fresh every call rather
 * than caching a stale name inside the group itself. */
export function groupCategoryNames(group: CategoryGroup, categories: Category[]): Set<string> {
  return new Set(group.categoryIds.map((id) => categoryName(id, categories)));
}

/** Every activity (real + planned, Cash+Bank+Rentals — the exact
 * `BudgetActivity[]` scope Budget Planner/Net Worth's own Inflow/Outflow
 * already use) whose category belongs to this group. A category can
 * belong to SEVERAL groups (user-confirmed 2026-09-16) — this only ever
 * filters WITHIN one group at a time, so calling it once per group (never
 * summing the results of two different groups together) is the correct
 * way to avoid double-counting a shared category's own activity. */
export function activitiesForGroup(activities: BudgetActivity[], group: CategoryGroup, categories: Category[]): BudgetActivity[] {
  const names = groupCategoryNames(group, categories);
  return activities.filter((a) => names.has(a.category ?? ''));
}

export interface CategoryGroupMonthlyTotal {
  month: string;
  /** Signed — same convention as `BudgetActivity.amount` (positive =
   * inflow, negative = outflow). A group like "Expense" naturally nets
   * negative since it's made of outflow categories; "Income" naturally
   * nets positive — no separate sign/orientation field needed on the
   * group itself. */
  byCurrency: Record<string, number>;
}

/** One net total per month, per currency, for everything in this group —
 * the "bird's-eye view" the user's own Excel workflow described (e.g.
 * "Expense -> Travel + Grocery + Extra++"). */
export function groupMonthlyTotals(
  activities: BudgetActivity[], group: CategoryGroup, categories: Category[], months: string[],
): CategoryGroupMonthlyTotal[] {
  const filtered = activitiesForGroup(activities, group, categories);
  return months.map((month) => {
    const byCurrency: Record<string, number> = {};
    filtered.filter((a) => a.date.slice(0, 7) === month).forEach((a) => {
      byCurrency[a.currencyCode] = (byCurrency[a.currencyCode] ?? 0) + a.amount;
    });
    return { month, byCurrency };
  });
}
