import { describe, expect, it } from 'vitest';
import { computeNetWorthByCurrency, flowByCurrency } from '../netWorth';

describe('computeNetWorthByCurrency', () => {
  it('sums assets across modules per currency', () => {
    const rows = computeNetWorthByCurrency({
      cash: { USD: 100 },
      bank: { USD: 200 },
      qse: {},
      psx: { PKR: 5000 },
      funds: { USD: 50 },
      personalLoansNet: {},
      emiOutstanding: {},
      creditCards: {},
    });
    const usd = rows.find((r) => r.currency === 'USD')!;
    expect(usd.assets).toBe(350);
    expect(usd.liabilities).toBe(0);
    expect(usd.net).toBe(350);
    const pkr = rows.find((r) => r.currency === 'PKR')!;
    expect(pkr.net).toBe(5000);
  });

  it('treats a positive personal-loan net position as an asset', () => {
    const rows = computeNetWorthByCurrency({
      cash: {},
      bank: {},
      qse: {},
      psx: {},
      funds: {},
      personalLoansNet: { USD: 300 },
      emiOutstanding: {},
      creditCards: {},
    });
    const usd = rows.find((r) => r.currency === 'USD')!;
    expect(usd.assets).toBe(300);
    expect(usd.liabilities).toBe(0);
    expect(usd.net).toBe(300);
  });

  it('treats a negative personal-loan net position as a liability', () => {
    const rows = computeNetWorthByCurrency({
      cash: { USD: 1000 },
      bank: {},
      qse: {},
      psx: {},
      funds: {},
      personalLoansNet: { USD: -300 },
      emiOutstanding: {},
      creditCards: {},
    });
    const usd = rows.find((r) => r.currency === 'USD')!;
    expect(usd.assets).toBe(1000);
    expect(usd.liabilities).toBe(300);
    expect(usd.net).toBe(700);
  });

  it('always treats EMI outstanding as a liability', () => {
    const rows = computeNetWorthByCurrency({
      cash: { USD: 1000 },
      bank: {},
      qse: {},
      psx: {},
      funds: {},
      personalLoansNet: {},
      emiOutstanding: { USD: 400 },
      creditCards: {},
    });
    const usd = rows.find((r) => r.currency === 'USD')!;
    expect(usd.assets).toBe(1000);
    expect(usd.liabilities).toBe(400);
    expect(usd.net).toBe(600);
  });

  it('always treats credit card debt as a liability, never blended into bank assets', () => {
    const rows = computeNetWorthByCurrency({
      cash: {},
      bank: { USD: 1000 }, // asset accounts only — the card's own debt is NOT in here
      qse: {},
      psx: {},
      funds: {},
      personalLoansNet: {},
      emiOutstanding: {},
      creditCards: { USD: 150 },
    });
    const usd = rows.find((r) => r.currency === 'USD')!;
    expect(usd.assets).toBe(1000);
    expect(usd.liabilities).toBe(150);
    expect(usd.net).toBe(850);
    expect(usd.breakdown).toContainEqual({ module: 'Credit cards', amount: -150 });
  });

  it('never blends currencies together', () => {
    const rows = computeNetWorthByCurrency({
      cash: { USD: 100 },
      bank: { PKR: 5000 },
      qse: {},
      psx: {},
      funds: {},
      personalLoansNet: {},
      emiOutstanding: {},
      creditCards: {},
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.currency === 'USD')!.net).toBe(100);
    expect(rows.find((r) => r.currency === 'PKR')!.net).toBe(5000);
  });

  it('breaks down a currency total by contributing module, omitting untouched ones', () => {
    const rows = computeNetWorthByCurrency({
      cash: { USD: 100 },
      bank: { USD: 200 },
      qse: {},
      psx: {},
      funds: {},
      personalLoansNet: { USD: -50 },
      emiOutstanding: { USD: 30 },
      creditCards: {},
    });
    const usd = rows.find((r) => r.currency === 'USD')!;
    expect(usd.breakdown).toEqual([
      { module: 'Cash', amount: 100 },
      { module: 'Bank', amount: 200 },
      { module: 'Personal Loans (net)', amount: -50 },
      { module: 'EMI/Loans (outstanding)', amount: -30 },
    ]);
  });

  it('returns an empty list when every input is empty', () => {
    const rows = computeNetWorthByCurrency({
      cash: {},
      bank: {},
      qse: {},
      psx: {},
      funds: {},
      personalLoansNet: {},
      emiOutstanding: {},
      creditCards: {},
    });
    expect(rows).toEqual([]);
  });
});

describe('flowByCurrency', () => {
  const cashEntries = [
    { date: '2026-08-01', isDeposit: true, amount: 500, currencyCode: 'USD' },
    { date: '2026-08-15', isDeposit: false, amount: 100, currencyCode: 'USD' },
    { date: '2026-08-15', isDeposit: true, amount: 1000, currencyCode: 'PKR' },
  ];
  const bankAccounts = [{ id: 'a1', currencyCode: 'USD' }];
  const bankTransactions = [
    { accountId: 'a1', date: '2026-08-15', amount: -50 },
    { accountId: 'a1', date: '2026-07-31', amount: 999 }, // outside range, ignored
  ];

  it('combines Cash (unsigned isDeposit+amount) and Bank (signed amount) within a date range', () => {
    const out = flowByCurrency(cashEntries, bankAccounts, bankTransactions, '2026-08-15', '2026-08-15');
    // USD: -100 (cash OUT) + -50 (bank debit) = -150; PKR: +1000 (cash IN)
    expect(out.USD).toBe(-150);
    expect(out.PKR).toBe(1000);
  });

  it('excludes transactions outside the date range', () => {
    const out = flowByCurrency(cashEntries, bankAccounts, bankTransactions, '2026-08-01', '2026-08-01');
    expect(out.USD).toBe(500);
    expect(out.PKR).toBeUndefined();
  });

  it('ignores a bank transaction whose account is unknown', () => {
    const out = flowByCurrency([], [], [{ accountId: 'missing', date: '2026-08-15', amount: 100 }], '2026-08-15', '2026-08-15');
    expect(out).toEqual({});
  });
});
