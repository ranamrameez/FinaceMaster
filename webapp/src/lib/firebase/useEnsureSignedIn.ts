import { requireSignIn } from '../../components/SignInModal';
import { useAuthState } from './useAuthState';

/** Returns a function to call right before any data-saving action.
 * Already signed in → resolves true immediately. Not signed in → opens the
 * sign-in popup and resolves true only if the user completes it, false if
 * they close it without signing in (caller should bail out on false). */
export function useEnsureSignedIn() {
  const { user } = useAuthState();
  return async (message?: string): Promise<boolean> => {
    if (user) return true;
    return requireSignIn(message);
  };
}
