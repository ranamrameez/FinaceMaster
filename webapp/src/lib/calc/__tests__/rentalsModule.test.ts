import { describe, expect, it } from 'vitest';
import type { Property, RentalEntry } from '../../../types/rentalsWorkbook';
import { netIncomeByCurrency, netIncomeByProperty, propertyByCategory, propertyMonthlyRollup, propertyNetIncome } from '../rentalsModule';

const property = (over: Partial<Property>): Property => ({
  id: 'p1',
  name: 'Apartment 4B',
  currencyCode: 'USD',
  ...over,
});

const entry = (over: Partial<RentalEntry>): RentalEntry => ({
  id: 'e1',
  propertyId: 'p1',
  date: '2026-01-01',
  type: 'RENT_INCOME',
  amount: 1000,
  ...over,
});

describe('propertyNetIncome', () => {
  it('nets rent income minus expenses for one property', () => {
    const p = property({ id: 'p1' });
    const entries = [
      entry({ id: 'e1', propertyId: 'p1', type: 'RENT_INCOME', amount: 1500 }),
      entry({ id: 'e2', propertyId: 'p1', type: 'EXPENSE', amount: 300, category: 'Maintenance' }),
    ];
    expect(propertyNetIncome(p, entries)).toBe(1200);
  });

  it('ignores entries for other properties', () => {
    const p = property({ id: 'p1' });
    const entries = [
      entry({ id: 'e1', propertyId: 'p1', type: 'RENT_INCOME', amount: 1000 }),
      entry({ id: 'e2', propertyId: 'other', type: 'RENT_INCOME', amount: 99999 }),
    ];
    expect(propertyNetIncome(p, entries)).toBe(1000);
  });
});

describe('netIncomeByCurrency', () => {
  it('groups multiple properties by currency without converting', () => {
    const properties = [
      property({ id: 'p1', currencyCode: 'USD' }),
      property({ id: 'p2', currencyCode: 'USD' }),
      property({ id: 'p3', currencyCode: 'AED' }),
    ];
    const entries = [
      entry({ propertyId: 'p1', type: 'RENT_INCOME', amount: 1000 }),
      entry({ propertyId: 'p2', type: 'RENT_INCOME', amount: 500 }),
      entry({ propertyId: 'p3', type: 'RENT_INCOME', amount: 2000 }),
    ];
    const totals = netIncomeByCurrency(properties, entries);
    expect(totals.USD).toBe(1500);
    expect(totals.AED).toBe(2000);
  });
});

describe('netIncomeByProperty', () => {
  it('returns one row per property in the given currency, others excluded', () => {
    const properties = [
      property({ id: 'p1', name: 'Apartment 4B', currencyCode: 'USD' }),
      property({ id: 'p2', name: 'Studio 2A', currencyCode: 'USD' }),
      property({ id: 'p3', name: 'Villa 9', currencyCode: 'AED' }),
    ];
    const entries = [
      entry({ propertyId: 'p1', type: 'RENT_INCOME', amount: 1000 }),
      entry({ propertyId: 'p2', type: 'RENT_INCOME', amount: 500 }),
      entry({ propertyId: 'p2', type: 'EXPENSE', amount: 100, category: 'Repairs' }),
      entry({ propertyId: 'p3', type: 'RENT_INCOME', amount: 9999 }),
    ];
    const rows = netIncomeByProperty(properties, entries, 'USD');
    expect(rows).toEqual([
      { propertyId: 'p1', name: 'Apartment 4B', net: 1000 },
      { propertyId: 'p2', name: 'Studio 2A', net: 400 },
    ]);
  });
});

describe('propertyByCategory', () => {
  it('buckets rent income separately from categorized expenses', () => {
    const p = property({ id: 'p1' });
    const entries = [
      entry({ id: 'e1', type: 'RENT_INCOME', amount: 1500 }),
      entry({ id: 'e2', type: 'EXPENSE', amount: 200, category: 'Maintenance' }),
      entry({ id: 'e3', type: 'EXPENSE', amount: 100, category: 'Maintenance' }),
      entry({ id: 'e4', type: 'EXPENSE', amount: 50, category: 'Property tax' }),
    ];
    const byCategory = propertyByCategory(p, entries);
    expect(byCategory['Rent income']).toBe(1500);
    expect(byCategory.Maintenance).toBe(-300);
    expect(byCategory['Property tax']).toBe(-50);
  });
});

describe('propertyMonthlyRollup', () => {
  it('groups income/expense/net by month, chronologically', () => {
    const p = property({ id: 'p1' });
    const entries = [
      entry({ id: 'e1', date: '2026-02-05', type: 'RENT_INCOME', amount: 1000 }),
      entry({ id: 'e2', date: '2026-01-10', type: 'RENT_INCOME', amount: 1000 }),
      entry({ id: 'e3', date: '2026-01-15', type: 'EXPENSE', amount: 200, category: 'Repairs' }),
    ];
    const rows = propertyMonthlyRollup(p, entries);
    expect(rows.map((r) => r.month)).toEqual(['2026-01', '2026-02']);
    expect(rows[0]).toEqual({ month: '2026-01', income: 1000, expense: 200, net: 800 });
    expect(rows[1]).toEqual({ month: '2026-02', income: 1000, expense: 0, net: 1000 });
  });
});
