import { categoryName } from '../categories';
import type { Category } from '../../types/finance';
import type { Property, RentalEntry } from '../../types/rentalsWorkbook';

const entryDelta = (e: RentalEntry) => (e.isDeposit ? e.amount : -e.amount);

export function propertyNetIncome(property: Property, entries: RentalEntry[]): number {
  return entries.filter((e) => e.propertyId === property.id && !e.isPending).reduce((s, e) => s + entryDelta(e), 0);
}

export function propertyPendingNetImpact(property: Property, entries: RentalEntry[]): number {
  return entries.filter((e) => e.propertyId === property.id && e.isPending).reduce((s, e) => s + entryDelta(e), 0);
}

export function netIncomeByCurrency(properties: Property[], entries: RentalEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  properties.forEach((p) => { out[p.currencyCode] = (out[p.currencyCode] || 0) + propertyNetIncome(p, entries); });
  return out;
}

export function netIncomePendingByCurrency(properties: Property[], entries: RentalEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  properties.forEach((p) => { out[p.currencyCode] = (out[p.currencyCode] || 0) + propertyPendingNetImpact(p, entries); });
  return out;
}

export interface PropertyNetIncomeRow { propertyId: string; name: string; net: number; }

export function netIncomeByProperty(properties: Property[], entries: RentalEntry[], currencyCode: string): PropertyNetIncomeRow[] {
  return properties.filter((p) => p.currencyCode === currencyCode).map((p) => ({ propertyId: p.id, name: p.name, net: propertyNetIncome(p, entries) }));
}

/** Actual cleared category totals; pending rent/expense entries are excluded
 * until they clear. */
export function propertyByCategory(property: Property, entries: RentalEntry[], categories: Category[]): Record<string, number> {
  const out: Record<string, number> = {};
  entries.filter((e) => e.propertyId === property.id && !e.isPending).forEach((e) => {
    const cat = e.isDeposit ? 'Rent income' : categoryName(e.categoryID, categories);
    out[cat] = (out[cat] || 0) + entryDelta(e);
  });
  return out;
}

export interface MonthlyRollupRow { month: string; income: number; expense: number; net: number; }

export function propertyMonthlyRollup(property: Property, entries: RentalEntry[]): MonthlyRollupRow[] {
  const byMonth: Record<string, { income: number; expense: number }> = {};
  entries.filter((e) => e.propertyId === property.id && !e.isPending).forEach((e) => {
    const month = e.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
    if (e.isDeposit) byMonth[month].income += e.amount;
    else byMonth[month].expense += e.amount;
  });
  return Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([month, { income, expense }]) => ({ month, income, expense, net: income - expense }));
}
