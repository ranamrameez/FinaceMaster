import type { FeeCalculator } from '../../types/workbook';

/** QSE's fee model: flat percentage of trade value, floored at a minimum fee.
 * Ported 1:1 from the legacy `calcFee()` in index.html. README item 11:
 * `context.tx.feeOverride`, when set, wins outright — a manual correction
 * for reconciling against the real account statement. */
export function makeQSEFeeCalculator(settings: { feePct: number; minFee: number }): FeeCalculator {
  return (amount, _isBuy = true, context) => {
    if (context?.tx?.feeOverride !== undefined) return context.tx.feeOverride;
    if (amount <= 0) return 0;
    const rawFee = amount * (settings.feePct / 100);
    return Math.max(Math.round(rawFee * 100) / 100, settings.minFee || 0);
  };
}

export function roundTick(price: number, tick: number): number {
  const t = tick || 0.001;
  return Math.round(price / t) * t;
}

/** Solves the SELL price P such that net proceeds (P*shares - fee) == costBasis. */
export function breakEvenPrice(
  costBasis: number,
  shares: number,
  feePct: number,
  tick: number,
  calcFee: FeeCalculator,
): number {
  if (shares <= 0) return 0;
  const feeRate = feePct / 100;
  let P = costBasis / (shares * (1 - feeRate));
  for (let i = 0; i < 40; i++) {
    const amount = P * shares;
    const fee = calcFee(amount, false, { shares });
    const net = amount - fee;
    const diff = net - costBasis;
    if (Math.abs(diff) < 0.0005) break;
    P = P - diff / shares;
    if (P < 0) P = 0;
  }
  return roundTick(P, tick);
}

/** Solves the sell price P such that net proceeds - costBasis == targetProfit. */
export function requiredSellPrice(
  costBasis: number,
  shares: number,
  targetProfit: number,
  feePct: number,
  tick: number,
  calcFee: FeeCalculator,
): number {
  return breakEvenPrice(costBasis + targetProfit, shares, feePct, tick, calcFee);
}
