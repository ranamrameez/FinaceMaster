import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signInWithPopup,
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

export async function signInWithGoogle() {
  await signInWithPopup(requireAuth(), new GoogleAuthProvider());
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
