import { categoryName } from '../categories';
import type { Category } from '../../types/finance';
import type { Property, RentalEntry } from '../../types/rentalsWorkbook';

const entryDelta = (e: RentalEntry) => (e.isDeposit ? e.amount : -e.amount);

/** Net income (rent income minus expenses) for one property, all time —
 * excludes any entry with `isPending` set (Pending-transaction-state,
 * 2026-09-08, rolled out to Rentals via the shared `Finance.isPending`
 * field it already inherits): a rent payment or expense that's been logged
 * but hasn't actually cleared yet shouldn't count toward net income until
 * it does. Every other Rentals total in the app derives from this one
 * function, so excluding pending here is a "fix once" change — see
 * `propertyPendingNetImpact` below for the companion figure. */
export function propertyNetIncome(property: Property, entries: RentalEntry[]): number {
  return entries
    .filter((e) => e.propertyId === property.id && !e.isPending)
    .reduce((s, e) => s + entryDelta(e), 0);
}

/** The net amount currently sitting in pending entries for one property —
 * the companion figure to `propertyNetIncome` above, so the UI can show
 * "Net: X" and "+Y pending" side by side rather than the pending amount
 * just silently vanishing. */
export function propertyPendingNetImpact(property: Property, entries: RentalEntry[]): number {
  return entries
    .filter((e) => e.propertyId === property.id && e.isPending)
    .reduce((s, e) => s + entryDelta(e), 0);
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

/** Portfolio-wide pending net impact, grouped by currency — the companion
 * figure to `netIncomeByCurrency` above. */
export function netIncomePendingByCurrency(properties: Property[], entries: RentalEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  properties.forEach((p) => {
    out[p.currencyCode] = (out[p.currencyCode] || 0) + propertyPendingNetImpact(p, entries);
  });
  return out;
}

export interface PropertyNetIncomeRow {
  propertyId: string;
  name: string;
  net: number;
}

/** Net income per property, scoped to one currency — feeds the Analytics
 * tab's "Net income by property" bar chart (MODULES_PLAN.md §11). Never
 * blended across currencies, same rule as every other module's totals. */
export function netIncomeByProperty(properties: Property[], entries: RentalEntry[], currencyCode: string): PropertyNetIncomeRow[] {
  return properties
    .filter((p) => p.currencyCode === currencyCode)
    .map((p) => ({ propertyId: p.id, name: p.name, net: propertyNetIncome(p, entries) }));
}

/** Category breakdown for one property (rent income nets in as its own
 * "Rent income" bucket regardless of its own `categoryID`; expenses net by
 * their own resolved category name — same special-case behavior as before
 * this module moved onto `categoryID`). */
export function propertyByCategory(property: Property, entries: RentalEntry[], categories: Category[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries
    .filter((e) => e.propertyId === property.id)
    .forEach((e) => {
      const cat = e.isDeposit ? 'Rent income' : categoryName(e.categoryID, categories);
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
      if (e.isDeposit) byMonth[month].income += e.amount;
      else byMonth[month].expense += e.amount;
    });
  return Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { income, expense }]) => ({ month, income, expense, net: income - expense }));
}
