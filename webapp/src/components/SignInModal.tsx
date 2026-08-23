import { useState } from 'react';
import { create } from 'zustand';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../lib/firebase/auth';
import { firebaseReady } from '../lib/firebase/client';
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

export function SignInModalHost() {
  const { open, message, resolve } = useSignInPromptStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const close = (signedIn: boolean) => {
    resolve?.(signedIn);
    useSignInPromptStore.setState({ open: false, resolve: null });
    setEmail('');
    setPassword('');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      close(true);
      toast('Signed in.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseReady) {
    return (
      <Modal title="Sign in" onClose={() => close(false)}>
        <p className="footer-note">Cloud sign-in is unavailable — Firebase failed to load in this browser.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Sign in" onClose={() => close(false)}>
      <p>{message}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={() => run(() => signInWithEmail(email, password))}>
          <LogInIcon />Sign in
        </button>
        <button className="btn secondary" disabled={busy} onClick={() => run(() => signUpWithEmail(email, password))}>
          Sign up
        </button>
        <button className="btn secondary" disabled={busy} onClick={() => run(signInWithGoogle)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <GoogleIcon />Sign in with Google
        </button>
        <button
          className="btn ghost small"
          disabled={busy || !email}
          onClick={async () => {
            setBusy(true);
            try {
              await resetPassword(email);
              toast(`Password reset email sent to ${email}.`);
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Failed to send reset email.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Forgot password?
        </button>
      </div>
    </Modal>
  );
}
