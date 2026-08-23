import type { FeeCalculator, Position, Transaction } from '../../types/workbook';

/** Weighted-average-cost position rollup per ticker. Ported 1:1 from the
 * legacy `computePositions()` in index.html. Does not track individual buy
 * lots (a sell reduces the ticker's average cost proportionally) — this
 * matches today's behavior; FIFO lot-matching is a separate future change
 * (README item 8, PSX-focused, deferred to Phase 2). */
export function computePositions(transactions: Transaction[], calcFee: FeeCalculator): Position[] {
  const byTicker: Record<string, Position> = {};
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    const t = tx.ticker;
    if (!byTicker[t]) {
      byTicker[t] = {
        ticker: t,
        shares: 0,
        invested: 0,
        buyFees: 0,
        sellFees: 0,
        realized: 0,
        totalBoughtShares: 0,
        totalSoldShares: 0,
        buyCount: 0,
        sellCount: 0,
        firstDate: tx.date,
        lastDate: tx.date,
      };
    }
    const p = byTicker[t];
    const amount = tx.shares * tx.price;
    const isBuy = tx.action === 'BUY';
    const fee = calcFee(amount, isBuy, { shares: tx.shares, tx });
    if (tx.date < p.firstDate) p.firstDate = tx.date;
    if (tx.date > p.lastDate) p.lastDate = tx.date;

    if (isBuy) {
      p.invested += amount + fee;
      p.shares += tx.shares;
      p.buyFees += fee;
      p.totalBoughtShares += tx.shares;
      p.buyCount += 1;
    } else {
      const avg = p.shares > 0 ? p.invested / p.shares : 0;
      const costRemoved = avg * Math.min(tx.shares, p.shares);
      const proceeds = amount - fee;
      p.realized += proceeds - costRemoved;
      p.invested -= costRemoved;
      p.shares -= tx.shares;
      p.sellFees += fee;
      p.totalSoldShares += tx.shares;
      p.sellCount += 1;
      if (p.shares < 0.0000001) p.shares = 0;
      if (p.shares === 0) p.invested = 0;
    }
  }

  return Object.values(byTicker);
}
