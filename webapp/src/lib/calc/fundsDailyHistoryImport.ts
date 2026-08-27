import type { Fund } from '../../types/fundsWorkbook';
import type { PricePoint, Transaction } from '../../types/workbook';

/** A tolerance below which a balance/gap is treated as float dust or a
 * fully-redeemed position, not real money — real per-fund entries in a
 * daily tracking sheet are never this small on purpose (the smallest real
 * currency unit that matters here is a cent/paisa), but a fully-redeemed
 * fund's balance often lingers at something like 0.00001 due to the
 * source spreadsheet's own rounding. */
const EPS = 0.01;

export interface DailyBalanceRow {
  date: string;
  /** Opening balance for this update — NOT necessarily the previous row's
   * closing balance. When the user deposits or withdraws between two
   * updates, they bump this to the new starting point themselves, which is
   * exactly what keeps `newBlc - prvBlc` a pure investment-growth figure,
   * never contaminated by a cash flow. A gap between this row's `prvBlc`
   * and the previous row's `newBlc` is how a deposit/withdrawal is
   * detected — see `reconstructFundDailyHistory`. */
  prvBlc: number;
  newBlc: number;
  /** The source spreadsheet's own `newBlc - prvBlc` — organic growth only,
   * already cash-flow-neutral per the convention above. Carried through
   * verbatim (not re-derived) for the monthly/annual P/L aggregates, so
   * those numbers are exact regardless of any float rounding introduced by
   * the separate unit/NAV reconstruction below. */
  profitLoss: number;
}

/** Recognizes a sheet as a per-fund daily-balance log by its header row
 * containing Date/PrvBlc/NewBlc columns — independent of the sheet's own
 * name, since a real workbook's per-fund sheet names don't reliably match
 * the fund code used elsewhere (e.g. a sheet named "ALIIF" for a fund
 * whose actual code is "ALHIIF"). Rows with a date but no `newBlc` are
 * unfilled template rows extending into the future (a real pattern: the
 * source sheet pre-fills a formula-generated date for days not yet
 * reached) and are dropped, not treated as a zero-value observation. */
export function parseDailyBalanceRows(headerRow: (string | number | Date | null | undefined)[], dataRows: (string | number | Date | null | undefined)[][]): DailyBalanceRow[] | null {
  const norm = (c: unknown) => String(c ?? '').trim().toLowerCase();
  const dateCol = headerRow.findIndex((c) => norm(c) === 'date');
  const prvCol = headerRow.findIndex((c) => norm(c) === 'prvblc');
  const newCol = headerRow.findIndex((c) => norm(c) === 'newblc');
  const plCol = headerRow.findIndex((c) => norm(c).replace(/\s/g, '') === 'profit-loss' || norm(c).replace(/\s/g, '') === 'profitloss');
  if (dateCol === -1 || prvCol === -1 || newCol === -1) return null;

  const toDateStr = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
      // Excel serial date (days since 1899-12-30), for a source that didn't
      // come through as a JS Date already.
      const ms = Math.round((v - 25569) * 86400 * 1000);
      return new Date(ms).toISOString().slice(0, 10);
    }
    if (typeof v === 'string' && v.trim()) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return null;
  };
  const toNum = (v: unknown): number | null => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim()) {
      const n = parseFloat(v.replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const out: DailyBalanceRow[] = [];
  for (const row of dataRows) {
    const date = toDateStr(row[dateCol]);
    const newBlc = toNum(row[newCol]);
    if (date === null || newBlc === null) continue; // unfilled template row
    const prvBlc = toNum(row[prvCol]) ?? newBlc;
    const profitLoss = plCol !== -1 ? (toNum(row[plCol]) ?? newBlc - prvBlc) : newBlc - prvBlc;
    out.push({ date, prvBlc, newBlc, profitLoss });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export interface DailyReconstructionResult {
  /** Chronological BUY/SELL transactions — one initial BUY plus one per
   * detected deposit/withdrawal gap. Not tagged with a `ticker` yet; the
   * caller sets it once the target fund id is known (new or matched). */
  transactions: Omit<Transaction, 'id' | 'ticker'>[];
  /** One NAV observation per valid row once the fund holds units > 0 —
   * becomes `priceHistory`, with the last point also becoming the fund's
   * current `marketPrices` entry. */
  navPoints: { date: string; price: number }[];
  monthlyPL: { month: string; total: number }[];
  yearlyPL: { year: string; total: number }[];
  warnings: string[];
}

/** Reconstructs a real buy/sell + NAV history from a daily balance-only
 * log — the core of "you cannot ignore them": a balance snapshot only
 * shows where a fund ended up, this shows the actual day-by-day path,
 * with cash flows (deposits/withdrawals) separated from organic growth.
 *
 * Algorithm: track `units` (starts at 0) and the last-seen closing balance.
 * On each row, a gap between this row's `prvBlc` and the last row's
 * `newBlc` means money moved — priced at the NAV implied by the last
 * closing balance divided by the units held just before the flow (or NAV
 * 1, the same placeholder the Snapshot Import uses, if there were no units
 * yet — i.e. this is the very first deposit, or the fund was fully
 * redeemed and is now being re-funded). Once the flow (if any) is applied,
 * this row's `newBlc / units` becomes the day's NAV observation. A
 * withdrawal that would exceed the units actually held is clamped and
 * flagged rather than going negative — a real data-entry inconsistency
 * this shouldn't fail on, but shouldn't silently paper over either. */
export function reconstructFundDailyHistory(rows: DailyBalanceRow[]): DailyReconstructionResult {
  const transactions: Omit<Transaction, 'id' | 'ticker'>[] = [];
  const navPoints: { date: string; price: number }[] = [];
  const warnings: string[] = [];

  let units = 0;
  let prevNewBlc = 0;
  for (const row of rows) {
    const gap = row.prvBlc - prevNewBlc;
    if (Math.abs(gap) > EPS) {
      if (gap > 0) {
        const navBeforeFlow = units > EPS ? prevNewBlc / units : 1;
        const added = gap / navBeforeFlow;
        transactions.push({ date: row.date, action: 'BUY', shares: added, price: navBeforeFlow });
        units += added;
      } else if (units > EPS) {
        const navBeforeFlow = prevNewBlc / units;
        const requested = -gap / navBeforeFlow;
        const removed = Math.min(requested, units);
        if (requested > units + EPS) {
          warnings.push(`Withdrawal on ${row.date} (${(-gap).toFixed(2)}) exceeds tracked units — clamped to the units actually held.`);
        }
        transactions.push({ date: row.date, action: 'SELL', shares: removed, price: navBeforeFlow });
        units -= removed;
      } else {
        warnings.push(`Withdrawal of ${(-gap).toFixed(2)} on ${row.date} recorded with no tracked units — ignored.`);
      }
    }

    if (units > EPS) {
      navPoints.push({ date: row.date, price: row.newBlc / units });
    }
    prevNewBlc = row.newBlc;
  }

  const monthlyMap = new Map<string, number>();
  const yearlyMap = new Map<string, number>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const year = row.date.slice(0, 4);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + row.profitLoss);
    yearlyMap.set(year, (yearlyMap.get(year) ?? 0) + row.profitLoss);
  }
  const monthlyPL = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
  const yearlyPL = [...yearlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, total]) => ({ year, total }));

  return { transactions, navPoints, monthlyPL, yearlyPL, warnings };
}

/** Mean of real, non-padded calendar-month (or -year) totals — "holidays
 * produce no money" means there's genuinely nothing to sum on those days,
 * not missing data to interpolate, so this deliberately does NOT divide by
 * the number of calendar days/months spanned; it averages only the months
 * (or years) that actually appear in the data. */
export function averagePeriodPL(periods: { total: number }[]): number {
  if (!periods.length) return 0;
  return periods.reduce((s, p) => s + p.total, 0) / periods.length;
}

/** Implied per-unit NAV from a fund's current total balance, given the
 * units already held — the same formula `reconstructFundDailyHistory` uses
 * per-row (`newBlc / units`) for a day with no detected deposit/withdrawal
 * gap, exposed standalone for a single quick "update my balance" entry
 * (see `FundsPage.tsx`'s `commitBalance`) rather than a full daily-history
 * import. Returns `null` when there are no units to divide across (nothing
 * held yet) — the caller should require an initial investment first. */
export function impliedFundNav(balance: number, units: number): number | null {
  if (units <= 0) return null;
  return balance / units;
}

/** Suggests which existing fund identity (from the workbook's Summary
 * sheet/CSV, or the app's own saved funds) a daily-history sheet belongs
 * to, by matching its last real balance against a candidate's reported
 * current balance — the two files reconcile exactly on real data (see
 * fundsDailyHistoryImport.test.ts). Returns null when zero or more than
 * one candidate matches equally well, since guessing between two
 * indistinguishable funds (e.g. two closed positions sharing a fund code)
 * is worse than asking the user to pick. */
export function suggestFundMatch<T extends { currentBalance: number }>(lastBalance: number, candidates: T[]): T | null {
  const matches = candidates.filter((c) => Math.abs(c.currentBalance - lastBalance) < 1);
  return matches.length === 1 ? matches[0] : null;
}

export interface FundDailyImportItem {
  /** The fund this sheet's reconstructed history is written to — an
   * existing fund's id (to REPLACE its transactions) or a freshly
   * generated id paired with `newFund` (to create one). */
  fundId: string;
  newFund?: Fund;
  reconstruction: DailyReconstructionResult;
}

export interface WorkbookSlice {
  funds: Fund[];
  transactions: Transaction[];
  marketPrices: Record<string, number>;
  priceHistory: Record<string, PricePoint[]>;
}

/** Applies a confirmed set of daily-history imports to a workbook slice.
 * For a fund matched to an EXISTING id, this REPLACES every transaction
 * currently on that fund with the reconstructed set — the whole point of
 * this importer over the Snapshot Import is that a balance-only snapshot
 * throws away the day-by-day path, so once the real path is available it
 * should replace the synthetic single-transaction stand-in, not pile up
 * alongside it. This is genuinely destructive to whatever transactions
 * existed before on a matched fund — the caller is responsible for
 * confirming that with the user before calling this (see
 * `DailyHistoryImportSection.tsx`), not this function. */
export function mergeDailyImportIntoWorkbook(items: FundDailyImportItem[], workbook: WorkbookSlice): WorkbookSlice {
  let funds = [...workbook.funds];
  let transactions = [...workbook.transactions];
  const marketPrices = { ...workbook.marketPrices };
  const priceHistory = { ...workbook.priceHistory };

  for (const item of items) {
    if (item.newFund) funds = [...funds, item.newFund];
    transactions = transactions.filter((t) => t.ticker !== item.fundId);
    transactions = [
      ...transactions,
      ...item.reconstruction.transactions.map((t) => ({ ...t, id: crypto.randomUUID(), ticker: item.fundId })),
    ];
    if (item.reconstruction.navPoints.length) {
      priceHistory[item.fundId] = item.reconstruction.navPoints.map((p) => ({ date: p.date, price: p.price }));
      marketPrices[item.fundId] = item.reconstruction.navPoints[item.reconstruction.navPoints.length - 1].price;
    }
  }

  return { funds, transactions, marketPrices, priceHistory };
}
