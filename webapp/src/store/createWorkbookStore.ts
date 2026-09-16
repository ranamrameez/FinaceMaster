import { create, type UseBoundStore, type StoreApi } from 'zustand';
import { toInstantMs } from '../lib/datetime';
import { assignSeqForEntities, backfillSeq, nextSeq, nextSeqForEntity } from '../lib/seq';
import { sortTransactionsChronological } from '../lib/calc/sortTransactions';
import type { Adjustment, Dividend, PricePoint, Transaction, TradePlan, Transfer, WatchlistItem } from '../types/workbook';

function chronologicalByInstant<T extends { date: string; time?: string; timezone?: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => toInstantMs(a.date, a.time, a.timezone) - toInstantMs(b.date, b.time, b.timezone));
}

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
  updatePricePoint: (ticker: string, index: number, patch: Partial<PricePoint>) => void;
  deletePricePoint: (ticker: string, index: number) => void;
  addDividend: (d: Dividend) => void;
  updateDividend: (index: number, patch: Partial<Dividend>) => void;
  removeDividend: (index: number) => void;
  setDividendEstimate: (ticker: string, annualPerShare: number) => void;
  updateSettings: (patch: Partial<TWorkbook['settings']>) => void;
  addTradePlan: (plan: TradePlan) => void;
  updateTradePlan: (id: string, patch: Partial<TradePlan>) => void;
  deleteTradePlan: (id: string) => void;
  executeTradePlanLeg: (planId: string, legIndex: number) => void;
}

function syncLatestMarketPrice(marketPrices: Record<string, number>, ticker: string, history: PricePoint[]): Record<string, number> {
  if (!history.length) {
    const next = { ...marketPrices };
    delete next[ticker];
    return next;
  }
  const latest = [...history].sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date)).pop()!;
  return { ...marketPrices, [ticker]: latest.price };
}

export function createWorkbookStore<TWorkbook extends BaseWorkbook<unknown>>(
  storageKey: string,
  createEmpty: () => TWorkbook,
): UseBoundStore<StoreApi<WorkbookStoreState<TWorkbook>>> {
  function normalize(wb: TWorkbook): TWorkbook {
    const transactionsWithId = wb.transactions.map((t) => (t.id ? t : { ...t, id: crypto.randomUUID() }));
    const transfersWithId = wb.transfers.map((t) => (t.id ? t : { ...t, id: crypto.randomUUID() }));
    const adjustmentsWithId = wb.adjustments.map((a) => (a.id ? a : { ...a, id: crypto.randomUUID() }));
    const dividendsWithId = wb.dividends.map((d) => (d.id ? d : { ...d, id: crypto.randomUUID() }));
    const plansWithId = wb.tradePlans.map((p) => ({ ...p, id: p.id || crypto.randomUUID(), legs: p.legs || [] }));
    return {
      ...wb,
      transactions: backfillSeq(transactionsWithId, sortTransactionsChronological(transactionsWithId)),
      transfers: backfillSeq(transfersWithId, chronologicalByInstant(transfersWithId)),
      adjustments: backfillSeq(adjustmentsWithId, chronologicalByInstant(adjustmentsWithId)),
      dividends: backfillSeq(dividendsWithId, chronologicalByInstant(dividendsWithId)),
      tradePlans: plansWithId,
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
      addTransaction: (tx) => mutate((wb) => {
        const seq = tx.seq !== undefined ? tx.seq : nextSeqForEntity(wb.transactions, (t) => t.ticker, tx.ticker);
        const timestamp = tx.timestamp ?? new Date().toISOString();
        const id = tx.id ?? crypto.randomUUID();
        return { ...wb, transactions: [...wb.transactions, { ...tx, id, seq, timestamp }] };
      }),
      addTransactions: (txs) => mutate((wb) => {
        const now = new Date().toISOString();
        const withSeq = assignSeqForEntities(wb.transactions, txs, (t) => t.ticker);
        const withIdAndTimestamp = withSeq.map((t) => ({ ...t, id: t.id ?? crypto.randomUUID(), timestamp: t.timestamp ?? now }));
        return { ...wb, transactions: [...wb.transactions, ...withIdAndTimestamp] };
      }),
      updateTransaction: (index, patch) => mutate((wb) => ({ ...wb, transactions: wb.transactions.map((t, i) => (i === index ? { ...t, ...patch } : t)) })),
      deleteTransaction: (index) => mutate((wb) => ({ ...wb, transactions: wb.transactions.filter((_, i) => i !== index) })),
      addTransfer: (t) => mutate((wb) => {
        const withId = t.id ? t : { ...t, id: crypto.randomUUID() };
        return { ...wb, transfers: [...wb.transfers, { ...withId, seq: withId.seq !== undefined ? withId.seq : nextSeq(wb.transfers), timestamp: withId.timestamp ?? new Date().toISOString() }] };
      }),
      updateTransfer: (id, patch) => mutate((wb) => ({ ...wb, transfers: wb.transfers.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTransfer: (id) => mutate((wb) => ({ ...wb, transfers: wb.transfers.filter((t) => t.id !== id) })),
      addAdjustment: (a) => mutate((wb) => {
        const withId = a.id ? a : { ...a, id: crypto.randomUUID() };
        const seq = withId.seq !== undefined ? withId.seq : nextSeq(wb.adjustments);
        return { ...wb, adjustments: [...wb.adjustments, { ...withId, seq, timestamp: withId.timestamp ?? new Date().toISOString() }] };
      }),
      updateAdjustment: (index, patch) => mutate((wb) => ({ ...wb, adjustments: wb.adjustments.map((a, i) => (i === index ? { ...a, ...patch } : a)) })),
      deleteAdjustment: (index) => mutate((wb) => ({ ...wb, adjustments: wb.adjustments.filter((_, i) => i !== index) })),
      addWatchlistItem: (w) => mutate((wb) => ({ ...wb, watchlist: [...wb.watchlist, w] })),
      updateWatchlistItem: (ticker, patch) => mutate((wb) => ({ ...wb, watchlist: wb.watchlist.map((w) => (w.ticker === ticker ? { ...w, ...patch } : w)) })),
      removeWatchlistItem: (ticker) => mutate((wb) => ({ ...wb, watchlist: wb.watchlist.filter((w) => w.ticker !== ticker) })),
      setMarketPrice: (ticker, price) => mutate((wb) => {
        const today = new Date().toISOString().slice(0, 10);
        const history = wb.priceHistory[ticker] || [];
        const point: PricePoint = { date: today, time: new Date().toISOString(), price };
        return { ...wb, marketPrices: { ...wb.marketPrices, [ticker]: price }, priceHistory: { ...wb.priceHistory, [ticker]: [...history, point] } };
      }),
      updatePricePoint: (ticker, index, patch) => mutate((wb) => {
        const history = wb.priceHistory[ticker] || [];
        if (index < 0 || index >= history.length) return wb;
        const nextHistory = history.map((p, i) => (i === index ? { ...p, ...patch } : p));
        return { ...wb, priceHistory: { ...wb.priceHistory, [ticker]: nextHistory }, marketPrices: syncLatestMarketPrice(wb.marketPrices, ticker, nextHistory) };
      }),
      deletePricePoint: (ticker, index) => mutate((wb) => {
        const history = wb.priceHistory[ticker] || [];
        if (index < 0 || index >= history.length) return wb;
        const nextHistory = history.filter((_, i) => i !== index);
        return { ...wb, priceHistory: { ...wb.priceHistory, [ticker]: nextHistory }, marketPrices: syncLatestMarketPrice(wb.marketPrices, ticker, nextHistory) };
      }),
      addDividend: (d) => mutate((wb) => {
        const withId = d.id ? d : { ...d, id: crypto.randomUUID() };
        const seq = withId.seq !== undefined ? withId.seq : nextSeqForEntity(wb.dividends, (x) => x.ticker, withId.ticker);
        return { ...wb, dividends: [...wb.dividends, { ...withId, seq, timestamp: withId.timestamp ?? new Date().toISOString() }] };
      }),
      updateDividend: (index, patch) => mutate((wb) => ({ ...wb, dividends: wb.dividends.map((d, i) => (i === index ? { ...d, ...patch } : d)) })),
      removeDividend: (index) => mutate((wb) => ({ ...wb, dividends: wb.dividends.filter((_, i) => i !== index) })),
      setDividendEstimate: (ticker, annualPerShare) => mutate((wb) => ({ ...wb, dividendEstimates: { ...wb.dividendEstimates, [ticker]: annualPerShare } })),
      updateSettings: (patch) => mutate((wb) => ({ ...wb, settings: { ...(wb.settings as object), ...patch } as TWorkbook['settings'] })),
      addTradePlan: (plan) => mutate((wb) => ({ ...wb, tradePlans: [...wb.tradePlans, { ...plan, id: plan.id || crypto.randomUUID(), legs: plan.legs || [] }] })),
      updateTradePlan: (id, patch) => mutate((wb) => ({ ...wb, tradePlans: wb.tradePlans.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deleteTradePlan: (id) => mutate((wb) => ({ ...wb, tradePlans: wb.tradePlans.filter((p) => p.id !== id) })),
      executeTradePlanLeg: (planId, legIndex) => mutate((wb) => {
        const plan = wb.tradePlans.find((p) => p.id === planId);
        const leg = plan?.legs[legIndex];
        if (!plan || !leg || leg.executed) return wb;
        const tx: Transaction = { id: crypto.randomUUID(), seq: nextSeqForEntity(wb.transactions, (t) => t.ticker, leg.ticker), timestamp: new Date().toISOString(), date: leg.date || new Date().toISOString().slice(0, 10), ticker: leg.ticker, action: leg.action, shares: leg.shares, price: leg.price, targetLotBuyId: leg.targetLotBuyId };
        return { ...wb, transactions: [...wb.transactions, tx], tradePlans: wb.tradePlans.map((p) => p.id === planId ? { ...p, legs: p.legs.map((l, i) => i === legIndex ? { ...l, executed: true, executedTransactionId: tx.id } : l) } : p) };
      }),
    };
  });
}
