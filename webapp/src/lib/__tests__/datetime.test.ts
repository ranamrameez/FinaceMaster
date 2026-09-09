import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TIME, defaultTimeForDate, defaultTimezoneForCurrency, defaultTimezoneForMarket, isToday, nowTime, toInstantMs } from '../datetime';

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

describe('isToday / defaultTimeForDate', () => {
  const today = () => new Date().toISOString().slice(0, 10);
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  it('isToday is true for the real current date and false for any other date', () => {
    expect(isToday(today())).toBe(true);
    expect(isToday(yesterday())).toBe(false);
    expect(isToday('2020-01-01')).toBe(false);
  });

  it('defaultTimeForDate returns a real current time for today (matches nowTime)', () => {
    expect(defaultTimeForDate(today())).toBe(nowTime());
  });

  it('defaultTimeForDate returns undefined for a backdated date, so it falls back to noon (restores same-day tie eligibility)', () => {
    expect(defaultTimeForDate(yesterday())).toBeUndefined();
    expect(defaultTimeForDate('2020-01-01')).toBeUndefined();
  });
});

describe('nowTime(timezone) — user-reported: "Timezone is chosen by currency, but time is according to the user\'s machine"', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A fixed real instant: 2026-01-15T10:00:00Z.
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the correct wall-clock time for the TARGET timezone, not the machine\'s own', () => {
    // Karachi is UTC+5 -> 15:00; Qatar is UTC+3 -> 13:00 — a real 2-hour
    // gap, matching the user's own reported scenario (a PKR entry logged
    // while physically in Qatar) exactly.
    expect(nowTime('Asia/Karachi')).toBe('15:00');
    expect(nowTime('Asia/Qatar')).toBe('13:00');
  });

  it('defaultTimeForDate passes the timezone through, so a today-dated row gets the right clock reading', () => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    expect(defaultTimeForDate(todayUtc, 'Asia/Karachi')).toBe('15:00');
    expect(defaultTimeForDate(todayUtc, 'Asia/Qatar')).toBe('13:00');
  });

  it('falls back to the browser-local reading when no timezone is given, unchanged from before', () => {
    expect(nowTime()).toBe(new Date().toTimeString().slice(0, 5));
  });
});
