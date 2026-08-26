import { describe, expect, it } from 'vitest';
import { isValidIbanFormat, lookupIban } from '../ibanLookup';

describe('isValidIbanFormat', () => {
  it('accepts well-known valid example IBANs (real mod-97 checksums)', () => {
    expect(isValidIbanFormat('GB29 NWBK 6016 1331 9268 19')).toBe(true);
    expect(isValidIbanFormat('DE89370400440532013000')).toBe(true);
    expect(isValidIbanFormat('FR1420041010050500013M02606')).toBe(true);
  });

  it('rejects a bad checksum (one digit changed from a valid example)', () => {
    expect(isValidIbanFormat('DE89370400440532013001')).toBe(false);
  });

  it('rejects obviously malformed input', () => {
    expect(isValidIbanFormat('')).toBe(false);
    expect(isValidIbanFormat('not an iban')).toBe(false);
    expect(isValidIbanFormat('12DE370400440532013000')).toBe(false);
  });
});

describe('lookupIban', () => {
  it('returns null for a locally-invalid IBAN without attempting a network call', async () => {
    expect(await lookupIban('INVALID')).toBeNull();
  });
});
