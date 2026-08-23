import type { CashEntry } from '../../types/cashWorkbook';

export interface CashLedgerRow {
  entry: CashEntry;
  balance: number; // running balance within this entry's own currency
}

/** Running balance per currency, in chronological order — entries in
 * different currencies never mix into one balance (no live FX-rate source
 * to convert with). Ties on date keep original array order (stable sort). */
export function cashRunningLedger(entries: CashEntry[]): CashLedgerRow[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const runningByCurrency: Record<string, number> = {};
  return sorted.map((entry) => {
    const delta = entry.type === 'IN' ? entry.amount : -entry.amount;
    const next = (runningByCurrency[entry.currencyCode] || 0) + delta;
    runningByCurrency[entry.currencyCode] = next;
    return { entry, balance: next };
  });
}

/** Current balance per currency — just the last running-ledger row for
 * each currency, exposed separately since most callers want the summary,
 * not the full row-by-row history. */
export function cashBalanceByCurrency(entries: CashEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries.forEach((e) => {
    out[e.currencyCode] = (out[e.currencyCode] || 0) + (e.type === 'IN' ? e.amount : -e.amount);
  });
  return out;
}

/** Category breakdown (net IN minus OUT per category), grouped by currency
 * first since amounts in different currencies can't be summed together. */
export function cashByCategory(entries: CashEntry[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  entries.forEach((e) => {
    const cat = e.category?.trim() || 'Uncategorized';
    if (!out[e.currencyCode]) out[e.currencyCode] = {};
    out[e.currencyCode][cat] = (out[e.currencyCode][cat] || 0) + (e.type === 'IN' ? e.amount : -e.amount);
  });
  return out;
}

export interface MonthlyFlow {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

/** Income (IN) vs. expense (OUT) totals per calendar month, for one
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
      if (e.type === 'IN') byMonth[month].income += e.amount;
      else byMonth[month].expense += e.amount;
    });
  return Object.keys(byMonth)
    .sort()
    .map((month) => ({ month, income: byMonth[month].income, expense: byMonth[month].expense, net: byMonth[month].income - byMonth[month].expense }));
}
