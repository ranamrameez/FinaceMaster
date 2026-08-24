import { describe, expect, it } from 'vitest';
import { convertAmount, isFxStale, setManualRate, type FxRates } from '../fx';

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
