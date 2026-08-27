import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from '../SignInModal';

/** Firebase's own auth errors always carry a `.code` string (e.g.
 * "auth/wrong-password") alongside a raw SDK-internal `.message` — this
 * mirrors that shape rather than importing the real SDK error class. */
function fakeAuthError(code: string): Error {
  const e = new Error(`Firebase: Error (${code}).`) as Error & { code: string };
  e.code = code;
  return e;
}

describe('friendlyAuthError', () => {
  it('maps known Firebase auth error codes to plain-language messages', () => {
    expect(friendlyAuthError(fakeAuthError('auth/wrong-password'))).toBe('Incorrect email or password.');
    expect(friendlyAuthError(fakeAuthError('auth/user-not-found'))).toMatch(/no account found/i);
    expect(friendlyAuthError(fakeAuthError('auth/email-already-in-use'))).toMatch(/already exists/i);
    expect(friendlyAuthError(fakeAuthError('auth/weak-password'))).toMatch(/6 characters/);
    expect(friendlyAuthError(fakeAuthError('auth/invalid-email'))).toMatch(/valid email/i);
    expect(friendlyAuthError(fakeAuthError('auth/too-many-requests'))).toMatch(/too many attempts/i);
  });

  it('falls back to the error\'s own message for an unmapped code, not a generic string', () => {
    const e = fakeAuthError('auth/some-future-error-code');
    expect(friendlyAuthError(e)).toBe(e.message);
  });

  it('falls back to a generic message for a non-Error value', () => {
    expect(friendlyAuthError('a plain string')).toBe('Something went wrong.');
    expect(friendlyAuthError(undefined)).toBe('Something went wrong.');
  });

  it('handles a plain Error with no .code (e.g. the client-side sign-in timeout)', () => {
    const e = new Error('Google sign-in is taking too long — check your connection and try again.');
    expect(friendlyAuthError(e)).toBe(e.message);
  });
});
