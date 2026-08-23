import { onAuthStateChanged, type User } from 'firebase/auth';
import { create } from 'zustand';
import { resetAllLocalWorkbooks } from '../resetLocalData';
import { auth, firebaseReady } from './client';
import { completeEmailLinkSignInIfPresent } from './auth';

interface AuthState {
  user: User | null;
  /** False until the first onAuthStateChanged callback fires — lets callers
   * distinguish "we don't know yet" (returning user, session still
   * resolving) from "confirmed signed out", so a sign-in gate doesn't flash
   * for someone who's actually already signed in. */
  authResolved: boolean;
}

const useAuthStore = create<AuthState>(() => ({ user: null, authResolved: !firebaseReady }));

let started = false;
/** Tracks the previously-seen uid so a sign-out (or switching to a
 * different account) can be told apart from a page-load resume of an
 * already-signed-in session. `undefined` means "no callback has fired
 * yet in this page load" — deliberately distinct from `null` (signed
 * out), so the very first callback never triggers a reset even when it
 * reports a signed-out state (there's nothing to reset yet, and a
 * returning signed-in user's local data must not be wiped just because
 * this is the first callback). */
let lastUid: string | null | undefined;

/** A single, app-wide Firebase auth listener — both QSE and PSX workbook
 * sync read from this instead of each running their own
 * onAuthStateChanged subscription. */
export function useAuthState(): AuthState {
  if (!started && firebaseReady && auth) {
    started = true;
    completeEmailLinkSignInIfPresent().catch((e) => console.warn('Email-link sign-in failed', e));
    onAuthStateChanged(auth, (user) => {
      const uid = user?.uid ?? null;
      // Critical fix: a sign-out (or switching to a different account)
      // used to leave every module's local data sitting in memory and in
      // localStorage — see resetAllLocalWorkbooks()'s own doc comment.
      // Only reset on an actual uid change away from a *known* previous
      // uid, never on the first callback of a page load (that's just this
      // session finding out what the already-resumed auth state is, not a
      // transition away from one).
      if (lastUid !== undefined && lastUid !== null && uid !== lastUid) {
        resetAllLocalWorkbooks();
      }
      lastUid = uid;
      useAuthStore.setState({ user, authResolved: true });
    });
  }
  return useAuthStore();
}
