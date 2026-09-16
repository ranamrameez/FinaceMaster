import { beforeEach, describe, expect, it } from 'vitest';
import { mergeCategoriesEverywhere } from '../categoryMerge';
import { useCashWorkbookStore } from '../../store/cashWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../store/plannedCashWorkbookStore';
import { useBankWorkbookStore } from '../../store/bankWorkbookStore';
import { useFundsWorkbookStore } from '../../store/fundsWorkbookStore';
import { useSubscriptionsWorkbookStore } from '../../store/subscriptionsWorkbookStore';
import { useCreditCardWorkbookStore } from '../../store/creditCardWorkbookStore';
import { useCategoryStore } from '../../store/categoryStore';

beforeEach(() => {
  localStorage.clear();
});

describe('mergeCategoriesEverywhere', () => {
  it('repoints real (id-based) and planned (name-based) records, and removes the merged category', () => {
    // Real, id-based: Cash.
    useCashWorkbookStore.getState().addEntry({
      id: 'c1', date: '2026-01-01', isDeposit: false, amount: 10, currencyCode: 'USD', source: 'manual', categoryID: 'cat_ignore_count',
    });
    // Planned, name-based: Cash (never migrated to categoryID, see Finance's own doc comment).
    usePlannedCashWorkbookStore.getState().addEntry({
      id: 'p1', date: '2026-01-01', type: 'OUT', amount: 5, currencyCode: 'USD', category: 'IgnoreCount',
    });
    // Real, id-based: Bank.
    useBankWorkbookStore.getState().addAccount({ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 });
    useBankWorkbookStore.getState().addTransaction({
      id: 'b1', accountId: 'a1', date: '2026-01-01', amount: -20, description: 'x', categoryID: 'cat_ignore_count',
      source: 'manual', isDeposit: false,
    });
    // Also-touched module: Funds.
    useFundsWorkbookStore.getState().setWorkbook({
      ...useFundsWorkbookStore.getState().workbook,
      funds: [{ id: 'f1', name: 'Index Fund', code: 'VT', platform: 'Fidelity', category: 'Equity', currencyCode: 'USD', categoryID: 'cat_ignore_count' }],
    });
    // Also-touched module: Subscriptions.
    useSubscriptionsWorkbookStore.getState().addEntry({
      id: 's1', name: 'Netflix', amount: 15, currencyCode: 'USD', billingCycle: 'monthly', startDate: '2026-01-01', active: true, categoryID: 'cat_ignore_count',
    });
    // Also-touched module: Credit Card.
    useCreditCardWorkbookStore.getState().addTransaction({
      id: 't1', cardId: 'card1', date: '2026-01-01', kind: 'charge', amount: 30, description: 'x', categoryID: 'cat_ignore_count',
    });
    // An unrelated record (different category) must NOT be touched.
    useCashWorkbookStore.getState().addEntry({
      id: 'c2', date: '2026-01-02', isDeposit: false, amount: 99, currencyCode: 'USD', source: 'manual', categoryID: 'cat_grocery',
    });

    const touched = mergeCategoriesEverywhere('cat_ignore_count', 'cat_ignore');

    // 5 id-based records touched (c1, b1, f1, s1, t1) + 1 name-based (p1) = 6.
    expect(touched).toBe(6);

    expect(useCashWorkbookStore.getState().workbook.entries.find((e) => e.id === 'c1')?.categoryID).toBe('cat_ignore');
    expect(useCashWorkbookStore.getState().workbook.entries.find((e) => e.id === 'c2')?.categoryID).toBe('cat_grocery');
    expect(usePlannedCashWorkbookStore.getState().workbook.entries.find((e) => e.id === 'p1')?.category).toBe('Ignore');
    expect(useBankWorkbookStore.getState().workbook.transactions.find((t) => t.id === 'b1')?.categoryID).toBe('cat_ignore');
    expect(useFundsWorkbookStore.getState().workbook.funds.find((f) => f.id === 'f1')?.categoryID).toBe('cat_ignore');
    expect(useSubscriptionsWorkbookStore.getState().workbook.entries.find((s) => s.id === 's1')?.categoryID).toBe('cat_ignore');
    expect(useCreditCardWorkbookStore.getState().workbook.transactions.find((t) => t.id === 't1')?.categoryID).toBe('cat_ignore');

    // The merged-away category is gone from the registry; the survivor stays.
    const categories = useCategoryStore.getState().workbook.categories;
    expect(categories.find((c) => c.id === 'cat_ignore_count')).toBeUndefined();
    expect(categories.find((c) => c.id === 'cat_ignore')).toBeDefined();
  });

  it('returns 0 and still removes the category when nothing was ever tagged with it', () => {
    const touched = mergeCategoriesEverywhere('cat_ignore_count', 'cat_ignore');
    expect(touched).toBe(0);
    expect(useCategoryStore.getState().workbook.categories.find((c) => c.id === 'cat_ignore_count')).toBeUndefined();
  });
});
