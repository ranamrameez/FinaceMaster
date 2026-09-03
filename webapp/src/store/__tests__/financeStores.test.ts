import { beforeEach, describe, expect, it } from 'vitest';
import { useBankWorkbookStore } from '../bankWorkbookStore';
import { useCashWorkbookStore } from '../cashWorkbookStore';
import { useRentalsWorkbookStore } from '../rentalsWorkbookStore';
import { createEmptyBankWorkbook } from '../defaultBankWorkbook';
import { createEmptyCashWorkbook } from '../defaultCashWorkbook';
import { createEmptyRentalsWorkbook } from '../defaultRentalsWorkbook';
import { UNCATEGORIZED_ID } from '../../lib/categories';

beforeEach(() => {
  localStorage.clear();
  useBankWorkbookStore.getState().setWorkbook(createEmptyBankWorkbook());
  useCashWorkbookStore.getState().setWorkbook(createEmptyCashWorkbook());
  useRentalsWorkbookStore.getState().setWorkbook(createEmptyRentalsWorkbook());
});

describe('bankWorkbookStore — Finance restructure (2026-09-03)', () => {
  it('derives isDeposit from the signed amount, not whatever was passed in — amount stays the one authoritative field', () => {
    useBankWorkbookStore.getState().addAccount({ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 });
    // Deliberately passes a WRONG isDeposit to prove the store re-derives it
    // rather than trusting the caller — the whole point of "one source of
    // truth" for Bank (see types/finance.ts's file-level comment).
    useBankWorkbookStore.getState().addTransaction({
      id: 't1', accountId: 'a1', date: '2026-01-01', amount: -50, isDeposit: true, description: 'Groceries', source: 'manual',
    });
    expect(useBankWorkbookStore.getState().workbook.transactions[0].isDeposit).toBe(false);
  });

  it('re-derives isDeposit on every update too, so editing amount alone keeps it consistent', () => {
    useBankWorkbookStore.getState().addAccount({ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 });
    useBankWorkbookStore.getState().addTransaction({
      id: 't1', accountId: 'a1', date: '2026-01-01', amount: -50, isDeposit: false, description: 'Groceries', source: 'manual',
    });
    useBankWorkbookStore.getState().updateTransaction('t1', { amount: 200 });
    expect(useBankWorkbookStore.getState().workbook.transactions[0].isDeposit).toBe(true);
  });

  it('migrates a legacy free-text category to a real categoryID on load, without losing the original text', () => {
    useBankWorkbookStore.getState().setWorkbook({
      settings: { accounts: [{ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 }] },
      transactions: [{
        id: 't1', accountId: 'a1', date: '2026-01-01', amount: -50, isDeposit: false,
        description: 'Groceries', category: 'Grocery', source: 'manual',
      } as never],
    });
    const tx = useBankWorkbookStore.getState().workbook.transactions[0];
    expect(tx.categoryID).toBe('cat_grocery');
    expect(tx.category).toBe('Grocery'); // original text preserved, not deleted
  });

  it('falls back to Uncategorized for a transaction with no category at all', () => {
    useBankWorkbookStore.getState().addAccount({ id: 'a1', name: 'Checking', currencyCode: 'USD', openingBalance: 0 });
    useBankWorkbookStore.getState().addTransaction({
      id: 't1', accountId: 'a1', date: '2026-01-01', amount: -50, isDeposit: false, description: 'Groceries', source: 'manual',
    });
    expect(useBankWorkbookStore.getState().workbook.transactions[0].categoryID).toBe(UNCATEGORIZED_ID);
  });

  it('backfills serialNumber on load, monotonically, in chronological order', () => {
    useBankWorkbookStore.getState().setWorkbook({
      settings: { accounts: [] },
      transactions: [
        { id: 't2', accountId: 'a1', date: '2026-01-10', amount: 10, isDeposit: true, description: 'Later', source: 'manual' },
        { id: 't1', accountId: 'a1', date: '2026-01-01', amount: 10, isDeposit: true, description: 'Earlier', source: 'manual' },
      ] as never,
    });
    const [t2, t1] = useBankWorkbookStore.getState().workbook.transactions;
    expect(t1.serialNumber).toBeLessThan(t2.serialNumber!);
  });
});

describe('cashWorkbookStore — Finance restructure (2026-09-03)', () => {
  it('stores isDeposit as the real, independently-set field (no signed-amount convention, unlike Bank)', () => {
    useCashWorkbookStore.getState().addEntry({
      id: 'e1', date: '2026-01-01', isDeposit: true, amount: 100, currencyCode: 'USD', source: 'manual',
    });
    expect(useCashWorkbookStore.getState().workbook.entries[0].isDeposit).toBe(true);
  });

  it('migrates a legacy category on load', () => {
    useCashWorkbookStore.getState().setWorkbook({
      settings: { defaultCurrency: 'USD' },
      entries: [{ id: 'e1', date: '2026-01-01', isDeposit: false, amount: 50, currencyCode: 'USD', category: 'Grocery', source: 'manual' } as never],
    });
    expect(useCashWorkbookStore.getState().workbook.entries[0].categoryID).toBe('cat_grocery');
  });

  it('CRITICAL regression (caught via live testing against real data): a real pre-restructure entry has the legacy `type` field and NO `isDeposit` at all — must not silently read as isDeposit:false/OUT', () => {
    useCashWorkbookStore.getState().setWorkbook({
      settings: { defaultCurrency: 'USD' },
      entries: [
        // No `isDeposit` key whatsoever — exactly what real old localStorage/Firebase data looks like.
        { id: 'e1', date: '2026-01-01', type: 'IN', amount: 500, currencyCode: 'USD', source: 'manual' } as never,
        { id: 'e2', date: '2026-01-02', type: 'OUT', amount: 100, currencyCode: 'USD', source: 'manual' } as never,
      ],
    });
    const [inEntry, outEntry] = useCashWorkbookStore.getState().workbook.entries;
    expect(inEntry.isDeposit).toBe(true);
    expect(outEntry.isDeposit).toBe(false);
  });
});

describe('rentalsWorkbookStore — Finance restructure (2026-09-03)', () => {
  it('preserves isDeposit as set (RENT_INCOME -> true, EXPENSE -> false, the old type enum)', () => {
    useRentalsWorkbookStore.getState().addProperty({ id: 'p1', name: 'Flat', currencyCode: 'USD' });
    useRentalsWorkbookStore.getState().addEntry({ id: 'e1', propertyId: 'p1', date: '2026-01-01', isDeposit: true, amount: 500 });
    expect(useRentalsWorkbookStore.getState().workbook.entries[0].isDeposit).toBe(true);
  });

  it('migrates a legacy category on load', () => {
    useRentalsWorkbookStore.getState().setWorkbook({
      settings: { properties: [{ id: 'p1', name: 'Flat', currencyCode: 'USD' }] },
      entries: [{ id: 'e1', propertyId: 'p1', date: '2026-01-01', isDeposit: false, amount: 100, category: 'Grocery' } as never],
    });
    expect(useRentalsWorkbookStore.getState().workbook.entries[0].categoryID).toBe('cat_grocery');
  });

  it('CRITICAL regression (caught via live testing against real data): a real pre-restructure entry has the legacy `type` field and NO `isDeposit` at all — a RENT_INCOME entry must not silently read as an EXPENSE', () => {
    useRentalsWorkbookStore.getState().setWorkbook({
      settings: { properties: [{ id: 'p1', name: 'Flat', currencyCode: 'USD' }] },
      entries: [
        { id: 'e1', propertyId: 'p1', date: '2026-01-01', type: 'RENT_INCOME', amount: 1500, category: 'Rent' } as never,
        { id: 'e2', propertyId: 'p1', date: '2026-01-05', type: 'EXPENSE', amount: 200, category: 'Maintenance' } as never,
      ],
    });
    const [income, expense] = useRentalsWorkbookStore.getState().workbook.entries;
    expect(income.isDeposit).toBe(true);
    expect(expense.isDeposit).toBe(false);
  });
});
