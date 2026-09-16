import { categoryName } from '../categories';
import type { Category } from '../../types/finance';
import type { CashEntry } from '../../types/cashWorkbook';
import { dateOnlyMs } from '../datetime';

export interface CashLedgerRow { entry: CashEntry; balance: number; }

/** Running cleared balance per currency. Pending entries are excluded from
 * the actual ledger; cashPendingByCurrency exposes their separate impact. */
export function cashRunningLedger(entries: CashEntry[]): CashLedgerRow[] {
  const sorted = [...entries].filter((e) => !e.isPending).sort((a, b) => {
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

export function cashBalanceByCurrency(entries: CashEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.isPending) return;
    out[e.currencyCode] = (out[e.currencyCode] || 0) + (e.isDeposit ? e.amount : -e.amount);
  });
  return out;
}

export function cashPendingByCurrency(entries: CashEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries.forEach((e) => {
    if (!e.isPending) return;
    out[e.currencyCode] = (out[e.currencyCode] || 0) + (e.isDeposit ? e.amount : -e.amount);
  });
  return out;
}

/** Actual cleared category breakdown. Pending entries are excluded so charts
 * and category totals cannot report unposted cash as already spent/received. */
export function cashByCategory(entries: CashEntry[], categories: Category[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  entries.filter((e) => !e.isPending).forEach((e) => {
    const cat = categoryName(e.categoryID, categories);
    if (!out[e.currencyCode]) out[e.currencyCode] = {};
    out[e.currencyCode][cat] = (out[e.currencyCode][cat] || 0) + (e.isDeposit ? e.amount : -e.amount);
  });
  return out;
}

export interface MonthlyFlow { month: string; income: number; expense: number; net: number; }

export function cashMonthlyFlow(entries: CashEntry[], currencyCode: string): MonthlyFlow[] {
  const byMonth: Record<string, { income: number; expense: number }> = {};
  entries.filter((e) => e.currencyCode === currencyCode && !e.isPending).forEach((e) => {
    const month = e.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
    if (e.isDeposit) byMonth[month].income += e.amount;
    else byMonth[month].expense += e.amount;
  });
  return Object.keys(byMonth).sort().map((month) => ({ month, income: byMonth[month].income, expense: byMonth[month].expense, net: byMonth[month].income - byMonth[month].expense }));
}
