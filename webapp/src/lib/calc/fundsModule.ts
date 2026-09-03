import type { Fund } from '../../types/fundsWorkbook';
import type { Position, PricePoint, Transaction } from '../../types/workbook';
import { computePositions } from './positions';
import { getDailyPriceHistory, getMarketPrice, getPriceHistory } from './priceHistory';

const calcFee = () => 0; // NAV is already net of fund fees — see FundsWorkbook's doc comment

/** A fund's true Net P/L: realized profit locked in by every past sell/
 * withdrawal, PLUS unrealized profit on whatever units are still held.
 * `Position.invested` (from `computePositions`) is only the cost basis of
 * the REMAINING position — a withdrawal reduces it, so `value - invested`
 * alone silently drops every past withdrawal's own profit. This is the
 * same `realizedPL + unrealizedPL` shape `cashSummary()`'s app-wide `netPL`
 * already uses, just for one ticker instead of the whole portfolio.
 * Real user-reported bug (2026-09-03): after 3 withdrawals, JCSLM's true
 * Net P/L (~269 PKR) showed as only ~31 PKR — the unrealized-only figure. */
export function fundNetProfit(position: Position | undefined, currentValue: number): number {
  return (position?.realized ?? 0) + (currentValue - (position?.invested ?? 0));
}

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

export interface ExpectedPLRate {
  dailyAmount: number;
  dailyPct: number;
  monthlyAmount: number;
  monthlyPct: number;
}

/** User-requested (2026-09-03): "Display expected daily/monthly PL+PL%age
 * on homepage and each item page." Projects a fund's typical daily/monthly
 * P&L — in currency, and as a % of its own average invested capital over
 * the observed period — from its REAL organic-growth history, the same
 * `value - prevValue - (invested - prevInvested)` math `organicPLByPeriod`
 * already uses, just totaled across the whole observed span and normalized
 * per day/month instead of bucketed by calendar period. This is an average
 * of what already happened, not a promise — deliberately simple (no
 * day-of-week-varying rate, no balance-jump reconciliation): that harder
 * "expected profit rate" concept is a separate, explicitly-deferred
 * feature (see CLAUDE.md's "Planning v2" notes) waiting on the user's own
 * real sample data before its algorithm gets designed; this is a much
 * plainer average-of-history projection that needs no new data model.
 *
 * Deliberately normalizes by REAL elapsed calendar days between the first
 * and last data point, not by `averagePeriodPL(organicPLByPeriod(...))`'s
 * "average of however many distinct calendar months happen to appear" —
 * for a fund with sparse or irregular updates (e.g. two NAV points 45 days
 * apart landing in 2 different months), that would silently treat the gap
 * as "2 months" worth ~22.5 days each rather than the real 45, skewing a
 * per-day/per-month rate. `averagePeriodPL` stays right for what it's
 * used for (averaging the Daily History Import preview's own real monthly
 * buckets, where each bucket genuinely is one calendar month of data) —
 * this is a different question (a smooth per-day rate), so it uses actual
 * elapsed time instead.
 *
 * Returns `null` when there's fewer than 2 dated data points to measure a
 * span from (e.g. a fund bought today with no NAV history yet). */
export function expectedPLRate(
  fundId: string,
  transactions: Transaction[],
  priceHistory: Record<string, PricePoint[]>,
): ExpectedPLRate | null {
  const points = contributionVsValueSeries(fundId, transactions, priceHistory);
  if (points.length < 2) return null;

  let totalOrganic = 0;
  for (let i = 0; i < points.length; i++) {
    const prev = i > 0 ? points[i - 1] : { value: 0, invested: 0 };
    const curr = points[i];
    totalOrganic += curr.value - prev.value - (curr.invested - prev.invested);
  }
  const avgInvested = points.reduce((s, p) => s + p.invested, 0) / points.length;

  const first = points[0];
  const last = points[points.length - 1];
  const daysSpan = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000);

  const dailyAmount = totalOrganic / daysSpan;
  const monthlyAmount = dailyAmount * 30.44; // average days per calendar month
  const dailyPct = avgInvested > 0 ? (dailyAmount / avgInvested) * 100 : 0;
  const monthlyPct = avgInvested > 0 ? (monthlyAmount / avgInvested) * 100 : 0;

  return { dailyAmount, dailyPct, monthlyAmount, monthlyPct };
}

export interface PeriodPL {
  period: string; // "YYYY-MM" or "YYYY"
  total: number;
}

/** Organic (cash-flow-neutral) profit/loss per calendar month or year —
 * "how much did this fund actually earn/lose that period," separate from
 * how much was deposited or withdrawn. Derived from the same
 * `{date, invested, value}` series `contributionVsValueSeries` already
 * computes: between two consecutive points, the change in `value` minus
 * whatever was newly invested/withdrawn isolates pure growth, without
 * needing a separately-stored "today's profit" figure. This works for any
 * fund's stored transactions/priceHistory — not just one imported via
 * `fundsDailyHistoryImport.ts` — and degrades gracefully to fewer, coarser
 * points for a fund with sparse NAV history (e.g. only ever manually
 * bought/sold with no separate "Update NAV" click). */
export function organicPLByPeriod(
  fundId: string,
  transactions: Transaction[],
  priceHistory: Record<string, PricePoint[]>,
  periodLength: 'month' | 'year',
): PeriodPL[] {
  const points = contributionVsValueSeries(fundId, transactions, priceHistory);
  const periods = new Map<string, number>();
  for (let i = 0; i < points.length; i++) {
    // Nothing existed before the first point — comparing against a zero
    // baseline isolates that first point's own growth (value vs. cost
    // basis) instead of silently dropping it. This matters whenever the
    // very first buy and the first NAV observation share the same date
    // (the common case for a freshly-imported fund), since that day's
    // organic growth is baked into the first point itself.
    const prev = i > 0 ? points[i - 1] : { value: 0, invested: 0 };
    const curr = points[i];
    const organic = curr.value - prev.value - (curr.invested - prev.invested);
    const key = periodLength === 'month' ? curr.date.slice(0, 7) : curr.date.slice(0, 4);
    periods.set(key, (periods.get(key) ?? 0) + organic);
  }
  return [...periods.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, total]) => ({ period, total }));
}

export interface BalanceUpdateRow {
  /** 1-based position in this fund's OWN chronological update history —
   * a stable ordinal ("this was my Nth balance update"), independent of
   * whatever order the caller later displays rows in (newest-first, etc). */
  index: number;
  point: PricePoint;
  date: string;
  time?: string;
  prevBalance: number;
  prevNav: number;
  newBalance: number;
  newNav: number;
  change: number;
  changePct: number;
}

/** User-requested (2026-09-03): "Balance Update History missing crucial
 * data. Add all data like Index, Date, prv balnce + NAV, new balance +
 * NAV, change + %age, Actions etc." A raw `PricePoint` only ever stored a
 * NAV — it has no "balance" of its own, since that depends on how many
 * units were actually held on that date, which changes over time as
 * transactions happen. This walks the fund's chronological price-update
 * log once, computing units-held-as-of-that-date (every BUY/SELL with
 * `date <= p.date`) to derive each update's own real balance, then a
 * before/after balance+NAV pair and the change between them — the same
 * "what actually happened between two consecutive points" question
 * `organicPLByPeriod`/`expectedPLRate` already ask, just at per-update
 * granularity instead of monthly buckets or a whole-history average.
 * `point` carries the underlying raw `PricePoint` through so a caller can
 * still resolve `rawPriceHistory.indexOf(row.point)` for edit/delete,
 * exactly like `computePriceStats`'s own rows already do. */
export function balanceUpdateHistory(
  fundId: string,
  transactions: Transaction[],
  priceHistory: Record<string, PricePoint[]>,
): BalanceUpdateRow[] {
  const raw = [...getPriceHistory(fundId, priceHistory)].sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date));
  const txs = transactions.filter((t) => t.ticker === fundId);

  let prevBalance = 0;
  let prevNav = 0;
  return raw.map((point, i) => {
    const units = txs
      .filter((t) => t.date <= point.date)
      .reduce((s, t) => s + (t.action === 'BUY' ? t.shares : -t.shares), 0);
    const newBalance = units * point.price;
    const newNav = point.price;
    const change = newBalance - prevBalance;
    const changePct = prevBalance > 0 ? (change / prevBalance) * 100 : 0;
    const row: BalanceUpdateRow = {
      index: i + 1,
      point,
      date: point.date,
      time: point.time,
      prevBalance,
      prevNav,
      newBalance,
      newNav,
      change,
      changePct,
    };
    prevBalance = newBalance;
    prevNav = newNav;
    return row;
  });
}
