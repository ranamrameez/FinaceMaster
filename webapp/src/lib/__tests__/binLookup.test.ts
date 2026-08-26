import { describe, expect, it } from 'vitest';
import { isValidBin, lookupBin } from '../binLookup';

describe('isValidBin', () => {
  it('accepts a 6-8 digit BIN', () => {
    expect(isValidBin('411111')).toBe(true);
    expect(isValidBin('41111111')).toBe(true);
  });

  it('rejects anything that is not 6-8 plain digits', () => {
    expect(isValidBin('')).toBe(false);
    expect(isValidBin('12345')).toBe(false); // too short
    expect(isValidBin('123456789')).toBe(false); // too long
    expect(isValidBin('41111a')).toBe(false);
    expect(isValidBin('4111 111')).toBe(false); // stripped by caller, not this function
  });
});

describe('lookupBin', () => {
  it('returns null for a locally-invalid BIN without attempting a network call', async () => {
    expect(await lookupBin('not-a-bin')).toBeNull();
  });
});
