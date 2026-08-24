import { describe, expect, it } from 'vitest';
import { fmtCompact, fmtMoneyCompact } from '../format';

describe('fmtCompact', () => {
  it('leaves numbers under 1000 unabbreviated', () => {
    expect(fmtCompact(842)).toBe('842');
    expect(fmtCompact(0)).toBe('0');
    expect(fmtCompact(-500)).toBe('-500');
  });

  it('abbreviates thousands', () => {
    expect(fmtCompact(10000)).toBe('10k');
    expect(fmtCompact(1500)).toBe('1.5k');
  });

  it('abbreviates millions and billions', () => {
    expect(fmtCompact(1234567)).toBe('1.23M');
    expect(fmtCompact(2_500_000_000)).toBe('2.5B');
  });

  it('preserves sign on negative large numbers', () => {
    expect(fmtCompact(-12345)).toBe('-12.35k');
  });

  it('returns em-dash for null/undefined/NaN', () => {
    expect(fmtCompact(null)).toBe('—');
    expect(fmtCompact(undefined)).toBe('—');
    expect(fmtCompact(NaN)).toBe('—');
  });
});

describe('fmtMoneyCompact', () => {
  it('appends the currency code', () => {
    expect(fmtMoneyCompact(12345678.9, 'PKR')).toBe('12.35M PKR');
    expect(fmtMoneyCompact(500, 'USD')).toBe('500 USD');
  });
});
