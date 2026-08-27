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

  it('backfills seq onto real pre-existing data missing it, in date order (not raw array order)', () => {
    // Stored (original) array order is out of chronological order —
    // simulates a real workbook where the array itself doesn't reflect
    // true entry history.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...createEmptyTestWorkbook(),
        transactions: [
          { id: 'later', date: '2026-08-05', ticker: 'QGTS', action: 'BUY', shares: 1, price: 10 },
          { id: 'earlier', date: '2026-08-01', ticker: 'QGTS', action: 'BUY', shares: 1, price: 10 },
        ],
      }),
    );
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    const txs = useStore.getState().workbook.transactions;
    const byId = Object.fromEntries(txs.map((t) => [t.id, t.seq]));
    expect(byId.earlier).toBeLessThan(byId.later as number);
    // Original stored array order is untouched — only the missing field
    // gets filled in, this must not silently reorder anything.
    expect(txs.map((t) => t.id)).toEqual(['later', 'earlier']);
  });

  it('addTransaction assigns an increasing seq to each new transaction', () => {
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    useStore.getState().addTransaction({ date: '2026-08-01', ticker: 'QGTS', action: 'BUY', shares: 1, price: 10 });
    useStore.getState().addTransaction({ date: '2026-08-01', ticker: 'QGTS', action: 'BUY', shares: 1, price: 10 });
    const [first, second] = useStore.getState().workbook.transactions;
    expect(second.seq).toBe((first.seq as number) + 1);
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

  it('updatePricePoint corrects a past entry and re-syncs marketPrices when it was the latest', () => {
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    useStore.getState().setWorkbook({
      ...createEmptyTestWorkbook(),
      priceHistory: {
        QGTS: [
          { date: '2026-08-01', time: '2026-08-01T09:00:00.000Z', price: 10 },
          { date: '2026-08-02', time: '2026-08-02T09:00:00.000Z', price: 11 },
        ],
      },
      marketPrices: { QGTS: 11 },
    });

    // Correct the LATEST point (index 1) — marketPrices should follow it.
    useStore.getState().updatePricePoint('QGTS', 1, { price: 12 });
    let state = useStore.getState();
    expect(state.workbook.priceHistory.QGTS[1].price).toBe(12);
    expect(state.workbook.marketPrices.QGTS).toBe(12);

    // Correct an OLDER point (index 0) — marketPrices (still driven by the
    // now-12 latest point) should be unaffected.
    useStore.getState().updatePricePoint('QGTS', 0, { price: 9 });
    state = useStore.getState();
    expect(state.workbook.priceHistory.QGTS[0].price).toBe(9);
    expect(state.workbook.marketPrices.QGTS).toBe(12);
  });

  it('deletePricePoint removes an entry and re-syncs marketPrices, clearing it if history becomes empty', () => {
    const useStore = createWorkbookStore(STORAGE_KEY, createEmptyTestWorkbook);
    useStore.getState().setWorkbook({
      ...createEmptyTestWorkbook(),
      priceHistory: {
        QGTS: [
          { date: '2026-08-01', time: '2026-08-01T09:00:00.000Z', price: 10 },
          { date: '2026-08-02', time: '2026-08-02T09:00:00.000Z', price: 11 },
        ],
      },
      marketPrices: { QGTS: 11 },
    });

    // Delete the latest point — the remaining point (10) becomes latest.
    useStore.getState().deletePricePoint('QGTS', 1);
    let state = useStore.getState();
    expect(state.workbook.priceHistory.QGTS).toHaveLength(1);
    expect(state.workbook.marketPrices.QGTS).toBe(10);

    // Delete the last remaining point — marketPrices for this ticker clears
    // entirely rather than leaving a stale cached price.
    useStore.getState().deletePricePoint('QGTS', 0);
    state = useStore.getState();
    expect(state.workbook.priceHistory.QGTS).toHaveLength(0);
    expect(state.workbook.marketPrices.QGTS).toBeUndefined();
  });
});
