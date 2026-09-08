import type { FeeCalculator, Transaction } from '../../types/workbook';
import { sortTransactionsChronological } from './sortTransactions';

export interface ClosedTrade {
  ticker: string;
  /** The originating SELL transaction's stable `id` (see `Transaction.id`'s
   * own doc comment), when it has one — lets a caller aggregate every
   * ClosedTrade produced by ONE sell (a sell that drained more than one buy
   * lot produces several records) back into a single per-row P&L figure for
   * that specific sell transaction, without re-deriving the FIFO match.
   * User's own ask (2026-09-08): "show the sold price and PL w.r.t. that
   * lot's buy price... inline in the main trade row." Undefined only for
   * genuinely id-less legacy data that predates the retrofit. */
  sellTxId?: string;
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
        sellTxId: tx.id,
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

/** Per-sell-transaction realized P&L, for showing inline in the main trade
 * row rather than only in the separate Closed Trades section — user's own
 * ask (2026-09-08): "show the sold price and PL w.r.t. that lot's buy
 * price... inline in the main trade row." A single sell can drain more
 * than one buy lot (several `ClosedTrade` records sharing one `sellTxId`),
 * so this sums across all of them: the row shows ONE net figure for that
 * sell, blending across lots if it touched more than one — matches this
 * project's own existing "the trade row is the unit the user thinks in
 * terms of" convention (same reasoning as `Position`'s own weighted-average
 * roll-up), while the untouched `computeClosedTrades()` output still shows
 * each lot's own separate price/P&L for anyone who wants that detail. */
export function closedPLBySellTxId(trades: ClosedTrade[]): Record<string, { netPL: number; shares: number }> {
  const out: Record<string, { netPL: number; shares: number }> = {};
  for (const t of trades) {
    if (!t.sellTxId) continue;
    if (!out[t.sellTxId]) out[t.sellTxId] = { netPL: 0, shares: 0 };
    out[t.sellTxId].netPL += t.netPL;
    out[t.sellTxId].shares += t.shares;
  }
  return out;
}
