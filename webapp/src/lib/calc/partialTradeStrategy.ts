import type { FeeCalculator, PricePoint, Transaction } from '../../types/workbook';
import { computeFIFOPositions, type FIFOLot } from './fifoPositions';
import { breakEvenPrice } from './fees';
import { whatIfExit } from './tradePlanAnalysis';
import { getMarketPrice } from './priceHistory';

/** Partial Trade Strategy — the user's own framing: "hold the expensive,
 * sell the cheaper [lots] who fulfil their BE." A blended, whole-position
 * break-even/P&L (what `computePositions`/`analyzeTradePlanByTicker` show)
 * can hide a genuinely profitable individual lot bought at a lower price —
 * a real example: 50 sh bought @10.40 + 14 sh @9.962, price rises to
 * 10.37 — the blended BE barely clears, but the cheap 14-share lot alone
 * was already ~4-5% profit. This module is purely advisory: it reads FIFO
 * lots (`computeFIFOPositions`, already pure/stateless) for DISPLAY only,
 * regardless of a workbook's real `costBasisMethod` setting — it must
 * never be read as implying that setting should change, since that
 * retroactively recomputes a user's real historical P/L (see
 * `PSXSettings.costBasisMethod`'s own locked warning). */

export interface LotAdvice {
  /** The originating buy's stable id, when it has one — pass this back as
   * `Transaction.targetLotBuyId` on a "Sell this lot" action so the real
   * FIFO engine attributes the sale to THIS lot specifically, instead of
   * silently draining whichever lot happens to be oldest (see that field's
   * own doc comment for why that matters). */
  buyId?: string;
  buyDate: string;
  buyPrice: number;
  /** Fee-inclusive cost per share — same formula as `PositionDetail.tsx`'s
   * "Open lots" table and `fifoPositions.ts` itself. */
  costPerShare: number;
  remainingShares: number;
  /** Fee-aware break-even sale price for just this lot's own remaining
   * shares, independent of any other lot in the same position. */
  breakEven: number;
  /** Unrealized P/L for this lot alone, if sold in full at `currentPrice`. */
  unrealizedPL: number;
  suggestion: 'sell' | 'hold';
}

/** Per-lot advice at a given current/hypothetical price. Takes the already-
 * extracted lots for ONE ticker (e.g. `computeFIFOPositions(...)
 * .lotsByTicker[ticker]`) rather than recomputing FIFO internally, so a
 * caller that already has lots (or is scanning many tickers, see
 * `scanPortfolioForOpportunities` below) doesn't pay for it twice. */
export function computeLotAdvice(
  lots: FIFOLot[],
  calcFee: FeeCalculator,
  currentPrice: number,
  feePct: number,
  tick: number,
): LotAdvice[] {
  return lots.map((lot) => {
    const costPerShare = lot.buyPrice + lot.buyFeeTotal / lot.originalShares;
    const costBasis = lot.remainingShares * costPerShare;
    const breakEven = lot.remainingShares > 0 ? breakEvenPrice(costBasis, lot.remainingShares, feePct, tick, calcFee) : 0;
    const unrealizedPL = currentPrice > 0 ? whatIfExit(lot.remainingShares, costPerShare, currentPrice, calcFee).pl : 0;
    return {
      buyId: lot.buyId,
      buyDate: lot.buyDate,
      buyPrice: lot.buyPrice,
      costPerShare,
      remainingShares: lot.remainingShares,
      breakEven,
      unrealizedPL,
      suggestion: unrealizedPL > 0 ? 'sell' : 'hold',
    };
  });
}

/** "X of Y shares [are] positive of this stock wrt current MP" — a compact
 * summary of `computeLotAdvice`'s output for a stat-card sub-line. Only
 * meaningful once a ticker has 2+ open lots (a single-lot position is
 * trivially all-or-nothing, so callers should gate display on
 * `total > sellable && sellable > 0` or similar, not show this for every
 * ticker). */
export function sellableShareSummary(advice: LotAdvice[]): { sellable: number; total: number } {
  const sellable = advice.filter((a) => a.suggestion === 'sell').reduce((s, a) => s + a.remainingShares, 0);
  const total = advice.reduce((s, a) => s + a.remainingShares, 0);
  return { sellable, total };
}

export interface MissedOpportunity {
  peakPrice: number;
  peakDate: string;
  lots: { buyDate: string; buyPrice: number; wouldHaveProfited: number }[];
}

/** "Missed opportunity" retrospective — the real IQCD case this whole
 * feature exists for: the price DID cross a cheap lot's own BE recently,
 * but nothing sold it, because a normal sell drains the oldest (usually
 * most expensive) lot first. Scans the last `windowDays` of `priceHistory`
 * (raw per-update log for one ticker) for its peak, and reports which
 * lots would have profited there. Returns `null` when there's no price
 * history in the window, or nothing would have profited at the peak —
 * "no missed opportunity" is a real, common outcome, not an error. */
export function findMissedOpportunity(
  priceHistory: PricePoint[],
  lots: FIFOLot[],
  calcFee: FeeCalculator,
  windowDays = 30,
): MissedOpportunity | null {
  if (!priceHistory.length || !lots.length) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const inWindow = priceHistory.filter((p) => p.date >= cutoffISO);
  if (!inWindow.length) return null;

  const peak = inWindow.reduce((max, p) => (p.price > max.price ? p : max), inWindow[0]);
  const opportunities = lots
    .map((lot) => {
      const costPerShare = lot.buyPrice + lot.buyFeeTotal / lot.originalShares;
      const { pl } = whatIfExit(lot.remainingShares, costPerShare, peak.price, calcFee);
      return { buyDate: lot.buyDate, buyPrice: lot.buyPrice, wouldHaveProfited: pl };
    })
    .filter((o) => o.wouldHaveProfited > 0);
  if (!opportunities.length) return null;

  return { peakPrice: peak.price, peakDate: peak.date, lots: opportunities };
}

export interface PartialTradeOpportunity {
  ticker: string;
  sellableShares: number;
  totalShares: number;
  /** The single largest unrealized P/L among this ticker's sellable lots —
   * what an alert list sorts/headlines by. */
  bestUnrealizedPL: number;
}

/** Portfolio-wide scan behind the opt-in Partial Trade Alerts popup: every
 * open ticker with at least one lot that's already profitable to sell,
 * even while the position as a whole may not be. */
export function scanPortfolioForOpportunities(
  transactions: Transaction[],
  calcFee: FeeCalculator,
  marketPrices: Record<string, number>,
  feePct: number,
  tick: number,
): PartialTradeOpportunity[] {
  const { lotsByTicker } = computeFIFOPositions(transactions, calcFee);
  const results: PartialTradeOpportunity[] = [];
  for (const [ticker, lots] of Object.entries(lotsByTicker)) {
    const currentPrice = getMarketPrice(ticker, marketPrices, transactions);
    if (currentPrice <= 0) continue;
    const advice = computeLotAdvice(lots, calcFee, currentPrice, feePct, tick);
    const { sellable, total } = sellableShareSummary(advice);
    if (sellable <= 0) continue;
    const bestUnrealizedPL = advice.filter((a) => a.suggestion === 'sell').reduce((max, a) => Math.max(max, a.unrealizedPL), -Infinity);
    results.push({ ticker, sellableShares: sellable, totalShares: total, bestUnrealizedPL });
  }
  return results;
}

/** User's own ask: "show the buy & sell commission/1 share if traded at
 * current price for a quick decision if the user should dive in the dip."
 * Commission for exactly 1 share at the live price — a fast, size-
 * independent sanity check before committing real capital. */
export function perShareCommission(currentPrice: number, calcFee: FeeCalculator): { buy: number; sell: number } {
  if (currentPrice <= 0) return { buy: 0, sell: 0 };
  return {
    buy: calcFee(currentPrice, true, { shares: 1 }),
    sell: calcFee(currentPrice, false, { shares: 1 }),
  };
}
