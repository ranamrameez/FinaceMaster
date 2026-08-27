import { describe, expect, it } from 'vitest';
import fixture from './fixtures/psx-workbook-backup.json';
import type { Transaction } from '../../../types/workbook';
import type { PSXSettings } from '../../../types/psxWorkbook';
import { calcCGT, calcFeeBreakdown, feeScenarios, isNettedLeg, makePSXFeeCalculator, sameDayChargedSide } from '../psxFees';
import { computePositions } from '../positions';
import { cashSummary } from '../cashSummary';
import { DEFAULT_PSX_SETTINGS } from '../../../store/defaultPsxWorkbook';

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
  costBasisMethod: 'average',
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

describe('calcFeeBreakdown — Simple (all-in %) fee mode, user-requested 2026-08-27', () => {
  const SIMPLE_SETTINGS: PSXSettings = { ...BASE_SETTINGS, feeMode: 'simple', allInFeePct: 0.021 };

  it('charges exactly amount * allInFeePct, ignoring every itemized field', () => {
    // Matches the user's own worked example: 1 share @ 328.5, 0.021% all-in.
    const fb = calcFeeBreakdown(328.5, false, 1, SIMPLE_SETTINGS);
    expect(fb.total).toBeCloseTo(328.5 * 0.00021, 2);
    expect(fb.commission).toBe(fb.total);
    expect(fb.taxOnCommission).toBe(0);
    expect(fb.psxFee).toBe(0);
    expect(fb.nccplFee).toBe(0);
    expect(fb.secpLevy).toBe(0);
    expect(fb.cdc).toBe(0);
    expect(fb.cvt).toBe(0);
  });

  it('still respects minFee as a floor', () => {
    const settings = { ...SIMPLE_SETTINGS, minFee: 10 };
    const fb = calcFeeBreakdown(100, true, 5, settings);
    expect(fb.total).toBe(10);
  });

  it('feeScenarios shows a netted leg paying nothing extra, since Simple mode has no separate levies figure', () => {
    const scenarios = feeScenarios(328.5, false, 1, SIMPLE_SETTINGS);
    expect(scenarios.full).toBeCloseTo(328.5 * 0.00021, 2);
    expect(scenarios.netted).toBe(0);
  });

  it('makePSXFeeCalculator charges the full all-in rate on a charged leg and nothing on a netted one', () => {
    const buy: Transaction = { date: '2026-08-27', ticker: 'OGDC', action: 'BUY', shares: 1, price: 327.8 };
    const sell: Transaction = { date: '2026-08-27', ticker: 'OGDC', action: 'SELL', shares: 1, price: 328.5 };
    const calc = makePSXFeeCalculator(SIMPLE_SETTINGS, [buy, sell]);
    // Tie on quantity (1 vs 1) — ties go to BUY being the charged side (README item 79).
    expect(calc(327.8, true, { shares: 1, tx: buy })).toBeCloseTo(327.8 * 0.00021, 2);
    expect(calc(328.5, false, { shares: 1, tx: sell })).toBe(0);
  });

  it('an undefined feeMode behaves exactly like itemized — no existing account is silently switched', () => {
    const withUndefined = { ...BASE_SETTINGS, feeMode: undefined };
    const fb = calcFeeBreakdown(10294, false, 100, withUndefined);
    expect(fb.commission).toBeCloseTo(10294 * 0.002, 2);
  });
});

describe('feeScenarios', () => {
  it('full matches calcFeeBreakdown, netted matches levies-only sum', () => {
    const amount = 100 * 102.94;
    const scenarios = feeScenarios(amount, false, 100, BASE_SETTINGS);
    const fb = calcFeeBreakdown(amount, false, 100, BASE_SETTINGS);
    expect(scenarios.full).toBe(fb.total);
    expect(scenarios.netted).toBeCloseTo(fb.psxFee + fb.nccplFee + fb.secpLevy + fb.cdc + fb.cvt, 5);
    // Netted (levies only) must always be strictly cheaper than full
    // commission whenever there's a nonzero commission to skip.
    expect(scenarios.netted).toBeLessThan(scenarios.full);
  });

  it('netted is 0 when the settings have no levies configured at all', () => {
    const noLevies: PSXSettings = { ...BASE_SETTINGS, psxFeePct: 0, nccplFeePct: 0, secpLevyPct: 0, cdcPerShare: 0, cvtPct: 0 };
    const scenarios = feeScenarios(10000, true, 100, noLevies);
    expect(scenarios.netted).toBe(0);
    expect(scenarios.full).toBeGreaterThan(0);
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

describe('isNettedLeg / manualSameDay override (README item 7)', () => {
  const day = '2026-08-21';
  const otherDay = '2026-08-24';
  const netSettings: PSXSettings = { ...BASE_SETTINGS, psxFeePct: 0.005, nccplFeePct: 0.011 };

  it('is not netted when there is no same-day pairing and no manual override', () => {
    const tx: Transaction = { date: day, ticker: 'TEST', action: 'BUY', shares: 10, price: 100 };
    expect(isNettedLeg([tx], tx)).toBe(false);
  });

  it('matches auto-detection when there is a real same-day pairing', () => {
    const buyTx: Transaction = { date: day, ticker: 'TEST', action: 'BUY', shares: 14, price: 100 };
    const sellTx: Transaction = { date: day, ticker: 'TEST', action: 'SELL', shares: 47, price: 100 };
    const all = [buyTx, sellTx];
    expect(isNettedLeg(all, buyTx)).toBe(true); // smaller side, netted
    expect(isNettedLeg(all, sellTx)).toBe(false); // larger side, charged in full
  });

  it('manualSameDay forces netted treatment even when dates do not line up', () => {
    // Buy recorded a day later than the sell (e.g. settlement-date entry) — auto-detection
    // sees no same-day pairing for either date, but the user knows from their statement
    // that this leg was actually netted.
    const sellTx: Transaction = { date: day, ticker: 'TEST', action: 'SELL', shares: 20, price: 100 };
    const buyTx: Transaction = { date: otherDay, ticker: 'TEST', action: 'BUY', shares: 20, price: 100, manualSameDay: true };
    const all = [sellTx, buyTx];

    expect(sameDayChargedSide(all, 'TEST', otherDay)).toBeNull(); // auto-detection sees nothing
    expect(isNettedLeg(all, buyTx)).toBe(true); // manual override wins
    expect(isNettedLeg(all, sellTx)).toBe(false); // untouched — no override on this leg
  });

  it('documents why manualSameDay must never be set on both legs of a pair: both come out netted', () => {
    // This is the calc engine correctly honoring the manual override — the
    // actual bug (fixed 2026-08-24) was in the UI layer, which defaulted a
    // fresh same-day BUY row to manualSameDay:true and then failed to reset
    // it back to false when that same row's action was switched to SELL,
    // so both legs of a real same-day pair got saved with the flag set.
    // isNettedLeg trusts a manual override unconditionally by design (it's
    // meant to correct a single leg's date mismatch), so this is exactly
    // the failure mode that produces: a real user-reported "buy and sell
    // both have 0 fee" bug once both legs carry the flag.
    const buyTx: Transaction = { date: day, ticker: 'TEST', action: 'BUY', shares: 20, price: 100, manualSameDay: true };
    const sellTx: Transaction = { date: day, ticker: 'TEST', action: 'SELL', shares: 20, price: 100, manualSameDay: true };
    const all = [buyTx, sellTx];
    expect(isNettedLeg(all, buyTx)).toBe(true);
    expect(isNettedLeg(all, sellTx)).toBe(true); // both netted — the bug's exact symptom
  });

  it('a manually-netted transaction actually pays levies-only fees, not the full breakdown', () => {
    const buyTx: Transaction = { date: otherDay, ticker: 'TEST', action: 'BUY', shares: 20, price: 100, manualSameDay: true };
    const calcFee = makePSXFeeCalculator(netSettings, [buyTx]);
    const amount = buyTx.shares * buyTx.price;

    const fee = calcFee(amount, true, { shares: buyTx.shares, tx: buyTx });
    const fullBreakdown = calcFeeBreakdown(amount, true, buyTx.shares, netSettings).total;
    const expectedNettedFee =
      amount * (netSettings.psxFeePct / 100) + amount * (netSettings.nccplFeePct / 100) + amount * (netSettings.cvtPct / 100);

    expect(fee).toBeCloseTo(Math.round(expectedNettedFee * 100) / 100, 2);
    expect(fee).toBeLessThan(fullBreakdown);
  });
});

describe('makePSXFeeCalculator — feeOverride (README item 11)', () => {
  const day = '2026-08-21';
  const netSettings: PSXSettings = { ...BASE_SETTINGS, psxFeePct: 0.005, nccplFeePct: 0.011 };

  it('tx.feeOverride wins outright, even over a same-day-netted leg', () => {
    // A same-day round trip where the smaller (BUY) side would normally be netted —
    // but the override should short-circuit that entirely.
    const buyTx: Transaction = { date: day, ticker: 'TEST', action: 'BUY', shares: 14, price: 100, feeOverride: 42 };
    const sellTx: Transaction = { date: day, ticker: 'TEST', action: 'SELL', shares: 47, price: 100 };
    const calcFee = makePSXFeeCalculator(netSettings, [buyTx, sellTx]);
    expect(calcFee(buyTx.shares * buyTx.price, true, { shares: buyTx.shares, tx: buyTx })).toBe(42);
  });

  it('an override of exactly 0 still wins (not treated as "unset")', () => {
    const tx: Transaction = { date: day, ticker: 'TEST', action: 'BUY', shares: 10, price: 100, feeOverride: 0 };
    const calcFee = makePSXFeeCalculator(netSettings, [tx]);
    expect(calcFee(tx.shares * tx.price, true, { shares: tx.shares, tx })).toBe(0);
  });
});

describe('calcFeeBreakdown calibrated against a real broker contract note (2026-08-24)', () => {
  // Every value below is transcribed directly from a real JS Global
  // Capital / Zindigi contract note (Trade Date 24/08/2026) — commission
  // (Brok. Amount), SST Amount, and Levies Charges columns. Confirms
  // feePct=0.2%/lowPriceFee=PKR0.05, sstPct=15%, and the nccplFeePct=0.0119%
  // "Levies" calibration (see defaultPsxWorkbook.ts) all reconcile exactly
  // — this is the real ground truth the user asked to validate the formula
  // against, not a synthetic hand-traced case like the other tests here.
  const realRows: { shares: number; rate: number; brokAmount: number; sst: number; levies: number }[] = [
    { shares: 1, rate: 330.5, brokAmount: 0.66, sst: 0.1, levies: 0.04 },
    { shares: 1, rate: 331.46, brokAmount: 0.66, sst: 0.1, levies: 0.04 },
    { shares: 1, rate: 242.5, brokAmount: 0.49, sst: 0.07, levies: 0.03 },
    { shares: 15, rate: 374.25, brokAmount: 11.23, sst: 1.68, levies: 0.67 },
    { shares: 4, rate: 374.51, brokAmount: 3.0, sst: 0.45, levies: 0.18 },
    { shares: 10, rate: 376.12, brokAmount: 7.52, sst: 1.13, levies: 0.45 },
    { shares: 10, rate: 376.25, brokAmount: 7.53, sst: 1.13, levies: 0.45 },
    { shares: 10, rate: 377.1, brokAmount: 7.54, sst: 1.13, levies: 0.45 },
    { shares: 10, rate: 377.7, brokAmount: 7.55, sst: 1.13, levies: 0.45 },
    { shares: 10, rate: 378.03, brokAmount: 7.56, sst: 1.13, levies: 0.45 },
    { shares: 10, rate: 378.2, brokAmount: 7.56, sst: 1.13, levies: 0.45 },
    { shares: 2, rate: 378.8, brokAmount: 1.52, sst: 0.23, levies: 0.09 },
    { shares: 1, rate: 102.61, brokAmount: 0.21, sst: 0.03, levies: 0.01 },
  ];

  it('matches commission, SST, and levies for every real purchase leg in the statement', () => {
    realRows.forEach((r) => {
      const amount = r.shares * r.rate;
      const fb = calcFeeBreakdown(amount, true, r.shares, DEFAULT_PSX_SETTINGS);
      expect(fb.commission).toBeCloseTo(r.brokAmount, 2);
      expect(fb.taxOnCommission).toBeCloseTo(r.sst, 2);
      expect(fb.nccplFee).toBeCloseTo(r.levies, 2);
    });
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
