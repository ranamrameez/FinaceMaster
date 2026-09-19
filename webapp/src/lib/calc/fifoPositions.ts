import type { FeeCalculator, Position, RealizedPLPoint, Transaction } from '../../types/workbook';
import { sortTransactionsChronological } from './sortTransactions';

const EPSILON = 1e-7;

export interface FIFOLot {
  buyDate: string;
  buyPrice: number;
  buyFeeTotal: number;
  originalShares: number;
  remainingShares: number;
  buyId?: string;
}

interface TickerState {
  lots: FIFOLot[];
  realized: number;
  buyFees: number;
  sellFees: number;
  totalBoughtShares: number;
  totalSoldShares: number;
  buyCount: number;
  sellCount: number;
  firstDate: string;
  lastDate: string;
}

export interface FIFOResult {
  positions: Position[];
  realizedSeries: RealizedPLPoint[];
  lotsByTicker: Record<string, FIFOLot[]>;
}

export interface LotConsumption<T> {
  lot: T;
  take: number;
}

/** Shared attribution-priority walk for a SELL's shares against a ticker's
 * currently-open lots — used by both `computeFIFOPositions` below (drives
 * the OFFICIAL numbers) and `closedTrades.ts`'s `computeClosedTrades` (a
 * REPORTING ledger), so the two can never disagree about which lots a real
 * sale drew from (closes README Pending item 134, which flagged the two
 * as previously out of sync on this exact point).
 *
 * Priority order (see `Transaction.lotAllocations`/`targetLotBuyId` for the
 * full reasoning): (1) `lotAllocations` in array order, each entry clamped
 * to that lot's real `remainingShares` at that point — a `buyId` that
 * doesn't resolve to a currently-open lot (already fully closed, or
 * unknown) silently contributes 0, never reconsidering a closed lot; (2)
 * `targetLotBuyId` for any remainder not covered by (1); (3) the ordinary
 * `matchOrder` loop over whatever's still open.
 *
 * Mutates each consumed lot's `remainingShares` in place and removes a
 * fully-drained lot from `lots` — callers should NOT also decrement
 * `remainingShares` themselves for what this returns; they should only use
 * the returned `{lot, take}` pairs to compute their own per-portion figures
 * (cost removed, prorated fees, a ClosedTrade record, etc.). */
export function consumeLotsForSell<T extends { remainingShares: number; buyPrice: number; buyId?: string }>(
  lots: T[],
  shares: number,
  matchOrder: LotMatchOrder,
  lotAllocations?: { buyId: string; shares: number }[],
  targetLotBuyId?: string,
): LotConsumption<T>[] {
  const out: LotConsumption<T>[] = [];
  let toSell = shares;

  const takeFrom = (idx: number, want: number) => {
    if (idx === -1 || want <= EPSILON) return;
    const lot = lots[idx];
    const take = Math.min(want, lot.remainingShares);
    if (take <= EPSILON) return;
    lot.remainingShares -= take;
    toSell -= take;
    out.push({ lot, take });
    if (lot.remainingShares <= EPSILON) lots.splice(idx, 1);
  };

  if (lotAllocations) {
    for (const alloc of lotAllocations) {
      if (toSell <= EPSILON) break;
      takeFrom(lots.findIndex((l) => l.buyId === alloc.buyId), Math.min(alloc.shares, toSell));
    }
  }

  if (toSell > EPSILON && targetLotBuyId) {
    takeFrom(lots.findIndex((l) => l.buyId === targetLotBuyId), toSell);
  }

  while (toSell > EPSILON && lots.length) {
    const idx = matchOrder === 'fifo' ? 0 : lots.reduce((bestIdx, l, i) => (l.buyPrice < lots[bestIdx].buyPrice ? i : bestIdx), 0);
    takeFrom(idx, toSell);
  }

  return out;
}

/** Fallback match order used for whatever portion of a SELL isn't covered by
 * `Transaction.lotAllocations`/`targetLotBuyId` (see those fields' own doc
 * comments for the full attribution priority) — i.e. what the engine
 * assumes when nothing more specific is known about which lot(s) a sale
 * drew from. Both options only ever draw from currently-OPEN lots; a fully
 * closed (zero-remaining) lot is spliced out of the array the moment it
 * closes and can never be reconsidered.
 *
 * `'fifo'` (the default, and the recommended "official" choice — see
 * `QSESettings`/`PSXSettings.costBasisMethod`'s own doc comments) consumes
 * the oldest open lot first: this is the global IRS/major-broker default,
 * and for PSX specifically it's the same method NCCPL uses to compute
 * every investor's real, government-mandated Capital Gains Tax through CDC
 * — real-world research done 2026-09-18 at the user's own request ("please
 * study how exchanges handle the trades"), see webapp/README.md's
 * "Cost-basis worked examples" section for the full citations.
 *
 * `'lowestCostFirst'` consumes the cheapest open lot first — kept as a
 * deliberate, permanent second view (the "Trader Strategy" style;
 * `partialTradeStrategy.ts`'s Partial Trade Advisor always uses this one
 * regardless of a workbook's real `costBasisMethod` setting), never the
 * recommended default for the official numbers. */
export type LotMatchOrder = 'fifo' | 'lowestCostFirst';

/** FIFO/specific-lot accounting. Pending orders are excluded. Since this app
 * does not model short positions, an oversize SELL is invalid and is ignored
 * rather than allowing unmatched shares to become zero-cost realized profit. */
export function computeFIFOPositions(transactions: Transaction[], calcFee: FeeCalculator, matchOrder: LotMatchOrder = 'fifo'): FIFOResult {
  const byTicker: Record<string, TickerState> = {};
  const sorted = sortTransactionsChronological(transactions.filter((t) => !t.isPending));
  const realizedSeries: RealizedPLPoint[] = [];
  let runningRealized = 0;

  for (const tx of sorted) {
    const t = tx.ticker;
    if (!byTicker[t]) byTicker[t] = { lots: [], realized: 0, buyFees: 0, sellFees: 0, totalBoughtShares: 0, totalSoldShares: 0, buyCount: 0, sellCount: 0, firstDate: tx.date, lastDate: tx.date };
    const state = byTicker[t];
    if (tx.date < state.firstDate) state.firstDate = tx.date;
    if (tx.date > state.lastDate) state.lastDate = tx.date;

    if (tx.action === 'SELL') {
      const available = state.lots.reduce((sum, lot) => sum + lot.remainingShares, 0);
      if (tx.shares > available + EPSILON) continue;
    }

    const amount = tx.shares * tx.price;
    const isBuy = tx.action === 'BUY';
    const fee = calcFee(amount, isBuy, { shares: tx.shares, tx });

    if (isBuy) {
      state.lots.push({ buyDate: tx.date, buyPrice: tx.price, buyFeeTotal: fee, originalShares: tx.shares, remainingShares: tx.shares, buyId: tx.id });
      state.buyFees += fee;
      state.totalBoughtShares += tx.shares;
      state.buyCount += 1;
    } else {
      const consumed = consumeLotsForSell(state.lots, tx.shares, matchOrder, tx.lotAllocations, tx.targetLotBuyId);
      const costRemoved = consumed.reduce((sum, { lot, take }) => sum + take * (lot.buyPrice + lot.buyFeeTotal / lot.originalShares), 0);
      const realizedDelta = amount - fee - costRemoved;
      state.realized += realizedDelta;
      state.sellFees += fee;
      state.totalSoldShares += tx.shares;
      state.sellCount += 1;
      runningRealized += realizedDelta;
      realizedSeries.push({ date: tx.date, value: runningRealized });
    }
  }

  const positions: Position[] = Object.entries(byTicker).map(([ticker, state]) => {
    const shares = state.lots.reduce((s, l) => s + l.remainingShares, 0);
    const invested = state.lots.reduce((s, l) => s + l.remainingShares * (l.buyPrice + l.buyFeeTotal / l.originalShares), 0);
    return { ticker, shares, invested, buyFees: state.buyFees, sellFees: state.sellFees, realized: state.realized, totalBoughtShares: state.totalBoughtShares, totalSoldShares: state.totalSoldShares, buyCount: state.buyCount, sellCount: state.sellCount, firstDate: state.firstDate, lastDate: state.lastDate };
  });

  const lotsByTicker: Record<string, FIFOLot[]> = {};
  Object.entries(byTicker).forEach(([ticker, state]) => { if (state.lots.length) lotsByTicker[ticker] = state.lots; });
  return { positions, realizedSeries, lotsByTicker };
}
