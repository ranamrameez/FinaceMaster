import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectPrimaryCurrency } from '../currencies';

function mockTimezone(tz: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone: tz }) }) as unknown as Intl.DateTimeFormat,
  );
}

describe('detectPrimaryCurrency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a known market timezone to its currency', () => {
    mockTimezone('Asia/Karachi');
    expect(detectPrimaryCurrency()).toBe('PKR');
    mockTimezone('Asia/Qatar');
    expect(detectPrimaryCurrency()).toBe('QAR');
  });

  it('falls back to USD for an unlisted timezone', () => {
    mockTimezone('Pacific/Auckland');
    expect(detectPrimaryCurrency()).toBe('USD');
  });

  it('falls back to USD if Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(detectPrimaryCurrency()).toBe('USD');
  });
});
