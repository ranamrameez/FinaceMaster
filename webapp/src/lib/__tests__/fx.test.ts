import { describe, expect, it } from 'vitest';
import { convertAmount, effectiveRate, isFxStale, setCrossRate, setManualRate, type FxRates } from '../fx';

const rates: FxRates = {
  base: 'USD',
  rates: { USD: 1, PKR: 280, QAR: 3.64 },
  fetchedAt: new Date().toISOString(),
  source: 'api',
};

describe('convertAmount', () => {
  it('returns the same amount when currencies match, even with no rates', () => {
    expect(convertAmount(100, 'USD', 'USD', null)).toBe(100);
  });

  it('converts between two non-base currencies via the base', () => {
    // 364 QAR / 3.64 (QAR per USD) = 100 USD; 100 USD * 280 (PKR per USD) = 28000 PKR
    const result = convertAmount(364, 'QAR', 'PKR', rates);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(28000, 5);
  });

  it('converts base to a quoted currency directly', () => {
    expect(convertAmount(10, 'USD', 'PKR', rates)).toBeCloseTo(2800, 5);
  });

  it('returns null when a currency has no known rate', () => {
    expect(convertAmount(10, 'USD', 'XYZ', rates)).toBeNull();
  });

  it('returns null when no rates are loaded at all', () => {
    expect(convertAmount(10, 'USD', 'PKR', null)).toBeNull();
  });
});

describe('isFxStale', () => {
  it('is stale when there are no rates at all', () => {
    expect(isFxStale(null)).toBe(true);
  });

  it('is not stale immediately after fetching', () => {
    expect(isFxStale(rates)).toBe(false);
  });

  it('is stale once past the max age', () => {
    const old: FxRates = { ...rates, fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() };
    expect(isFxStale(old)).toBe(true);
  });
});

describe('setManualRate', () => {
  it('creates a manual-source rate table from scratch', () => {
    const result = setManualRate('PKR', 280, null);
    expect(result.source).toBe('manual');
    expect(result.rates.PKR).toBe(280);
    expect(result.rates.USD).toBe(1);
  });

  it('preserves other existing rates while overriding one', () => {
    const result = setManualRate('PKR', 285, rates);
    expect(result.rates.PKR).toBe(285);
    expect(result.rates.QAR).toBe(3.64);
  });
});

describe('effectiveRate', () => {
  it('returns 1 for the same currency, even with no rates loaded', () => {
    expect(effectiveRate('PKR', 'PKR', null)).toBe(1);
  });

  it('computes a cross-rate between two non-base currencies', () => {
    // 1 QAR = 280/3.64 PKR
    expect(effectiveRate('QAR', 'PKR', rates)).toBeCloseTo(280 / 3.64, 5);
  });

  it('returns null when either leg is unknown', () => {
    expect(effectiveRate('XYZ', 'PKR', rates)).toBeNull();
  });
});

describe('setCrossRate', () => {
  it('sets a rate directly against the base currency (equivalent to setManualRate)', () => {
    const result = setCrossRate('USD', 'PKR', 280, null)!;
    expect(result).not.toBeNull();
    expect(result.rates.PKR).toBe(280);
  });

  it('solves the target leg from an already-known non-base "from" currency', () => {
    // 1 QAR = 76.9 PKR, and 1 USD = 3.64 QAR already known, so
    // 1 USD should become 3.64 * 76.9 PKR.
    const result = setCrossRate('QAR', 'PKR', 76.9, rates)!;
    expect(result).not.toBeNull();
    expect(result.rates.PKR).toBeCloseTo(3.64 * 76.9, 5);
    // Untouched currencies survive.
    expect(result.rates.QAR).toBe(3.64);
  });

  it('returns null when the "from" currency has no known rate to anchor on', () => {
    expect(setCrossRate('XYZ', 'PKR', 5, rates)).toBeNull();
  });

  it('returns null when starting from scratch with a non-base "from" currency', () => {
    expect(setCrossRate('QAR', 'PKR', 76.9, null)).toBeNull();
  });

  it('solves the "from" leg instead of corrupting the base anchor when "to" is the base currency', () => {
    // A real bug, caught live (not by an earlier version of this test
    // suite): "1 QAR = 0.3 USD" was being written as rates.USD = 1.092,
    // corrupting the shared anchor every other currency's own rate is
    // expressed relative to. USD must always stay 1.
    const result = setCrossRate('QAR', 'USD', 0.3, rates)!;
    expect(result).not.toBeNull();
    expect(result.rates.USD).toBe(1);
    expect(result.rates.QAR).toBeCloseTo(1 / 0.3, 5);
    // Untouched currencies survive.
    expect(result.rates.PKR).toBe(280);
  });
});
