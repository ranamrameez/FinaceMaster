import { breakEvenPrice } from './fees';
import type { FeeCalculator, TradePlanLeg } from '../../types/workbook';

export interface RealHolding {
  ticker: string;
  shares: number;
  invested: number;
}

export interface TradePlanTickerSummary {
  ticker: string;
  /** Shares from this ticker's legs already marked done ("Mark done") —
   * informational only. These are NOT added into `avgCost`/`effectiveShares`
   * below: an executed leg already created a real Transaction, so its
   * effect is already inside `realHoldings` — counting it again here would
   * double it. */
  executedBought: number;
  executedSold: number;
  /** Shares this plan still intends to buy/sell — not yet executed. */
  plannedBought: number;
  plannedSold: number;
  /** Real holding (which already reflects every executed leg) plus this
   * plan's still-pending buys, minus its still-pending sells — "what I'd
   * hold once every not-yet-done leg in this plan actually happens." */
  effectiveShares: number;
  /** Blended cost basis per share: real holding (if any) plus this plan's
   * own *pending* buy legs — i.e. "my average cost once this plan's
   * remaining buys execute," not just the plan's own legs in isolation. A
   * sell-only plan (planning to sell an existing position, no buy legs of
   * its own) still gets a meaningful average cost from the real holding
   * alone. */
  avgCost: number;
  /** Fee-aware break-even sale price for `avgCost`/(real + pending buys,
   * before this plan's own pending sells) — 0 if there are no shares to
   * break even on. */
  breakEven: number;
  /** Planned realized P/L from this plan's own *pending* sell legs, valued
   * against `avgCost` — the whole point of a "trade cycle": what this
   * round trip is expected to net, not just what each leg costs. */
  realizedPL: number;
}

/** Per-ticker plan analysis — the core thing a trade *planner* (as opposed
 * to a plain leg list) needs to answer: what's my average cost once this
 * plan's remaining buys go through, what's my break-even, and what does
 * this cycle's remaining sells net me. Blends in the real, already-held
 * position (if any) so planning a sell of stock you already own works
 * correctly, not just planning a fresh buy-then-sell within the same plan.
 * Already-executed legs are reported separately and excluded from the
 * cost-basis math — they're already inside `realHoldings` via the real
 * Transaction "Mark done" created, so folding them in again would double
 * their effect. */
export function analyzeTradePlanByTicker(
  legs: TradePlanLeg[],
  realHoldings: RealHolding[],
  calcFee: FeeCalculator,
  feePct: number,
  tick: number,
  /** Fee for one specific pending leg. Defaults to a plain standalone-leg
   * calculation (matches the old behavior); callers that want same-day
   * buy/sell legs within a plan to net against each other (PSX's
   * commission-netting rule) should pass a calculator that's aware of the
   * plan's *other* legs — see `TradePlannerPage.tsx`'s `calcLegFee`. Without
   * this, a plan with a same-day buy AND sell of the same ticker silently
   * over-estimates fees by charging full commission on both legs instead of
   * netting the smaller side, per README item 5's "buy & sell aren't
   * linked" bug report. */
  calcLegFee: (leg: TradePlanLeg) => number = (l) => calcFee(l.shares * l.price, l.action === 'BUY', { shares: l.shares }),
): TradePlanTickerSummary[] {
  const tickers = [...new Set(legs.map((l) => l.ticker))];
  return tickers.map((ticker) => {
    const real = realHoldings.find((r) => r.ticker === ticker);
    const tickerLegs = legs.filter((l) => l.ticker === ticker);
    const pendingBuys = tickerLegs.filter((l) => l.action === 'BUY' && !l.executed);
    const pendingSells = tickerLegs.filter((l) => l.action === 'SELL' && !l.executed);
    const executedBought = tickerLegs.filter((l) => l.action === 'BUY' && l.executed).reduce((s, l) => s + l.shares, 0);
    const executedSold = tickerLegs.filter((l) => l.action === 'SELL' && l.executed).reduce((s, l) => s + l.shares, 0);

    const plannedBought = pendingBuys.reduce((s, l) => s + l.shares, 0);
    const pendingBuyCost = pendingBuys.reduce((s, l) => s + l.shares * l.price + calcLegFee(l), 0);

    const baseShares = (real?.shares ?? 0) + plannedBought;
    const baseCost = (real?.invested ?? 0) + pendingBuyCost;
    const avgCost = baseShares > 0 ? baseCost / baseShares : 0;
    const breakEven = baseShares > 0 ? breakEvenPrice(baseCost, baseShares, feePct, tick, calcFee) : 0;

    const plannedSold = pendingSells.reduce((s, l) => s + l.shares, 0);
    const realizedPL = pendingSells.reduce((sum, l) => {
      const proceeds = l.shares * l.price - calcLegFee(l);
      const costOfSold = l.shares * avgCost;
      return sum + (proceeds - costOfSold);
    }, 0);

    return {
      ticker,
      executedBought,
      executedSold,
      plannedBought,
      plannedSold,
      effectiveShares: baseShares - plannedSold,
      avgCost,
      breakEven,
      realizedPL,
    };
  });
}

/** "What if I exited at price X" — the sandbox part of the trade planner:
 * given a hypothetical exit price, what would selling `shares` (at
 * `avgCost` cost basis) actually net after fees. Used both for "sell
 * everything still planned" and "sell everything, planned + already
 * executed" — the caller picks which `shares` figure to pass in. Returns
 * zeroed proceeds/P&L rather than NaN for a non-positive price or share
 * count, so a not-yet-filled-in "what if" input never shows garbage. */
export function whatIfExit(
  shares: number,
  avgCost: number,
  exitPrice: number,
  calcFee: FeeCalculator,
): { proceeds: number; pl: number } {
  if (shares <= 0 || exitPrice <= 0) return { proceeds: 0, pl: 0 };
  const fee = calcFee(shares * exitPrice, false, { shares });
  const proceeds = shares * exitPrice - fee;
  return { proceeds, pl: proceeds - shares * avgCost };
}
