import { categoryName } from '../categories';
import type { Category } from '../../types/finance';
import type { CashEntry } from '../../types/cashWorkbook';
import { dateOnlyMs } from '../datetime';

export interface CashLedgerRow {
  entry: CashEntry;
  balance: number; // running balance within this entry's own currency
}

/** Running balance per currency, in calendar-date order — entries in
 * different currencies never mix into one balance (no live FX-rate source
 * to convert with). Two entries on the same DATE (Done item 235's reorder
 * feature, extended 2026-09-08 to same-date rather than same-instant —
 * see `dateOnlyMs`'s own doc comment) are then ordered by `serialNumber`
 * (a stable, persisted per-entry counter — see `Finance.serialNumber`'s
 * doc comment) rather than relying on `Array.prototype.sort`'s stability
 * or an untimed time-of-day guess. */
export function cashRunningLedger(entries: CashEntry[]): CashLedgerRow[] {
  const sorted = [...entries].sort((a, b) => {
    const byDate = dateOnlyMs(a.date) - dateOnlyMs(b.date);
    return byDate !== 0 ? byDate : (a.serialNumber ?? 0) - (b.serialNumber ?? 0);
  });
  const runningByCurrency: Record<string, number> = {};
  return sorted.map((entry) => {
    const delta = entry.isDeposit ? entry.amount : -entry.amount;
    const next = (runningByCurrency[entry.currencyCode] || 0) + delta;
    runningByCurrency[entry.currencyCode] = next;
    return { entry, balance: next };
  });
}

/** Current (cleared, spendable) balance per currency — excludes any entry
 * with `isPending` set (see `Finance.isPending`'s own doc comment for why:
 * a pending entry's money isn't actually available yet). Every other
 * balance/total in the app (Dashboard, Net Worth, ...) derives from this
 * one function, so excluding pending here is a "fix once" change — no
 * downstream caller needed to change to get the "locks real balances"
 * behavior the user asked for. Zero-migration: no real existing entry has
 * ever had `isPending` set, so this returns exactly what it always did
 * until a user actually marks something pending. */
export function cashBalanceByCurrency(entries: CashEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.isPending) return;
    out[e.currencyCode] = (out[e.currencyCode] || 0) + (e.isDeposit ? e.amount : -e.amount);
  });
  return out;
}

/** The net amount currently sitting in pending entries, per currency — the
 * companion figure to `cashBalanceByCurrency` above, so the UI can show
 * "Cleared: X" and "+Y pending" side by side rather than the pending
 * amount just silently vanishing from every stat. */
export function cashPendingByCurrency(entries: CashEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries.forEach((e) => {
    if (!e.isPending) return;
    out[e.currencyCode] = (out[e.currencyCode] || 0) + (e.isDeposit ? e.amount : -e.amount);
  });
  return out;
}

/** Category breakdown (net IN minus OUT per category), grouped by currency
 * first since amounts in different currencies can't be summed together.
 * Keyed by category NAME (resolved from `categoryID` via the shared
 * registry), not the id itself — every existing caller/chart already
 * expects a display-ready name as the key. */
export function cashByCategory(entries: CashEntry[], categories: Category[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  entries.forEach((e) => {
    const cat = categoryName(e.categoryID, categories);
    if (!out[e.currencyCode]) out[e.currencyCode] = {};
    out[e.currencyCode][cat] = (out[e.currencyCode][cat] || 0) + (e.isDeposit ? e.amount : -e.amount);
  });
  return out;
}

export interface MonthlyFlow {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

/** Income (deposit) vs. expense totals per calendar month, for one
 * currency at a time — feeds the Analytics tab's trend chart. Months with
 * no activity are simply absent (not zero-filled), same convention as
 * QSE/PSX's monthly series. */
export function cashMonthlyFlow(entries: CashEntry[], currencyCode: string): MonthlyFlow[] {
  const byMonth: Record<string, { income: number; expense: number }> = {};
  entries
    .filter((e) => e.currencyCode === currencyCode)
    .forEach((e) => {
      const month = e.date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
      if (e.isDeposit) byMonth[month].income += e.amount;
      else byMonth[month].expense += e.amount;
    });
  return Object.keys(byMonth)
    .sort()
    .map((month) => ({ month, income: byMonth[month].income, expense: byMonth[month].expense, net: byMonth[month].income - byMonth[month].expense }));
}
