import { breakEvenPrice } from './fees';
import type { FeeCalculator, TradePlanLeg } from '../../types/workbook';

export interface RealHolding {
  ticker: string;
  shares: number;
  invested: number;
}

export interface TradePlanTickerSummary {
  ticker: string;
  /** Shares this plan intends to buy (not yet executed). */
  planBought: number;
  /** Shares this plan intends to sell (not yet executed). */
  planSold: number;
  /** Shares left holding after every planned buy and sell in this plan
   * executes, on top of whatever real position already exists. */
  effectiveShares: number;
  /** Blended cost basis per share: real holding (if any) plus this plan's
   * own buy legs — i.e. "my average cost once this plan's buys execute,"
   * not just the plan's own legs in isolation. A sell-only plan (planning
   * to sell an existing position, no buy legs of its own) still gets a
   * meaningful average cost from the real holding alone. */
  avgCost: number;
  /** Fee-aware break-even sale price for `avgCost`/`effectiveShares`
   * (before this plan's own sells) — 0 if there are no shares to break
   * even on. */
  breakEven: number;
  /** Planned realized P/L from this plan's own sell legs, valued against
   * `avgCost` — the whole point of a "trade cycle": what this round trip
   * is expected to net, not just what each leg costs. */
  realizedPL: number;
}

/** Per-ticker plan analysis — the core thing a trade *planner* (as opposed
 * to a plain leg list) needs to answer: what's my average cost once this
 * plan's buys go through, what's my break-even, and what does this cycle's
 * sells net me. Blends in the real, already-held position (if any) so
 * planning a sell of stock you already own works correctly, not just
 * planning a fresh buy-then-sell within the same plan. */
export function analyzeTradePlanByTicker(
  legs: TradePlanLeg[],
  realHoldings: RealHolding[],
  calcFee: FeeCalculator,
  feePct: number,
  tick: number,
): TradePlanTickerSummary[] {
  const tickers = [...new Set(legs.map((l) => l.ticker))];
  return tickers.map((ticker) => {
    const real = realHoldings.find((r) => r.ticker === ticker);
    const buys = legs.filter((l) => l.ticker === ticker && l.action === 'BUY');
    const sells = legs.filter((l) => l.ticker === ticker && l.action === 'SELL');

    const planBought = buys.reduce((s, l) => s + l.shares, 0);
    const planBuyCost = buys.reduce((s, l) => s + l.shares * l.price + calcFee(l.shares * l.price, true, { shares: l.shares }), 0);

    const baseShares = (real?.shares ?? 0) + planBought;
    const baseCost = (real?.invested ?? 0) + planBuyCost;
    const avgCost = baseShares > 0 ? baseCost / baseShares : 0;
    const breakEven = baseShares > 0 ? breakEvenPrice(baseCost, baseShares, feePct, tick, calcFee) : 0;

    const planSold = sells.reduce((s, l) => s + l.shares, 0);
    const realizedPL = sells.reduce((sum, l) => {
      const proceeds = l.shares * l.price - calcFee(l.shares * l.price, false, { shares: l.shares });
      const costOfSold = l.shares * avgCost;
      return sum + (proceeds - costOfSold);
    }, 0);

    return {
      ticker,
      planBought,
      planSold,
      effectiveShares: baseShares - planSold,
      avgCost,
      breakEven,
      realizedPL,
    };
  });
}
