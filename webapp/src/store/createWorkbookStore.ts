import { create, type UseBoundStore, type StoreApi } from 'zustand';
import { toInstantMs } from '../lib/datetime';
import { assignSeqForEntities, backfillSeq, nextSeq, nextSeqForEntity } from '../lib/seq';
import { sortTransactionsChronological } from '../lib/calc/sortTransactions';
import type { Adjustment, Dividend, PricePoint, Transaction, TradePlan, Transfer, WatchlistItem } from '../types/workbook';

/** Chronological order for a record type with `date`/`time`/`timezone` but
 * no `action` field (Transfer/Adjustment/Dividend) — used only to decide
 * `seq` assignment order when backfilling; not a general-purpose export
 * since `sortTransactionsChronological` already covers the one type
 * (`Transaction`) that needs the extra BUY-before-SELL domain rule. */
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
  /** Corrects a specific PAST price-history entry (user-requested
   * 2026-08-27: "the option to change the past current prices" — `setMarketPrice`
   * only ever appends a new point for *today*, with no way to fix a mistake
   * already on record). `PricePoint` has no stable id (unlike `Transaction`/
   * `Transfer`), so this addresses by array index within `priceHistory[ticker]`,
   * same convention as `updateAdjustment`. If the edited point was the
   * chronologically LATEST for that ticker, `marketPrices[ticker]` (the
   * separate cached "current price" `getMarketPrice()` prefers) is
   * recomputed from the updated history so the two never drift apart. */
  updatePricePoint: (ticker: string, index: number, patch: Partial<PricePoint>) => void;
  /** Same addressing/resync rule as `updatePricePoint`, for removing a
   * mistaken entry entirely rather than correcting it. */
  deletePricePoint: (ticker: string, index: number) => void;
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

/** Recomputes `marketPrices[ticker]` (the cached "current price"
 * `getMarketPrice()` prefers over deriving one from transactions) from
 * whatever's chronologically latest in an UPDATED `priceHistory[ticker]` —
 * used by `updatePricePoint`/`deletePricePoint` so editing or removing the
 * point that WAS the latest can't leave a stale cached price behind. Same
 * `(a.time || a.date)` sort key `computePriceStats` uses, so "latest"
 * means the same thing everywhere. Leaves every OTHER ticker's cached
 * price untouched. */
function syncLatestMarketPrice(marketPrices: Record<string, number>, ticker: string, history: PricePoint[]): Record<string, number> {
  if (!history.length) {
    const next = { ...marketPrices };
    delete next[ticker];
    return next;
  }
  const latest = [...history].sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date)).pop()!;
  return { ...marketPrices, [ticker]: latest.price };
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
    const transactionsWithId = wb.transactions.map((t) => (t.id ? t : { ...t, id: crypto.randomUUID() }));
    const transfersWithId = wb.transfers.map((t) => (t.id ? t : { ...t, id: crypto.randomUUID() }));
    const adjustmentsWithId = wb.adjustments.map((a) => (a.id ? a : { ...a, id: crypto.randomUUID() }));
    const dividendsWithId = wb.dividends.map((d) => (d.id ? d : { ...d, id: crypto.randomUUID() }));
    return {
      ...wb,
      transactions: backfillSeq(transactionsWithId, sortTransactionsChronological(transactionsWithId)),
      transfers: backfillSeq(transfersWithId, chronologicalByInstant(transfersWithId)),
      adjustments: backfillSeq(adjustmentsWithId, chronologicalByInstant(adjustmentsWithId)),
      dividends: backfillSeq(dividendsWithId, chronologicalByInstant(dividendsWithId)),
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

      addTransaction: (tx) =>
        mutate((wb) => {
          const seq = tx.seq !== undefined ? tx.seq : nextSeqForEntity(wb.transactions, (t) => t.ticker, tx.ticker);
          const timestamp = tx.timestamp ?? new Date().toISOString();
          return { ...wb, transactions: [...wb.transactions, { ...tx, seq, timestamp }] };
        }),

      // A batch can span multiple tickers (e.g. a statement import) — each
      // ticker's own new rows are numbered independently (see
      // `assignSeqForEntities`'s own doc comment).
      addTransactions: (txs) =>
        mutate((wb) => {
          const now = new Date().toISOString();
          const withSeq = assignSeqForEntities(wb.transactions, txs, (t) => t.ticker);
          const withTimestamp = withSeq.map((t) => ({ ...t, timestamp: t.timestamp ?? now }));
          return { ...wb, transactions: [...wb.transactions, ...withTimestamp] };
        }),

      updateTransaction: (index, patch) =>
        mutate((wb) => ({
          ...wb,
          transactions: wb.transactions.map((t, i) => (i === index ? { ...t, ...patch } : t)),
        })),

      deleteTransaction: (index) =>
        mutate((wb) => ({ ...wb, transactions: wb.transactions.filter((_, i) => i !== index) })),

      // No natural owning entity for a Transfer (it's a portfolio-level cash
      // movement, not tied to one ticker) — stays scoped to the whole array.
      addTransfer: (t) =>
        mutate((wb) => ({
          ...wb,
          transfers: [...wb.transfers, { ...t, seq: t.seq !== undefined ? t.seq : nextSeq(wb.transfers), timestamp: t.timestamp ?? new Date().toISOString() }],
        })),

      updateTransfer: (id, patch) =>
        mutate((wb) => ({ ...wb, transfers: wb.transfers.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      deleteTransfer: (id) => mutate((wb) => ({ ...wb, transfers: wb.transfers.filter((t) => t.id !== id) })),

      // No natural owning entity for an Adjustment either — stays scoped to
      // the whole array, same as Transfer above.
      addAdjustment: (a) =>
        mutate((wb) => {
          const withId = a.id ? a : { ...a, id: crypto.randomUUID() };
          const seq = withId.seq !== undefined ? withId.seq : nextSeq(wb.adjustments);
          return { ...wb, adjustments: [...wb.adjustments, { ...withId, seq, timestamp: withId.timestamp ?? new Date().toISOString() }] };
        }),

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

      updatePricePoint: (ticker, index, patch) =>
        mutate((wb) => {
          const history = wb.priceHistory[ticker] || [];
          if (index < 0 || index >= history.length) return wb;
          const nextHistory = history.map((p, i) => (i === index ? { ...p, ...patch } : p));
          return {
            ...wb,
            priceHistory: { ...wb.priceHistory, [ticker]: nextHistory },
            marketPrices: syncLatestMarketPrice(wb.marketPrices, ticker, nextHistory),
          };
        }),

      deletePricePoint: (ticker, index) =>
        mutate((wb) => {
          const history = wb.priceHistory[ticker] || [];
          if (index < 0 || index >= history.length) return wb;
          const nextHistory = history.filter((_, i) => i !== index);
          return {
            ...wb,
            priceHistory: { ...wb.priceHistory, [ticker]: nextHistory },
            marketPrices: syncLatestMarketPrice(wb.marketPrices, ticker, nextHistory),
          };
        }),

      addDividend: (d) =>
        mutate((wb) => {
          const withId = d.id ? d : { ...d, id: crypto.randomUUID() };
          const seq = withId.seq !== undefined ? withId.seq : nextSeqForEntity(wb.dividends, (x) => x.ticker, withId.ticker);
          return { ...wb, dividends: [...wb.dividends, { ...withId, seq, timestamp: withId.timestamp ?? new Date().toISOString() }] };
        }),

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
            id: crypto.randomUUID(),
            seq: nextSeqForEntity(wb.transactions, (t) => t.ticker, leg.ticker),
            timestamp: new Date().toISOString(),
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
              p.id === planId
                ? { ...p, legs: p.legs.map((l, i) => (i === legIndex ? { ...l, executed: true, executedTransactionId: tx.id } : l)) }
                : p,
            ),
          };
        }),
    };
  });
}
