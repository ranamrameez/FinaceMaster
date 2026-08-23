import { create } from 'zustand';

const STORAGE_KEY = 'financerecorder_terms_accepted_v1';

interface TermsState {
  accepted: boolean;
  accept: () => void;
}

function loadAccepted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Global, browser-local (not per-account) record of whether this visitor
 * has accepted the Disclaimer/Terms — same "global preference, own
 * localStorage key" shape as appearanceStore, not tied to sign-in since the
 * gate applies to anyone using the app's numbers, signed in or not. Never
 * auto-accept on the user's behalf; re-prompting after a cleared browser
 * profile is fine (safe), silently skipping the prompt is not. */
export const useTermsStore = create<TermsState>((set) => ({
  accepted: loadAccepted(),
  accept: () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Failed to persist terms acceptance', e);
    }
    set({ accepted: true });
  },
}));
