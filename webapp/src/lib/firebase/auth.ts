import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signInWithRedirect,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from './client';

function requireAuth() {
  if (!auth) throw new Error('Cloud sync is unavailable — Firebase failed to load in this browser.');
  return auth;
}

export async function signUpWithEmail(email: string, password: string) {
  await createUserWithEmailAndPassword(requireAuth(), email, password);
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function signOutUser() {
  await signOut(requireAuth());
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(requireAuth(), email);
}

/** User-reported critical bug (2026-08-27): `signInWithPopup` opened the
 * Google popup, sometimes even showed the user's own email in it, then
 * hung indefinitely — neither window closed on its own, no status update
 * either way, and manually dismissing both left the app reporting "not
 * logged in." Root cause: `signInWithPopup` depends on a `postMessage`
 * bridge (plus polling `popup.closed`) between the popup and the opener
 * window, on a DIFFERENT origin (`authDomain`, `qse-app.firebaseapp.com`)
 * than the app itself (`ranamrameez.github.io`) — exactly the cross-origin
 * popup case modern Chrome's Cross-Origin-Opener-Policy defaults and
 * third-party storage partitioning are known to silently break. Firebase's
 * own documented mitigation is setting a `Cross-Origin-Opener-Policy:
 * same-origin-allow-popups` response header on the app's OWN origin —
 * not possible here since this app is static-hosted on GitHub Pages,
 * which doesn't expose custom response headers. `signInWithRedirect` sidesteps
 * the whole popup/postMessage mechanism (a full-page navigation to Google
 * and back, using the same storage/cookie context the whole time), which
 * is why it's the standard fallback for this exact failure mode.
 *
 * **Real, accepted tradeoff**: unlike the popup flow, this one tears down
 * the current page (and with it, whatever in-memory JS was mid-flight —
 * the `requireSignIn()` promise a gated write was waiting on cannot
 * resolve in this page load). The user returns already signed in and
 * needs to retry whatever write they were doing, which now succeeds
 * immediately without prompting again — a real UX cost, but a strictly
 * better outcome than the popup hanging forever with no way to complete
 * at all. `completeGoogleSignInRedirect()` (called once on app load,
 * `useAuthState.ts`) picks up the result when the user lands back. */
export async function signInWithGoogle() {
  await signInWithRedirect(requireAuth(), new GoogleAuthProvider());
}

/** Call once on app load (see `signInWithGoogle`'s own doc comment for
 * why this exists) — resolves the pending Google redirect sign-in, if
 * the current page load is a return from one. `onAuthStateChanged`
 * (the app's single global auth listener, `useAuthState.ts`) fires
 * independently once the SDK processes this, so this function's own
 * job is just: surface a clear error if the redirect itself failed
 * (an empty/undefined result with no thrown error means "this page
 * load wasn't a redirect return at all," not a failure — don't treat
 * that as an error). */
export async function completeGoogleSignInRedirect(): Promise<{ signedIn: boolean }> {
  const result = await getRedirectResult(requireAuth());
  return { signedIn: result !== null };
}

const EMAIL_LINK_STORAGE_KEY = 'financerecorder_email_for_link';

export async function sendEmailLink(email: string) {
  const a = requireAuth();
  const actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
  await sendSignInLinkToEmail(a, email, actionCodeSettings);
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
}

/** Call once on app load — completes a passwordless email-link sign-in if
 * the current URL is one of those links. */
export async function completeEmailLinkSignInIfPresent() {
  const a = requireAuth();
  if (!isSignInWithEmailLink(a, window.location.href)) return;
  let email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  if (!email) {
    email = window.prompt('Confirm your email to complete sign-in') || '';
  }
  if (!email) return;
  await signInWithEmailLink(a, email, window.location.href);
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
}

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function ensureRecaptcha(containerId: string) {
  const a = requireAuth();
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(a, containerId, { size: 'invisible' });
  }
  return recaptchaVerifier;
}

export async function sendPhoneCode(phoneNumber: string, containerId: string): Promise<ConfirmationResult> {
  const a = requireAuth();
  const verifier = ensureRecaptcha(containerId);
  return signInWithPhoneNumber(a, phoneNumber, verifier);
}

export async function verifyPhoneCode(confirmation: ConfirmationResult, code: string) {
  await confirmation.confirm(code);
}
