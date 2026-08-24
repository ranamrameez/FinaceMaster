import { describe, expect, it } from 'vitest';
import { computeNetWorthByCurrency } from '../netWorth';

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
    });
    const usd = rows.find((r) => r.currency === 'USD')!;
    expect(usd.assets).toBe(1000);
    expect(usd.liabilities).toBe(400);
    expect(usd.net).toBe(600);
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
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.currency === 'USD')!.net).toBe(100);
    expect(rows.find((r) => r.currency === 'PKR')!.net).toBe(5000);
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
    });
    expect(rows).toEqual([]);
  });
});
