import { describe, expect, it } from 'vitest';
import fixture from './fixtures/psx-workbook-backup.json';
import type { Transaction } from '../../../types/workbook';
import type { PSXSettings } from '../../../types/psxWorkbook';
import { calcCGT, calcFeeBreakdown, makePSXFeeCalculator, sameDayChargedSide } from '../psxFees';
import { computePositions } from '../positions';
import { cashSummary } from '../cashSummary';

// Mirrors calc.test.ts's structure: hand-traced synthetic examples for the
// pure fee functions, plus a sanity pass over the real backup fixture
// (same file used as the app's `psx/psx-workbook-backup.json`) to make sure
// the whole pipeline (positions/cashSummary) still runs clean over real
// data and produces numbers in the right ballpark.

const BASE_SETTINGS: PSXSettings = {
  feePct: 0.2,
  lowPriceThreshold: 25,
  lowPriceFee: 0.05,
  sstPct: 15,
  sstIncludedInCommission: false,
  psxFeePct: 0,
  nccplFeePct: 0.011,
  secpLevyPct: 0,
  cdcPerShare: 0,
  cvtPct: 0.01,
  minFee: 0,
  tick: 0.01,
  currency: 'PKR',
  depositFee: 0,
  cgtFilerPct: 15,
  cgtNonFilerPct: 30,
  filerStatus: 'filer',
};

describe('calcFeeBreakdown', () => {
  it('uses the percentage commission tier above the low-price threshold', () => {
    // 100 shares @ 102.94 = 10294 amount, price > 25 => pct-of-amount commission.
    const fb = calcFeeBreakdown(10294, false, 100, BASE_SETTINGS);
    // calcFeeBreakdown rounds each line item to 2dp before returning.
    expect(fb.commission).toBeCloseTo(10294 * 0.002, 2);
    expect(fb.taxOnCommission).toBeCloseTo(fb.commission * 0.15, 2);
    expect(fb.cvt).toBe(0); // sell-side: no CVT
  });

  it('uses the flat per-share commission tier at/under the low-price threshold', () => {
    // price = 20 (<= 25 threshold) => flat lowPriceFee per share, not a % of amount.
    const shares = 50;
    const price = 20;
    const fb = calcFeeBreakdown(shares * price, true, shares, BASE_SETTINGS);
    expect(fb.commission).toBeCloseTo(shares * BASE_SETTINGS.lowPriceFee, 5);
  });

  it('charges CVT only on the buy side', () => {
    const amount = 5000;
    const buy = calcFeeBreakdown(amount, true, 100, BASE_SETTINGS);
    const sell = calcFeeBreakdown(amount, false, 100, BASE_SETTINGS);
    expect(buy.cvt).toBeCloseTo(amount * (BASE_SETTINGS.cvtPct / 100), 5);
    expect(sell.cvt).toBe(0);
  });

  it('floors the total at minFee when set', () => {
    const settings = { ...BASE_SETTINGS, minFee: 50 };
    const fb = calcFeeBreakdown(100, true, 5, settings); // tiny trade, real fees far below 50
    expect(fb.total).toBe(50);
  });

  it('returns all-zero for a non-positive amount', () => {
    const fb = calcFeeBreakdown(0, true, 0, BASE_SETTINGS);
    expect(fb.total).toBe(0);
    expect(fb.commission).toBe(0);
  });
});

describe('calcCGT', () => {
  it('applies the filer rate when filerStatus is filer', () => {
    expect(calcCGT(1000, BASE_SETTINGS)).toBeCloseTo(150, 5);
  });

  it('applies the (higher) non-filer rate when filerStatus is nonfiler', () => {
    const settings = { ...BASE_SETTINGS, filerStatus: 'nonfiler' as const };
    expect(calcCGT(1000, settings)).toBeCloseTo(300, 5);
  });

  it('charges nothing on a loss or zero gain', () => {
    expect(calcCGT(0, BASE_SETTINGS)).toBe(0);
    expect(calcCGT(-500, BASE_SETTINGS)).toBe(0);
  });
});

describe('sameDayChargedSide', () => {
  const day = '2026-08-21';
  const tx = (action: 'BUY' | 'SELL', shares: number): Transaction => ({ date: day, ticker: 'TEST', action, shares, price: 100 });

  it('returns null when there is no same-day pairing', () => {
    expect(sameDayChargedSide([tx('BUY', 10)], 'TEST', day)).toBeNull();
  });

  it('charges the larger side when sell volume exceeds buy volume', () => {
    const txs = [tx('BUY', 14), tx('SELL', 47)];
    expect(sameDayChargedSide(txs, 'TEST', day)).toBe('SELL');
  });

  it('charges the larger side when buy volume exceeds sell volume', () => {
    const txs = [tx('BUY', 50), tx('SELL', 10)];
    expect(sameDayChargedSide(txs, 'TEST', day)).toBe('BUY');
  });

  it('ties go to BUY', () => {
    const txs = [tx('BUY', 20), tx('SELL', 20)];
    expect(sameDayChargedSide(txs, 'TEST', day)).toBe('BUY');
  });
});

describe('makePSXFeeCalculator — same-day netting (README items 6/7)', () => {
  const day = '2026-08-21';
  const netSettings: PSXSettings = { ...BASE_SETTINGS, psxFeePct: 0.005, nccplFeePct: 0.011 };

  it('charges full commission+SST on the larger (charged) side, levies-only on the netted side', () => {
    const buyTx: Transaction = { date: day, ticker: 'TEST', action: 'BUY', shares: 14, price: 100 };
    const sellTx: Transaction = { date: day, ticker: 'TEST', action: 'SELL', shares: 47, price: 100 };
    const all = [buyTx, sellTx];
    const calcFee = makePSXFeeCalculator(netSettings, all);

    const buyAmount = buyTx.shares * buyTx.price;
    const sellAmount = sellTx.shares * sellTx.price;

    const buyFee = calcFee(buyAmount, true, { shares: buyTx.shares, tx: buyTx });
    const sellFee = calcFee(sellAmount, false, { shares: sellTx.shares, tx: sellTx });

    // Netted (BUY) side: government levies only — no commission, no SST.
    // CVT still applies (it's a buy-side stamp duty, not a commission).
    const expectedBuyFee =
      buyAmount * (netSettings.psxFeePct / 100) +
      buyAmount * (netSettings.nccplFeePct / 100) +
      buyAmount * (netSettings.cvtPct / 100);
    expect(buyFee).toBeCloseTo(Math.round(expectedBuyFee * 100) / 100, 2);

    // Charged (SELL) side: full breakdown, strictly more than the netted side's rate would produce.
    const fullBreakdownOnSell = calcFeeBreakdown(sellAmount, false, sellTx.shares, netSettings).total;
    expect(sellFee).toBeCloseTo(fullBreakdownOnSell, 5);
    expect(sellFee).toBeGreaterThan(expectedBuyFee); // charged side pays commission, netted side doesn't
  });

  it('falls back to a full single-leg breakdown when there is no real tx context (hypothetical calculators)', () => {
    const calcFee = makePSXFeeCalculator(netSettings, []);
    const fee = calcFee(10000, false, { shares: 100 });
    expect(fee).toBeCloseTo(calcFeeBreakdown(10000, false, 100, netSettings).total, 5);
  });
});

describe('PSX calc pipeline over the real workbook backup fixture', () => {
  const transactions = fixture.transactions as Transaction[];
  const settings = fixture.settings as PSXSettings;
  const calcFee = makePSXFeeCalculator(settings, transactions);

  it('computes positions for every fixture ticker without throwing', () => {
    const positions = computePositions(transactions, calcFee);
    const tickers = new Set(transactions.map((t) => t.ticker));
    expect(positions.length).toBe(tickers.size);
    positions.forEach((p) => {
      expect(Number.isFinite(p.invested)).toBe(true);
      expect(Number.isFinite(p.realized)).toBe(true);
      expect(p.shares).toBeGreaterThanOrEqual(0);
    });
  });

  it('produces a finite cash summary', () => {
    const summary = cashSummary(transactions, fixture.transfers as never[], fixture.adjustments as never[], fixture.marketPrices as Record<string, number>, calcFee);
    expect(Number.isFinite(summary.netWorth)).toBe(true);
    expect(Number.isFinite(summary.tradingFees)).toBe(true);
    expect(summary.tradingFees).toBeGreaterThan(0); // fixture has real commission-bearing trades
  });

  it('same-day SNGP round trip on 2026-08-21 nets the smaller (buy) side to near-zero fee under this fixture\'s settings', () => {
    // The fixture's settings have psxFeePct/nccplFeePct/secpLevyPct/cdcPerShare/cvtPct
    // all at 0 — under those settings the netted side's fee is exactly 0.
    const dayBuys = transactions.filter((t) => t.ticker === 'SNGP' && t.date === '2026-08-21' && t.action === 'BUY');
    expect(dayBuys.length).toBeGreaterThan(0);
    dayBuys.forEach((tx) => {
      const fee = calcFee(tx.shares * tx.price, true, { shares: tx.shares, tx });
      expect(fee).toBe(0);
    });
  });
});
