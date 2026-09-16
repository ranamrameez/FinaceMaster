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
      let toSell = tx.shares;
      let costRemoved = 0;
      if (tx.targetLotBuyId) {
        const idx = state.lots.findIndex((l) => l.buyId === tx.targetLotBuyId);
        if (idx !== -1) {
          const lot = state.lots[idx];
          const take = Math.min(toSell, lot.remainingShares);
          const costPerShare = lot.buyPrice + lot.buyFeeTotal / lot.originalShares;
          costRemoved += take * costPerShare;
          lot.remainingShares -= take;
          toSell -= take;
          if (lot.remainingShares <= EPSILON) state.lots.splice(idx, 1);
        }
      }
      while (toSell > EPSILON && state.lots.length) {
        const lotIndex = matchOrder === 'fifo' ? 0 : state.lots.reduce((bestIdx, l, i) => (l.buyPrice < state.lots[bestIdx].buyPrice ? i : bestIdx), 0);
        const lot = state.lots[lotIndex];
        const take = Math.min(toSell, lot.remainingShares);
        const costPerShare = lot.buyPrice + lot.buyFeeTotal / lot.originalShares;
        costRemoved += take * costPerShare;
        lot.remainingShares -= take;
        toSell -= take;
        if (lot.remainingShares <= EPSILON) state.lots.splice(lotIndex, 1);
      }
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
