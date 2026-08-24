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

  it('also assigns ids to transactions missing one on load', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...createEmptyTestWorkbook(),
        transactions: [{ date: '2026-08-01', ticker: 'QGTS', action: 'BUY', shares: 100, price: 10 }],
      }),
    );
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    expect(useStore.getState().workbook.transactions[0].id).toBeTruthy();
  });

  it('executeTradePlanLeg links the leg to the transaction it creates, so a later edit stays visible from the plan', () => {
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    const leg = { date: '2026-08-01', ticker: 'QGTS', action: 'BUY' as const, shares: 100, price: 10 };
    useStore.getState().addTradePlan({ id: 'p1', name: 'Plan', createdAt: '2026-08-01', legs: [leg] });
    useStore.getState().executeTradePlanLeg('p1', 0);

    const state = useStore.getState();
    const savedLeg = state.workbook.tradePlans[0].legs[0];
    expect(savedLeg.executed).toBe(true);
    expect(savedLeg.executedTransactionId).toBeTruthy();
    const linkedTx = state.workbook.transactions.find((t) => t.id === savedLeg.executedTransactionId);
    expect(linkedTx).toBeTruthy();
    expect(linkedTx?.shares).toBe(100);

    // Editing the transaction elsewhere (e.g. the Transactions page) — the
    // leg's link should still resolve to the updated, not stale, data.
    useStore.getState().updateTransaction(0, { shares: 150, price: 12 });
    const updatedTx = useStore.getState().workbook.transactions.find((t) => t.id === savedLeg.executedTransactionId);
    expect(updatedTx?.shares).toBe(150);
    expect(updatedTx?.price).toBe(12);
  });
});
