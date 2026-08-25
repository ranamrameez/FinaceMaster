import type { FeeCalculator, Position, RealizedPLPoint, Transaction } from '../../types/workbook';
import { sortTransactionsChronological } from './sortTransactions';

const EPSILON = 1e-7;

export interface FIFOLot {
  buyDate: string;
  buyPrice: number;
  /** Total fee paid on the original buy, kept whole (not per-share) so it
   * can be re-divided by whatever `originalShares` still applies. */
  buyFeeTotal: number;
  originalShares: number;
  remainingShares: number;
}

interface TickerState {
  lots: FIFOLot[]; // open lots, oldest first (queue)
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
  /** ticker -> still-open lots, oldest first — the per-lot view README item
   * 8 asks for ("each buy should have its own sell peer"), for display and
   * (via each lot's own buy transaction) manual reconciliation. */
  lotsByTicker: Record<string, FIFOLot[]>;
}

/** README item 8: FIFO lot matching — each buy is tracked as its own lot;
 * a sell consumes the oldest open lot(s) first instead of blending into one
 * running average cost (`computePositions`'s weighted-average convention).
 * This gives lot-accurate realized P/L, at the cost of being a genuinely
 * different number than the weighted-average result once a ticker has been
 * bought at different prices across multiple lots — that's the point, not
 * a bug, but it's exactly why this is opt-in (`PSXSettings.costBasisMethod`)
 * rather than silently replacing the default for existing users' history.
 *
 * Selling more shares than are held (a data-entry error, not a real
 * scenario) drains all open lots and treats any remaining oversold shares
 * as zero-cost-basis, same as `computePositions`' epsilon-clamp-to-zero. */
export function computeFIFOPositions(transactions: Transaction[], calcFee: FeeCalculator): FIFOResult {
  const byTicker: Record<string, TickerState> = {};
  const sorted = sortTransactionsChronological(transactions);
  const realizedSeries: RealizedPLPoint[] = [];
  let runningRealized = 0;

  for (const tx of sorted) {
    const t = tx.ticker;
    if (!byTicker[t]) {
      byTicker[t] = {
        lots: [],
        realized: 0,
        buyFees: 0,
        sellFees: 0,
        totalBoughtShares: 0,
        totalSoldShares: 0,
        buyCount: 0,
        sellCount: 0,
        firstDate: tx.date,
        lastDate: tx.date,
      };
    }
    const state = byTicker[t];
    if (tx.date < state.firstDate) state.firstDate = tx.date;
    if (tx.date > state.lastDate) state.lastDate = tx.date;

    const amount = tx.shares * tx.price;
    const isBuy = tx.action === 'BUY';
    const fee = calcFee(amount, isBuy, { shares: tx.shares, tx });

    if (isBuy) {
      state.lots.push({ buyDate: tx.date, buyPrice: tx.price, buyFeeTotal: fee, originalShares: tx.shares, remainingShares: tx.shares });
      state.buyFees += fee;
      state.totalBoughtShares += tx.shares;
      state.buyCount += 1;
    } else {
      let toSell = tx.shares;
      let costRemoved = 0;
      while (toSell > EPSILON && state.lots.length) {
        const lot = state.lots[0];
        const take = Math.min(toSell, lot.remainingShares);
        const costPerShare = lot.buyPrice + lot.buyFeeTotal / lot.originalShares;
        costRemoved += take * costPerShare;
        lot.remainingShares -= take;
        toSell -= take;
        if (lot.remainingShares <= EPSILON) state.lots.shift();
      }
      const proceeds = amount - fee;
      const realizedDelta = proceeds - costRemoved;
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
    return {
      ticker,
      shares,
      invested,
      buyFees: state.buyFees,
      sellFees: state.sellFees,
      realized: state.realized,
      totalBoughtShares: state.totalBoughtShares,
      totalSoldShares: state.totalSoldShares,
      buyCount: state.buyCount,
      sellCount: state.sellCount,
      firstDate: state.firstDate,
      lastDate: state.lastDate,
    };
  });

  const lotsByTicker: Record<string, FIFOLot[]> = {};
  Object.entries(byTicker).forEach(([ticker, state]) => {
    if (state.lots.length) lotsByTicker[ticker] = state.lots;
  });

  return { positions, realizedSeries, lotsByTicker };
}
