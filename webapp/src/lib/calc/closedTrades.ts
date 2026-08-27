import type { FeeCalculator, Transaction } from '../../types/workbook';
import { sortTransactionsChronological } from './sortTransactions';

export interface ClosedTrade {
  ticker: string;
  buyDate: string;
  buyPrice: number;
  /** Fee for just the matched shares of the original buy (prorated if the
   * buy lot was split across multiple sells). */
  buyFee: number;
  sellDate: string;
  sellPrice: number;
  /** Fee for just the matched shares of the sell (prorated if one sell
   * transaction drained more than one buy lot). */
  sellFee: number;
  shares: number;
  netPL: number;
  holdingDays: number;
}

interface OpenLot {
  buyDate: string;
  buyPrice: number;
  buyFeeTotal: number;
  originalShares: number;
  remainingShares: number;
}

const EPSILON = 1e-7;

/**
 * Reconstructs a per-trade closed ledger via FIFO matching: every sold share
 * is matched against the oldest still-open buy lot for that ticker, and each
 * match becomes its own record carrying that specific buy price/sell price/
 * fees/net P&L. A sell that drains more than one buy lot produces one
 * ClosedTrade per lot it touches (a partial fill against an older lot and a
 * partial fill against a newer one are two separate, individually-priced
 * records, not blended into one average); a buy lot split across multiple
 * sells produces one ClosedTrade per sell that touched it, each carrying its
 * own prorated share of that buy's fee.
 *
 * This is a REPORTING ledger only — independent of and never feeding back
 * into `computePositions`'s weighted-average rollup or the opt-in
 * `computeFIFOPositions`. User's own framing for why this exists:
 * "Individual stock should be marked as open/close with its own buy &
 * selling price, B&S taxes, net Buy/sale, so that sold/closed shares do not
 * ruin the calcs" — giving each closed round-trip its own itemized record
 * makes explicit that a closed trade's numbers are separate from whatever
 * the currently-open position's own average cost/break-even shows.
 */
export function computeClosedTrades(transactions: Transaction[], calcFee: FeeCalculator): ClosedTrade[] {
  const lotsByTicker: Record<string, OpenLot[]> = {};
  const trades: ClosedTrade[] = [];
  const sorted = sortTransactionsChronological(transactions);

  for (const tx of sorted) {
    const t = tx.ticker;
    if (!lotsByTicker[t]) lotsByTicker[t] = [];
    const lots = lotsByTicker[t];
    const amount = tx.shares * tx.price;
    const isBuy = tx.action === 'BUY';
    const fee = calcFee(amount, isBuy, { shares: tx.shares, tx });

    if (isBuy) {
      lots.push({ buyDate: tx.date, buyPrice: tx.price, buyFeeTotal: fee, originalShares: tx.shares, remainingShares: tx.shares });
      continue;
    }

    let toSell = tx.shares;
    const sellFeePerShare = tx.shares > 0 ? fee / tx.shares : 0;
    while (toSell > EPSILON && lots.length) {
      const lot = lots[0];
      const take = Math.min(toSell, lot.remainingShares);
      const buyFeeShare = (take / lot.originalShares) * lot.buyFeeTotal;
      const sellFeeShare = take * sellFeePerShare;
      const netPL = take * tx.price - sellFeeShare - (take * lot.buyPrice + buyFeeShare);
      const buyMs = new Date(lot.buyDate).getTime();
      const sellMs = new Date(tx.date).getTime();
      const holdingDays = Math.max(0, Math.round((sellMs - buyMs) / 86400000));
      trades.push({
        ticker: t,
        buyDate: lot.buyDate,
        buyPrice: lot.buyPrice,
        buyFee: buyFeeShare,
        sellDate: tx.date,
        sellPrice: tx.price,
        sellFee: sellFeeShare,
        shares: take,
        netPL,
        holdingDays,
      });
      lot.remainingShares -= take;
      toSell -= take;
      if (lot.remainingShares <= EPSILON) lots.shift();
    }
  }

  return trades;
}
