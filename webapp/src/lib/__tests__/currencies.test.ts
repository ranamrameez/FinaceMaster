import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURRENCIES, currencySymbol, detectPrimaryCurrency } from '../currencies';

function mockTimezone(tz: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone: tz }) }) as unknown as Intl.DateTimeFormat,
  );
}

// User-reported (2026-09-16): "no one is going to work only these
// currencies... save a list of all currencies." Regression guard against
// the list ever silently shrinking back down — a real, broad reference set,
// not the original narrow US/EU/GCC/Pakistan/India-only 11.
describe('CURRENCIES', () => {
  it('covers a broad real-world set, not just the original 11', () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(40);
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length); // no duplicate codes
    ['USD', 'PKR', 'QAR', 'JPY', 'AUD', 'ZAR', 'BRL'].forEach((code) => expect(codes).toContain(code));
  });

  it('falls back to a plain "CODE " symbol for a currency outside the list', () => {
    expect(currencySymbol('XYZ')).toBe('XYZ ');
  });
});

describe('detectPrimaryCurrency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a known market timezone to its currency', () => {
    mockTimezone('Asia/Karachi');
    expect(detectPrimaryCurrency()).toBe('PKR');
    mockTimezone('Asia/Qatar');
    expect(detectPrimaryCurrency()).toBe('QAR');
    // 2026-09-16: CURRENCIES grew from 11 to ~50 real world currencies, with
    // a matching expansion of TIMEZONE_TO_CURRENCY — Auckland is now a real,
    // intentional mapping, not an "unlisted" stand-in any more (see below).
    mockTimezone('Pacific/Auckland');
    expect(detectPrimaryCurrency()).toBe('NZD');
  });

  it('falls back to USD for a genuinely unlisted timezone', () => {
    mockTimezone('America/Bogota');
    expect(detectPrimaryCurrency()).toBe('USD');
  });

  it('falls back to USD if Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(detectPrimaryCurrency()).toBe('USD');
  });
});
