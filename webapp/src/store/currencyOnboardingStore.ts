import { create } from 'zustand';

const STORAGE_KEY = 'financerecorder_currency_onboarding_seen_v1';

interface CurrencyOnboardingState {
  seen: boolean;
  dismiss: () => void;
}

function loadSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** User-requested (2026-09-09): "We should ask user about his currencies on
 * signup. then can still customize in settings anytime." Same "global,
 * browser-local, own localStorage key" shape as `termsStore` (not a
 * financial preference, so it doesn't sync to Firebase and isn't
 * per-account) — tracks only whether the one-time currency-picker prompt
 * has been shown, never the picked currencies themselves (that's
 * `enabledCurrenciesStore`'s own job, unchanged, still the ongoing
 * Account > Currencies customization point this prompt is a shortcut
 * into, not a replacement for). Dismissing without picking anything is
 * fine — `enabledCurrenciesStore`'s own `null` default ("not configured,
 * show all") already covers that case safely. */
export const useCurrencyOnboardingStore = create<CurrencyOnboardingState>((set) => ({
  seen: loadSeen(),
  dismiss: () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Failed to persist currency-onboarding dismissal', e);
    }
    set({ seen: true });
  },
}));
