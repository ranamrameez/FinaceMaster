import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME, defaultTimezoneForCurrency, defaultTimezoneForMarket, toInstantMs } from '../datetime';

describe('defaultTimezoneForMarket', () => {
  it('maps QSE and PSX to their own market timezone', () => {
    expect(defaultTimezoneForMarket('QSE')).toBe('Asia/Qatar');
    expect(defaultTimezoneForMarket('PSX')).toBe('Asia/Karachi');
  });
});

describe('defaultTimezoneForCurrency', () => {
  it('maps known currencies to a representative financial-center timezone', () => {
    expect(defaultTimezoneForCurrency('USD')).toBe('America/New_York');
    expect(defaultTimezoneForCurrency('PKR')).toBe('Asia/Karachi');
    expect(defaultTimezoneForCurrency('qar')).toBe('Asia/Qatar'); // case-insensitive
  });

  it('falls back to a real IANA string for an unknown currency, never throwing', () => {
    expect(() => defaultTimezoneForCurrency('XYZ')).not.toThrow();
    expect(typeof defaultTimezoneForCurrency('XYZ')).toBe('string');
    expect(defaultTimezoneForCurrency('XYZ').length).toBeGreaterThan(0);
  });

  it('falls back the same way when currency is undefined', () => {
    expect(typeof defaultTimezoneForCurrency(undefined)).toBe('string');
  });
});

describe('toInstantMs', () => {
  it('treats a bare date with no time/timezone as noon UTC (the documented default)', () => {
    const instant = toInstantMs('2026-08-24');
    const [hh, mm] = DEFAULT_TIME.split(':').map(Number);
    expect(instant).toBe(Date.UTC(2026, 7, 24, hh, mm));
  });

  it('a later time on the same date in the same timezone produces a later instant', () => {
    const morning = toInstantMs('2026-08-24', '09:00', 'Asia/Karachi');
    const evening = toInstantMs('2026-08-24', '18:00', 'Asia/Karachi');
    expect(evening).toBeGreaterThan(morning);
  });

  it('correctly accounts for timezone offset (same wall-clock time, different zones -> different instants)', () => {
    const karachi = toInstantMs('2026-08-24', '12:00', 'Asia/Karachi'); // UTC+5
    const utc = toInstantMs('2026-08-24', '12:00', 'UTC');
    // Karachi noon happens 5 hours before UTC noon on the same clock face.
    expect(karachi).toBeLessThan(utc);
    expect((utc - karachi) / (60 * 60 * 1000)).toBeCloseTo(5, 1);
  });

  it('two records missing time/timezone on the same date produce identical instants (safe tie for the sort fallback)', () => {
    const a = toInstantMs('2026-08-24');
    const b = toInstantMs('2026-08-24', undefined, undefined);
    expect(a).toBe(b);
  });

  it('round-trips a known real-world offset (Qatar, UTC+3, no DST)', () => {
    const doha = toInstantMs('2026-01-15', '00:00', 'Asia/Qatar');
    const utc = toInstantMs('2026-01-15', '00:00', 'UTC');
    expect((utc - doha) / (60 * 60 * 1000)).toBeCloseTo(3, 1);
  });
});
