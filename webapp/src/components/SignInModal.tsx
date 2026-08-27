import { useState } from 'react';
import { create } from 'zustand';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/firebase/auth';
import { firebaseReady } from '../lib/firebase/client';
import { Field, TextInput } from './ui/Field';
import { GoogleIcon, LogInIcon } from './icons';
import { Modal } from './Modal';
import { toast } from './Toast';

interface SignInPromptState {
  open: boolean;
  message: string;
  resolve: ((signedIn: boolean) => void) | null;
}

const useSignInPromptStore = create<SignInPromptState>(() => ({ open: false, message: '', resolve: null }));

/** Opens the sign-in popup and resolves once the user either signs in
 * successfully (true) or closes the popup without doing so (false).
 * Call this at the point of a write action (add transaction, add transfer,
 * update a price, ...) instead of gating the whole app behind a full-page
 * wall — browsing/calculators/future read-only features (news, analysis)
 * don't need an account; saving anything does. */
export function requireSignIn(message = 'Sign in to save your changes.'): Promise<boolean> {
  return new Promise((resolve) => {
    useSignInPromptStore.setState({ open: true, message, resolve });
  });
}

/** Firebase's own error messages (e.g. "Firebase: Error (auth/wrong-password).")
 * are technically informative but read as a raw SDK internal, not
 * something a non-technical user would recognize as an answer — user-
 * reported ("UI not consistent... designed by a junior student") alongside
 * the sign-in flow's other issues. Maps the handful of codes a real user
 * actually hits to plain language; anything unmapped falls back to
 * Firebase's own message rather than hiding real information. */
export function friendlyAuthError(e: unknown): string {
  const code = e instanceof Error && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-email': return 'That doesn\'t look like a valid email address.';
    case 'auth/user-not-found': return 'No account found for that email — use "Sign up" if you\'re new.';
    case 'auth/wrong-password': case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account already exists for that email — try "Sign in" instead.';
    case 'auth/weak-password': return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts — wait a bit and try again.';
    case 'auth/network-request-failed': return 'Network error — check your connection and try again.';
    default: return e instanceof Error ? e.message : 'Something went wrong.';
  }
}

export function SignInModalHost() {
  const { open, message, resolve } = useSignInPromptStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'signin' | 'signup' | 'google' | 'reset' | null>(null);

  if (!open) return null;

  const close = (signedIn: boolean) => {
    resolve?.(signedIn);
    useSignInPromptStore.setState({ open: false, resolve: null });
    setEmail('');
    setPassword('');
  };

  // Every Firebase auth call below is a real network request — user-
  // reported: on a slow/blocked connection these can hang indefinitely
  // rather than fail fast, leaving a button stuck on its busy label
  // forever with no way to know anything's wrong. Race every one of them
  // against this so the WORST case is always "a clear error after 12s and
  // a clickable button again," never silence.
  const withTimeout = <T,>(p: Promise<T>): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('This is taking too long — check your connection and try again.')), 12000),
    );
    return Promise.race([p, timeout]);
  };

  const run = async (which: Exclude<typeof busy, null>, fn: () => Promise<void>) => {
    setBusy(which);
    try {
      await withTimeout(fn());
      close(true);
      toast('Signed in.');
    } catch (e) {
      toast(friendlyAuthError(e));
    } finally {
      setBusy(null);
    }
  };

  const runGoogle = async () => {
    setBusy('google');
    try {
      // Navigates away from the page — see signInWithGoogle's own doc
      // comment for why this is a redirect, not a popup. Nothing after
      // this line runs in this page load on the success path — the page
      // is gone. `withTimeout` covers the failure path: `signInWithRedirect`
      // makes a network call to resolve the project's auth config BEFORE
      // actually navigating, and that call can hang rather than fail fast —
      // the exact "no status update, stuck forever" symptom this whole fix
      // responds to.
      await withTimeout(signInWithGoogle());
    } catch (e) {
      toast(friendlyAuthError(e));
      setBusy(null);
    }
  };

  if (!firebaseReady) {
    return (
      <Modal title="Sign in" onClose={() => close(false)} zIndex={300}>
        <p className="footer-note">Cloud sign-in is unavailable — Firebase failed to load in this browser.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Sign in" onClose={() => close(false)} zIndex={300}>
      <p>{message}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'flex-end' }}>
        <Field label="Email">
          <TextInput type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <TextInput type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" disabled={busy !== null} onClick={() => run('signin', () => signInWithEmail(email, password))}>
          <LogInIcon />{busy === 'signin' ? 'Signing in…' : 'Sign in'}
        </button>
        <button className="btn secondary" disabled={busy !== null} onClick={() => run('signup', () => signUpWithEmail(email, password))}>
          {busy === 'signup' ? 'Creating account…' : 'Sign up'}
        </button>
        <button className="btn secondary" disabled={busy !== null} onClick={runGoogle} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <GoogleIcon />{busy === 'google' ? 'Opening Google…' : 'Sign in with Google'}
        </button>
      </div>
      <button
        className="btn ghost small"
        disabled={busy !== null}
        style={{ marginTop: 8 }}
        onClick={async () => {
          if (!email.trim()) return toast('Enter your email above first.');
          setBusy('reset');
          try {
            await withTimeout(resetPassword(email));
            toast(`Password reset email sent to ${email}.`);
          } catch (e) {
            toast(friendlyAuthError(e));
          } finally {
            setBusy(null);
          }
        }}
      >
        {busy === 'reset' ? 'Sending…' : 'Forgot password?'}
      </button>
    </Modal>
  );
}
