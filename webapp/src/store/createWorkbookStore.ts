import { create, type UseBoundStore, type StoreApi } from 'zustand';
import type { Adjustment, Dividend, PricePoint, Transaction, Transfer, WatchlistItem } from '../types/workbook';

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
}

export interface WorkbookStoreState<TWorkbook extends BaseWorkbook<unknown>> {
  workbook: TWorkbook;
  setWorkbook: (wb: TWorkbook, opts?: { skipPersist?: boolean }) => void;
  addTransaction: (tx: Transaction) => void;
  addTransactions: (txs: Transaction[]) => void;
  updateTransaction: (index: number, patch: Partial<Transaction>) => void;
  deleteTransaction: (index: number) => void;
  addTransfer: (t: Transfer) => void;
  deleteTransfer: (index: number) => void;
  addAdjustment: (a: Adjustment) => void;
  deleteAdjustment: (index: number) => void;
  addWatchlistItem: (w: WatchlistItem) => void;
  removeWatchlistItem: (ticker: string) => void;
  setMarketPrice: (ticker: string, price: number) => void;
  addDividend: (d: Dividend) => void;
  removeDividend: (index: number) => void;
  setDividendEstimate: (ticker: string, annualPerShare: number) => void;
  updateSettings: (patch: Partial<TWorkbook['settings']>) => void;
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

      deleteTransfer: (index) => mutate((wb) => ({ ...wb, transfers: wb.transfers.filter((_, i) => i !== index) })),

      addAdjustment: (a) => mutate((wb) => ({ ...wb, adjustments: [...wb.adjustments, a] })),

      deleteAdjustment: (index) =>
        mutate((wb) => ({ ...wb, adjustments: wb.adjustments.filter((_, i) => i !== index) })),

      addWatchlistItem: (w) => mutate((wb) => ({ ...wb, watchlist: [...wb.watchlist, w] })),

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

      removeDividend: (index) => mutate((wb) => ({ ...wb, dividends: wb.dividends.filter((_, i) => i !== index) })),

      setDividendEstimate: (ticker, annualPerShare) =>
        mutate((wb) => ({ ...wb, dividendEstimates: { ...wb.dividendEstimates, [ticker]: annualPerShare } })),

      updateSettings: (patch) =>
        mutate((wb) => ({ ...wb, settings: { ...(wb.settings as object), ...patch } as TWorkbook['settings'] })),
    };
  });
}
