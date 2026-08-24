import { create, type UseBoundStore, type StoreApi } from 'zustand';
import type { Adjustment, Dividend, PricePoint, Transaction, TradePlan, Transfer, WatchlistItem } from '../types/workbook';

export interface BaseWorkbook<TSettings> {
  settings: TSettings;
  transactions: Transaction[];
  transfers: Transfer[];
  adjustments: Adjustment[];
  marketPrices: Record<string, number>;
  priceHistory: Record<string, PricePoint[]>;
  watchlist: WatchlistItem[];
  dividends: Dividend[];
  dividendEstimates: Record<string, number>;
  tradePlans: TradePlan[];
}

export interface WorkbookStoreState<TWorkbook extends BaseWorkbook<unknown>> {
  workbook: TWorkbook;
  setWorkbook: (wb: TWorkbook, opts?: { skipPersist?: boolean }) => void;
  addTransaction: (tx: Transaction) => void;
  addTransactions: (txs: Transaction[]) => void;
  updateTransaction: (index: number, patch: Partial<Transaction>) => void;
  deleteTransaction: (index: number) => void;
  addTransfer: (t: Transfer) => void;
  updateTransfer: (id: string, patch: Partial<Transfer>) => void;
  deleteTransfer: (id: string) => void;
  addAdjustment: (a: Adjustment) => void;
  updateAdjustment: (index: number, patch: Partial<Adjustment>) => void;
  deleteAdjustment: (index: number) => void;
  addWatchlistItem: (w: WatchlistItem) => void;
  updateWatchlistItem: (ticker: string, patch: Partial<WatchlistItem>) => void;
  removeWatchlistItem: (ticker: string) => void;
  setMarketPrice: (ticker: string, price: number) => void;
  addDividend: (d: Dividend) => void;
  updateDividend: (index: number, patch: Partial<Dividend>) => void;
  removeDividend: (index: number) => void;
  setDividendEstimate: (ticker: string, annualPerShare: number) => void;
  updateSettings: (patch: Partial<TWorkbook['settings']>) => void;
  addTradePlan: (plan: TradePlan) => void;
  updateTradePlan: (id: string, patch: Partial<TradePlan>) => void;
  deleteTradePlan: (id: string) => void;
  /** README item 9's "Mark-As-Done": converts one plan leg into a real
   * Transaction (appended to `transactions`) and flags the leg `executed`,
   * without touching the rest of the plan or requiring the leg's data to be
   * re-typed into the Transactions tab. No-op if the plan/leg doesn't exist
   * or the leg is already executed. */
  executeTradePlanLeg: (planId: string, legIndex: number) => void;
}

/** One implementation of the "local-first, cloud-synced trading workbook"
 * store shape, shared by every exchange (QSE, PSX, ...) instead of each
 * exchange hand-rolling its own copy of the same CRUD actions. */
export function createWorkbookStore<TWorkbook extends BaseWorkbook<unknown>>(
  storageKey: string,
  createEmpty: () => TWorkbook,
): UseBoundStore<StoreApi<WorkbookStoreState<TWorkbook>>> {
  /** Assigns a stable id to any transfer missing one — real user data
   * written before `Transfer` carried `id` (i.e. every transfer recorded
   * before README item 19's cross-entity linking existed) won't have it in
   * storage, and JSON parsing doesn't enforce the TypeScript type. Applied
   * on every path data can enter the store (local load and setWorkbook,
   * which also covers the Firebase pull in useWorkbookCloudSync) so
   * `updateTransfer`/`deleteTransfer` can always address by id.
   *
   * Also restores any `TradePlan.legs` that went missing entirely. Firebase
   * RTDB silently strips any empty array/object value at *any* nesting
   * depth on write — a top-level empty array (e.g. `tradePlans: []`) is
   * already covered by the `{...createEmpty(), ...cloudData}` merge both
   * `loadFromLocalStorage` and the cloud-sync pull use, but a *nested* empty
   * array (a plan's `legs` going to `[]` after removing its last leg) has no
   * such default to fall back on — the plan object just comes back without
   * a `legs` key at all, and every `plan.legs.map/.filter/.reduce` call
   * crashed the whole Trade Planner page. Real user-reproducible bug: delete
   * the last leg of a plan, the debounced push round-trips through Firebase,
   * and the next pulled snapshot has a leg-less plan. */
  function normalize(wb: TWorkbook): TWorkbook {
    return {
      ...wb,
      transfers: wb.transfers.map((t) => (t.id ? t : { ...t, id: crypto.randomUUID() })),
      tradePlans: wb.tradePlans.map((p) => (p.legs ? p : { ...p, legs: [] })),
    };
  }

  function loadFromLocalStorage(): TWorkbook {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return normalize({ ...createEmpty(), ...JSON.parse(raw) });
    } catch (e) {
      console.warn(`Failed to load workbook from localStorage (${storageKey})`, e);
    }
    return createEmpty();
  }

  function persist(workbook: TWorkbook) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(workbook));
    } catch (e) {
      // A failed write here means whatever was just entered did NOT persist —
      // this must never fail silently.
      console.error(`Failed to save workbook to localStorage (${storageKey}) — your last change may not have persisted.`, e);
    }
  }

  return create<WorkbookStoreState<TWorkbook>>((set, get) => {
    const mutate = (updater: (wb: TWorkbook) => TWorkbook) => {
      const next = updater(get().workbook);
      set({ workbook: next });
      persist(next);
    };

    return {
      workbook: loadFromLocalStorage(),

      setWorkbook: (wb, opts) => {
        const next = normalize(wb);
        set({ workbook: next });
        if (!opts?.skipPersist) persist(next);
      },

      addTransaction: (tx) => mutate((wb) => ({ ...wb, transactions: [...wb.transactions, tx] })),

      addTransactions: (txs) => mutate((wb) => ({ ...wb, transactions: [...wb.transactions, ...txs] })),

      updateTransaction: (index, patch) =>
        mutate((wb) => ({
          ...wb,
          transactions: wb.transactions.map((t, i) => (i === index ? { ...t, ...patch } : t)),
        })),

      deleteTransaction: (index) =>
        mutate((wb) => ({ ...wb, transactions: wb.transactions.filter((_, i) => i !== index) })),

      addTransfer: (t) => mutate((wb) => ({ ...wb, transfers: [...wb.transfers, t] })),

      updateTransfer: (id, patch) =>
        mutate((wb) => ({ ...wb, transfers: wb.transfers.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      deleteTransfer: (id) => mutate((wb) => ({ ...wb, transfers: wb.transfers.filter((t) => t.id !== id) })),

      addAdjustment: (a) => mutate((wb) => ({ ...wb, adjustments: [...wb.adjustments, a] })),

      updateAdjustment: (index, patch) =>
        mutate((wb) => ({ ...wb, adjustments: wb.adjustments.map((a, i) => (i === index ? { ...a, ...patch } : a)) })),

      deleteAdjustment: (index) =>
        mutate((wb) => ({ ...wb, adjustments: wb.adjustments.filter((_, i) => i !== index) })),

      addWatchlistItem: (w) => mutate((wb) => ({ ...wb, watchlist: [...wb.watchlist, w] })),

      updateWatchlistItem: (ticker, patch) =>
        mutate((wb) => ({ ...wb, watchlist: wb.watchlist.map((w) => (w.ticker === ticker ? { ...w, ...patch } : w)) })),

      removeWatchlistItem: (ticker) =>
        mutate((wb) => ({ ...wb, watchlist: wb.watchlist.filter((w) => w.ticker !== ticker) })),

      setMarketPrice: (ticker, price) =>
        mutate((wb) => {
          const today = new Date().toISOString().slice(0, 10);
          const history = wb.priceHistory[ticker] || [];
          const point: PricePoint = { date: today, time: new Date().toISOString(), price };
          return {
            ...wb,
            marketPrices: { ...wb.marketPrices, [ticker]: price },
            priceHistory: { ...wb.priceHistory, [ticker]: [...history, point] },
          };
        }),

      addDividend: (d) => mutate((wb) => ({ ...wb, dividends: [...wb.dividends, d] })),

      updateDividend: (index, patch) =>
        mutate((wb) => ({ ...wb, dividends: wb.dividends.map((d, i) => (i === index ? { ...d, ...patch } : d)) })),

      removeDividend: (index) => mutate((wb) => ({ ...wb, dividends: wb.dividends.filter((_, i) => i !== index) })),

      setDividendEstimate: (ticker, annualPerShare) =>
        mutate((wb) => ({ ...wb, dividendEstimates: { ...wb.dividendEstimates, [ticker]: annualPerShare } })),

      updateSettings: (patch) =>
        mutate((wb) => ({ ...wb, settings: { ...(wb.settings as object), ...patch } as TWorkbook['settings'] })),

      addTradePlan: (plan) => mutate((wb) => ({ ...wb, tradePlans: [...wb.tradePlans, plan] })),

      updateTradePlan: (id, patch) =>
        mutate((wb) => ({
          ...wb,
          tradePlans: wb.tradePlans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      deleteTradePlan: (id) =>
        mutate((wb) => ({ ...wb, tradePlans: wb.tradePlans.filter((p) => p.id !== id) })),

      executeTradePlanLeg: (planId, legIndex) =>
        mutate((wb) => {
          const plan = wb.tradePlans.find((p) => p.id === planId);
          const leg = plan?.legs[legIndex];
          if (!plan || !leg || leg.executed) return wb;
          const tx: Transaction = {
            date: leg.date || new Date().toISOString().slice(0, 10),
            ticker: leg.ticker,
            action: leg.action,
            shares: leg.shares,
            price: leg.price,
          };
          return {
            ...wb,
            transactions: [...wb.transactions, tx],
            tradePlans: wb.tradePlans.map((p) =>
              p.id === planId ? { ...p, legs: p.legs.map((l, i) => (i === legIndex ? { ...l, executed: true } : l)) } : p,
            ),
          };
        }),
    };
  });
}
