import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkbookStore, type BaseWorkbook } from '../createWorkbookStore';

interface TestSettings {
  currency: string;
}

type TestWorkbook = BaseWorkbook<TestSettings>;

function createEmptyTestWorkbook(): TestWorkbook {
  return {
    settings: { currency: 'USD' },
    transactions: [],
    transfers: [],
    adjustments: [],
    marketPrices: {},
    priceHistory: {},
    watchlist: [],
    dividends: [],
    dividendEstimates: {},
    tradePlans: [],
  };
}

const STORAGE_KEY = 'test_workbook_normalize_v1';

describe('createWorkbookStore normalize', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('restores a missing `legs` array on a trade plan (Firebase RTDB drops empty nested arrays)', () => {
    // Simulates the real bug: a plan's `legs` was emptied (its last leg
    // removed), pushed to Firebase, and RTDB stripped the now-empty array
    // key entirely from the stored object — so the pulled snapshot's plan
    // object has no `legs` key at all, not `legs: []`.
    const corruptPlan = { id: 'p1', name: 'Test Plan', createdAt: '2026-08-01' } as unknown;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...createEmptyTestWorkbook(), tradePlans: [corruptPlan] }),
    );

    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    const plan = useStore.getState().workbook.tradePlans[0];
    expect(plan.legs).toEqual([]);
  });

  it('leaves a trade plan with real legs untouched', () => {
    const leg = { date: '2026-08-01', ticker: 'QGTS', action: 'BUY' as const, shares: 100, price: 10 };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...createEmptyTestWorkbook(),
        tradePlans: [{ id: 'p1', name: 'Test Plan', createdAt: '2026-08-01', legs: [leg] }],
      }),
    );

    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    expect(useStore.getState().workbook.tradePlans[0].legs).toEqual([leg]);
  });

  it('also normalizes a corrupted plan when it arrives via setWorkbook (the cloud-sync pull path)', () => {
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    const corruptPlan = { id: 'p1', name: 'From cloud', createdAt: '2026-08-01' } as unknown;
    useStore.getState().setWorkbook({
      ...createEmptyTestWorkbook(),
      tradePlans: [corruptPlan as never],
    });
    expect(useStore.getState().workbook.tradePlans[0].legs).toEqual([]);
  });

  it('still assigns ids to transfers missing one on load', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...createEmptyTestWorkbook(),
        transfers: [{ date: '2026-08-01', type: 'DEPOSIT', gross: 10, fee: 0 }],
      }),
    );
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    expect(useStore.getState().workbook.transfers[0].id).toBeTruthy();
  });
});
