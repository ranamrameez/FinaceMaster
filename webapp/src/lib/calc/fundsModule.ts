import type { Fund } from '../../types/fundsWorkbook';
import type { PricePoint, Transaction } from '../../types/workbook';
import { computePositions } from './positions';
import { getDailyPriceHistory, getMarketPrice } from './priceHistory';

const calcFee = () => 0; // NAV is already net of fund fees — see FundsWorkbook's doc comment

/** Current market value per fund currency — mirrors the per-fund value
 * computation already inline in FundsPage.tsx's `FundsSummary`, factored
 * out here so the Net Worth dashboard can reuse it without duplicating the
 * logic or depending on FundsPage's component internals. Deliberately
 * current *value*, not amount invested — net worth cares what it's worth
 * now, not what went in. */
export function fundsValueByCurrency(
  funds: Fund[],
  transactions: Transaction[],
  marketPrices: Record<string, number>,
): Record<string, number> {
  const positions = computePositions(transactions, calcFee);
  const out: Record<string, number> = {};
  funds.forEach((fund) => {
    const position = positions.find((p) => p.ticker === fund.id);
    const units = position?.shares ?? 0;
    const nav = getMarketPrice(fund.id, marketPrices, transactions);
    out[fund.currencyCode] = (out[fund.currencyCode] ?? 0) + units * nav;
  });
  return out;
}

/** Current value of every fund in one currency, grouped by category —
 * feeds Funds' Analytics "Allocation by category" doughnut
 * (MODULES_PLAN.md §11). Scoped to a single currency, same rule as every
 * other module's totals (no blending across currencies, no FX). A fund
 * with zero current value (fully sold, or no NAV known yet) is omitted
 * rather than shown as a meaningless zero-width slice. */
export function allocationByCategory(
  funds: Fund[],
  transactions: Transaction[],
  marketPrices: Record<string, number>,
  currencyCode: string,
): Record<string, number> {
  const positions = computePositions(transactions, calcFee);
  const out: Record<string, number> = {};
  funds
    .filter((f) => f.currencyCode === currencyCode)
    .forEach((fund) => {
      const position = positions.find((p) => p.ticker === fund.id);
      const units = position?.shares ?? 0;
      const nav = getMarketPrice(fund.id, marketPrices, transactions);
      const value = units * nav;
      if (value > 0) out[fund.category] = (out[fund.category] ?? 0) + value;
    });
  return out;
}

export interface ContributionPoint {
  date: string;
  invested: number; // cumulative net cash contributed (BUY amounts minus SELL amounts)
  value: number; // units held at this date * the NAV known as of this date
}

/** One fund's "contribution vs. value over time" (MODULES_PLAN.md §11) —
 * at every date where something is known (a transaction happened, or a
 * NAV was recorded), the cumulative net amount invested so far next to
 * what the position was actually worth at that point. The NAV timeline
 * combines explicit `priceHistory` updates with each transaction's own
 * price (a buy/sell is itself an implicit price observation, same
 * fallback idea as `getMarketPrice`'s "last BUY price" rule) — a fund
 * that's only ever been bought/sold, with no separate "Update NAV" click,
 * still gets a meaningful value line instead of a flat zero. */
export function contributionVsValueSeries(
  fundId: string,
  transactions: Transaction[],
  priceHistory: Record<string, PricePoint[]>,
): ContributionPoint[] {
  const txs = transactions.filter((t) => t.ticker === fundId).sort((a, b) => a.date.localeCompare(b.date));
  const navHistory = getDailyPriceHistory(fundId, priceHistory);

  const priceByDate: Record<string, number> = {};
  navHistory.forEach((p) => {
    priceByDate[p.date] = p.price;
  });
  txs.forEach((t) => {
    if (!(t.date in priceByDate)) priceByDate[t.date] = t.price;
  });

  const dates = [...new Set([...txs.map((t) => t.date), ...navHistory.map((p) => p.date)])].sort();
  if (!dates.length) return [];

  let units = 0;
  let invested = 0;
  let lastNav = 0;
  return dates.map((date) => {
    txs
      .filter((t) => t.date === date)
      .forEach((t) => {
        if (t.action === 'BUY') {
          units += t.shares;
          invested += t.shares * t.price;
        } else {
          units -= t.shares;
          invested -= t.shares * t.price;
        }
      });
    if (priceByDate[date] !== undefined) lastNav = priceByDate[date];
    return { date, invested, value: units * lastNav };
  });
}
