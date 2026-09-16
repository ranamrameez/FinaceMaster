import { describe, expect, it } from 'vitest';
import { activitiesForGroup, groupMonthlyTotals } from '../categoryGroups';
import type { BudgetActivity } from '../budgetPlanner';
import type { Category, CategoryGroup } from '../../../types/finance';

const categories: Category[] = [
  { id: 'cat_travel', serialNumber: 1, name: 'Travel', scope: 'app' },
  { id: 'cat_grocery', serialNumber: 2, name: 'Grocery', scope: 'app' },
  { id: 'cat_income', serialNumber: 3, name: 'Income', scope: 'app' },
];

const activities: BudgetActivity[] = [
  { id: 'a1', module: 'cash', sourceLabel: 'Cash', date: '2026-01-05', amount: -100, currencyCode: 'USD', category: 'Travel', description: 'Flight', executed: true },
  { id: 'a2', module: 'bank', sourceLabel: 'Checking', date: '2026-01-10', amount: -50, currencyCode: 'USD', category: 'Grocery', description: 'Groceries', executed: true },
  { id: 'a3', module: 'cash', sourceLabel: 'Cash', date: '2026-01-15', amount: 2000, currencyCode: 'USD', category: 'Income', description: 'Salary', executed: true },
  // A different month — should not show up when filtering to January.
  { id: 'a4', module: 'cash', sourceLabel: 'Cash', date: '2026-02-01', amount: -20, currencyCode: 'USD', category: 'Travel', description: 'Taxi', executed: true },
  // A category not in either group — must not be picked up by either.
  { id: 'a5', module: 'cash', sourceLabel: 'Cash', date: '2026-01-20', amount: -10, currencyCode: 'USD', category: 'Uncategorized', description: 'Misc', executed: true },
];

describe('categoryGroups', () => {
  it('activitiesForGroup only includes activities whose category is in the group', () => {
    const expenseGroup: CategoryGroup = { id: 'g1', serialNumber: 1, name: 'Expense', categoryIds: ['cat_travel', 'cat_grocery'] };
    const result = activitiesForGroup(activities, expenseGroup, categories);
    expect(result.map((a) => a.id).sort()).toEqual(['a1', 'a2', 'a4']);
  });

  it('groupMonthlyTotals nets the signed amount per month, per currency', () => {
    const expenseGroup: CategoryGroup = { id: 'g1', serialNumber: 1, name: 'Expense', categoryIds: ['cat_travel', 'cat_grocery'] };
    const totals = groupMonthlyTotals(activities, expenseGroup, categories, ['2026-01', '2026-02']);
    expect(totals).toEqual([
      { month: '2026-01', byCurrency: { USD: -150 } }, // -100 (a1) + -50 (a2)
      { month: '2026-02', byCurrency: { USD: -20 } }, // -20 (a4)
    ]);
  });

  it('a category shared by two groups contributes to both independently, never combined', () => {
    // "Travel" belongs to both "Expense" and "Trips" — each group's own
    // total must count it once, on its own, never summed across groups.
    const expenseGroup: CategoryGroup = { id: 'g1', serialNumber: 1, name: 'Expense', categoryIds: ['cat_travel', 'cat_grocery'] };
    const tripsGroup: CategoryGroup = { id: 'g2', serialNumber: 2, name: 'Trips', categoryIds: ['cat_travel'] };
    const expenseTotal = groupMonthlyTotals(activities, expenseGroup, categories, ['2026-01'])[0].byCurrency.USD;
    const tripsTotal = groupMonthlyTotals(activities, tripsGroup, categories, ['2026-01'])[0].byCurrency.USD;
    expect(expenseTotal).toBe(-150);
    expect(tripsTotal).toBe(-100);
  });

  it('an income-flavored group nets positive', () => {
    const incomeGroup: CategoryGroup = { id: 'g3', serialNumber: 3, name: 'Income', categoryIds: ['cat_income'] };
    const totals = groupMonthlyTotals(activities, incomeGroup, categories, ['2026-01']);
    expect(totals[0].byCurrency.USD).toBe(2000);
  });
});
