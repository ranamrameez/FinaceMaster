import { onAuthStateChanged, type User } from 'firebase/auth';
import { create } from 'zustand';
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

/** A single, app-wide Firebase auth listener — both QSE and PSX workbook
 * sync read from this instead of each running their own
 * onAuthStateChanged subscription. */
export function useAuthState(): AuthState {
  if (!started && firebaseReady && auth) {
    started = true;
    completeEmailLinkSignInIfPresent().catch((e) => console.warn('Email-link sign-in failed', e));
    onAuthStateChanged(auth, (user) => {
      useAuthStore.setState({ user, authResolved: true });
    });
  }
  return useAuthStore();
}
