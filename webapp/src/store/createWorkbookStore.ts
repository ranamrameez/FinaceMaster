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
  updateTransfer: (index: number, patch: Partial<Transfer>) => void;
  deleteTransfer: (index: number) => void;
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
  function loadFromLocalStorage(): TWorkbook {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...createEmpty(), ...JSON.parse(raw) };
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
        set({ workbook: wb });
        if (!opts?.skipPersist) persist(wb);
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

      updateTransfer: (index, patch) =>
        mutate((wb) => ({ ...wb, transfers: wb.transfers.map((t, i) => (i === index ? { ...t, ...patch } : t)) })),

      deleteTransfer: (index) => mutate((wb) => ({ ...wb, transfers: wb.transfers.filter((_, i) => i !== index) })),

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
