import type { FeeCalculator, RealizedPLPoint, Transaction } from '../../types/workbook';

/** Chronological running total of realized P/L, one point per SELL — same
 * weighted-average-cost convention as computePositions, just tracked over
 * time instead of collapsed into a single lifetime number.
 * Ported 1:1 from the legacy `computeRealizedPLTimeSeries()` in index.html. */
export function computeRealizedPLTimeSeries(transactions: Transaction[], calcFee: FeeCalculator): RealizedPLPoint[] {
  const byTicker: Record<string, { shares: number; cost: number }> = {};
  const points: RealizedPLPoint[] = [];
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;

  sorted.forEach((tx) => {
    const t = tx.ticker;
    if (!byTicker[t]) byTicker[t] = { shares: 0, cost: 0 };
    const amount = tx.shares * tx.price;
    const fee = calcFee(amount, tx.action === 'BUY', { shares: tx.shares, tx });
    if (tx.action === 'BUY') {
      byTicker[t].shares += tx.shares;
      byTicker[t].cost += amount + fee;
    } else {
      const avg = byTicker[t].shares > 0 ? byTicker[t].cost / byTicker[t].shares : 0;
      const costRemoved = avg * tx.shares;
      const proceeds = amount - fee;
      running += proceeds - costRemoved;
      byTicker[t].shares -= tx.shares;
      byTicker[t].cost -= costRemoved;
      points.push({ date: tx.date, value: running });
    }
  });

  return points;
}
