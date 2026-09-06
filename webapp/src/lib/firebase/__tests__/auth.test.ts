import { beforeEach, describe, expect, it, vi } from 'vitest';

// User-reported (2026-09): "Sign in with Google succeeds but the user
// still doesn't get logged in" — confirmed with the user the symptom is a
// SILENT failure (page reloads, still signed-out, no error either way).
// `completeGoogleSignInRedirect`'s `wasPending` flag is the fix: it tells
// apart "this page load isn't a redirect return at all" (stay silent, the
// common case) from "we WERE expecting to come back signed in but didn't"
// (a real failure worth surfacing) — see `auth.ts`'s own doc comment for
// the full reasoning. Mocks `firebase/auth`/`./client` directly since
// `signInWithGoogle`/`completeGoogleSignInRedirect` are thin wrappers
// around real Firebase SDK calls with no existing mock infrastructure in
// this test suite to build on.
const signInWithRedirect = vi.fn((..._args: unknown[]) => Promise.resolve(undefined));
let redirectResult: unknown = null;
const getRedirectResult = vi.fn((..._args: unknown[]) => Promise.resolve(redirectResult));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
  createUserWithEmailAndPassword: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  RecaptchaVerifier: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithEmailLink: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../client', () => ({ auth: {} }));

import { completeGoogleSignInRedirect, signInWithGoogle } from '../auth';

describe('Google redirect sign-in silent-failure detection', () => {
  beforeEach(() => {
    sessionStorage.clear();
    redirectResult = null;
    signInWithRedirect.mockClear();
    getRedirectResult.mockClear();
  });

  it('marks a redirect as pending before navigating away', async () => {
    await signInWithGoogle();
    expect(sessionStorage.getItem('financerecorder_google_redirect_pending')).toBe('1');
  });

  it('reports wasPending: false on an ordinary page load that never attempted a redirect', async () => {
    const { signedIn, wasPending } = await completeGoogleSignInRedirect();
    expect(signedIn).toBe(false);
    expect(wasPending).toBe(false);
  });

  it('reports wasPending: true + signedIn: false when a redirect was attempted but silently failed', async () => {
    await signInWithGoogle();
    redirectResult = null; // getRedirectResult() resolves with no error, but no user either
    const { signedIn, wasPending } = await completeGoogleSignInRedirect();
    expect(signedIn).toBe(false);
    expect(wasPending).toBe(true);
  });

  it('reports signedIn: true and clears the pending flag on a real successful return', async () => {
    await signInWithGoogle();
    redirectResult = { user: { uid: 'abc' } };
    const { signedIn, wasPending } = await completeGoogleSignInRedirect();
    expect(signedIn).toBe(true);
    expect(wasPending).toBe(true);
    expect(sessionStorage.getItem('financerecorder_google_redirect_pending')).toBeNull();
  });

  it('clears the pending flag after reading it, so a second page load in the same tab is not mistaken for another pending redirect', async () => {
    await signInWithGoogle();
    await completeGoogleSignInRedirect();
    const second = await completeGoogleSignInRedirect();
    expect(second.wasPending).toBe(false);
  });
});
