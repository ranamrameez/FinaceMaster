import type { Property, RentalEntry } from '../../types/rentalsWorkbook';

const entryDelta = (e: RentalEntry) => (e.type === 'RENT_INCOME' ? e.amount : -e.amount);

/** Net income (rent income minus expenses) for one property, all time. */
export function propertyNetIncome(property: Property, entries: RentalEntry[]): number {
  return entries.filter((e) => e.propertyId === property.id).reduce((s, e) => s + entryDelta(e), 0);
}

/** Portfolio-wide net income, grouped by currency — never blended/converted
 * (no live FX-rate source, see MODULES_PLAN.md). */
export function netIncomeByCurrency(properties: Property[], entries: RentalEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  properties.forEach((p) => {
    out[p.currencyCode] = (out[p.currencyCode] || 0) + propertyNetIncome(p, entries);
  });
  return out;
}

/** Category breakdown for one property (rent income nets in as its own
 * "Rent" bucket; expenses net by their own category). */
export function propertyByCategory(property: Property, entries: RentalEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries
    .filter((e) => e.propertyId === property.id)
    .forEach((e) => {
      const cat = e.type === 'RENT_INCOME' ? 'Rent income' : e.category?.trim() || 'Uncategorized';
      out[cat] = (out[cat] || 0) + entryDelta(e);
    });
  return out;
}

export interface MonthlyRollupRow {
  month: string; // "YYYY-MM"
  income: number;
  expense: number;
  net: number;
}

/** Monthly income/expense/net rollup for one property, chronological. */
export function propertyMonthlyRollup(property: Property, entries: RentalEntry[]): MonthlyRollupRow[] {
  const byMonth: Record<string, { income: number; expense: number }> = {};
  entries
    .filter((e) => e.propertyId === property.id)
    .forEach((e) => {
      const month = e.date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
      if (e.type === 'RENT_INCOME') byMonth[month].income += e.amount;
      else byMonth[month].expense += e.amount;
    });
  return Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { income, expense }]) => ({ month, income, expense, net: income - expense }));
}
