import { describe, expect, it } from 'vitest';
import { earliestActivityDate, netWorthAsOfDate, priceAsOfDate } from '../netWorthAsOf';
import type { QSESettings } from '../../../types/workbook';
import type { PSXSettings } from '../../../types/psxWorkbook';

const emptyInputs = () => ({
  cashEntries: [],
  cashSettings: { defaultCurrency: 'USD' },
  bankAccounts: [],
  bankTransactions: [],
  personalLoans: [],
  personalLoanRepayments: [],
  emiLoans: [],
  fundsFunds: [],
  fundsTransactions: [],
  fundsPriceHistory: {},
  qseTransactions: [],
  qseTransfers: [],
  qseAdjustments: [],
  qsePriceHistory: {},
  qseSettings: { feePct: 0.15, minFee: 5, tick: 0.01, currency: 'QAR', depositFee: 0 } as QSESettings,
  psxTransactions: [],
  psxTransfers: [],
  psxAdjustments: [],
  psxPriceHistory: {},
  psxSettings: {
    feePct: 0.2, lowPriceThreshold: 25, lowPriceFee: 0.05, sstPct: 15, nccplFeePct: 0.0119,
    currency: 'PKR', costBasisMethod: 'average',
  } as PSXSettings,
});

describe('priceAsOfDate', () => {
  it('returns 0 when nothing is known that far back', () => {
    expect(priceAsOfDate('AAPL', {}, '2026-01-01')).toBe(0);
    expect(priceAsOfDate('AAPL', { AAPL: [{ date: '2026-02-01', price: 10 }] }, '2026-01-01')).toBe(0);
  });

  it('picks the latest point on or before the date, ignoring later ones', () => {
    const history = { AAPL: [{ date: '2026-01-01', price: 10 }, { date: '2026-01-15', price: 12 }, { date: '2026-02-01', price: 20 }] };
    expect(priceAsOfDate('AAPL', history, '2026-01-20')).toBe(12);
    expect(priceAsOfDate('AAPL', history, '2026-01-01')).toBe(10);
  });
});

describe('netWorthAsOfDate', () => {
  it('sums Cash and Bank balances as of a past date, ignoring later activity', () => {
    const inputs = {
      ...emptyInputs(),
      cashEntries: [
        { id: 'c1', date: '2026-01-05', isDeposit: true, amount: 1000, currencyCode: 'USD', categoryID: 'x', serialNumber: 1 },
        { id: 'c2', date: '2026-02-10', isDeposit: true, amount: 5000, currencyCode: 'USD', categoryID: 'x', serialNumber: 2 }, // after asOfDate
      ],
    };
    const rows = netWorthAsOfDate('2026-01-31', inputs as never);
    const usd = rows.find((r) => r.currency === 'USD');
    expect(usd?.assets).toBeCloseTo(1000, 6); // the Feb deposit must not count yet
  });

  it('a loan given AFTER the query date contributes nothing', () => {
    const inputs = {
      ...emptyInputs(),
      personalLoans: [{ id: 'l1', person: 'Bob', direction: 'owed_to_me' as const, currencyCode: 'USD', principal: 500, date: '2026-02-01' }],
    };
    const rows = netWorthAsOfDate('2026-01-31', inputs as never);
    expect(rows.find((r) => r.currency === 'USD')).toBeUndefined();
  });

  it('an EMI loan not yet started (startDate after asOfDate) contributes no liability', () => {
    const inputs = {
      ...emptyInputs(),
      emiLoans: [{
        id: 'e1', name: 'Car', lender: 'Bank', currencyCode: 'USD', principal: 10000, tenureMonths: 12,
        startDate: '2026-06-01', repaymentMode: 'interest' as const, annualRatePct: 12,
      }],
    };
    const rows = netWorthAsOfDate('2026-01-31', inputs as never);
    expect(rows.find((r) => r.currency === 'USD')).toBeUndefined();
  });

  it('an EMI loan already running contributes its real outstanding balance as of that date', () => {
    const inputs = {
      ...emptyInputs(),
      emiLoans: [{
        id: 'e1', name: 'Car', lender: 'Bank', currencyCode: 'USD', principal: 10000, tenureMonths: 12,
        startDate: '2026-01-01', repaymentMode: 'interest' as const, annualRatePct: 0,
      }],
    };
    // 0% interest, 10000/12 principal reduction per month — after 3 months elapsed, ~7500 left.
    const rows = netWorthAsOfDate('2026-04-01', inputs as never);
    const usd = rows.find((r) => r.currency === 'USD');
    expect(usd?.liabilities).toBeCloseTo(7500, 0);
  });

  it('a bank account with an opening balance but no transaction that old contributes nothing (2026-09-06 fix)', () => {
    // The account's real transactions only start in 2026; its openingBalance
    // is really "the balance as of whenever it was seeded," not something
    // that was already true in 2024 — a date before its first transaction
    // must show NO figure for it, not a phantom copy of that balance.
    const inputs = {
      ...emptyInputs(),
      bankAccounts: [{ id: 'a1', name: 'UBL', currencyCode: 'PKR', openingBalance: 5000 }],
      bankTransactions: [{ id: 't1', accountId: 'a1', date: '2026-01-10', amount: 200, description: 'x', categoryID: 'x', serialNumber: 1 }],
    };
    const before = netWorthAsOfDate('2024-06-01', inputs as never);
    expect(before.find((r) => r.currency === 'PKR')).toBeUndefined();

    // Once the account's own first transaction has happened, it correctly
    // contributes opening balance + every transaction up to that date.
    const after = netWorthAsOfDate('2026-01-31', inputs as never);
    expect(after.find((r) => r.currency === 'PKR')?.assets).toBeCloseTo(5200, 6);
  });

  it('a bank account with literally zero transactions ever never appears in any past-month figure', () => {
    const inputs = {
      ...emptyInputs(),
      bankAccounts: [{ id: 'a1', name: 'Car loan escrow', currencyCode: 'USD', openingBalance: 1000 }],
    };
    const rows = netWorthAsOfDate('2026-01-31', inputs as never);
    expect(rows.find((r) => r.currency === 'USD')).toBeUndefined();
  });

  it('values a QSE position using the price known AS OF that date, not a later one', () => {
    const base = {
      ...emptyInputs(),
      qseTransfers: [{ id: 't0', seq: 1, date: '2026-01-01', type: 'DEPOSIT' as const, gross: 5000, fee: 0 }],
      qseTransactions: [{ date: '2026-01-01', ticker: 'QIBK', action: 'BUY' as const, shares: 100, price: 10 }],
      qsePriceHistory: { QIBK: [{ date: '2026-01-01', price: 10 }, { date: '2026-03-01', price: 20 }] },
    };
    // Only the 10-price point is known as of 2026-01-15 — value should be
    // substantially lower than once the 20-price point is also known.
    const earlyRows = netWorthAsOfDate('2026-01-15', base as never);
    const laterRows = netWorthAsOfDate('2026-04-01', base as never);
    const early = earlyRows.find((r) => r.currency === 'QAR')!.assets;
    const later = laterRows.find((r) => r.currency === 'QAR')!.assets;
    expect(later - early).toBeCloseTo(1000, -1); // ~100 shares * (20-10) more, within fee rounding
  });
});

describe('earliestActivityDate', () => {
  it('returns undefined when nothing is dated anywhere', () => {
    expect(earliestActivityDate(emptyInputs() as never)).toBeUndefined();
  });

  it('finds the true minimum across completely different modules', () => {
    const inputs = {
      ...emptyInputs(),
      bankTransactions: [{ id: 't1', accountId: 'a1', date: '2025-06-01', amount: 1, description: 'x', categoryID: 'x', serialNumber: 1 }],
      cashEntries: [{ id: 'c1', date: '2025-01-15', isDeposit: true, amount: 1, currencyCode: 'USD', categoryID: 'x', serialNumber: 1 }],
      emiLoans: [{
        id: 'e1', name: 'Car', lender: 'Bank', currencyCode: 'USD', principal: 1, tenureMonths: 1,
        startDate: '2024-03-01', repaymentMode: 'interest' as const, annualRatePct: 0,
      }],
    };
    expect(earliestActivityDate(inputs as never)).toBe('2024-03-01');
  });
});
