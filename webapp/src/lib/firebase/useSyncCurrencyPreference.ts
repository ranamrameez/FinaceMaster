import type { User } from 'firebase/auth';
import { useEffect, useRef } from 'react';
import { fetchProfile, saveCurrencyPreference } from './profile';
import { useCurrencyOnboardingStore } from '../../store/currencyOnboardingStore';
import { useEnabledCurrenciesStore } from '../../store/enabledCurrenciesStore';

/** User-reported (2026-09-14): "I ASKED TO LET THE USER CHOOSE HIS
 * CURRENCIES ON SIGNUP: the app asks the user on every new device, which
 * is wrong." Both `enabledCurrenciesStore` and `currencyOnboardingStore`
 * were deliberately built as localStorage-only, per-BROWSER preferences
 * (their own doc comments called this out explicitly) — which is exactly
 * the bug: a returning user on a new device has no local value at all, so
 * the onboarding prompt fires again with nothing configured. This hook
 * mirrors both stores into the account's real cloud profile
 * (`UserProfile.enabledCurrencies`/`currencyOnboardingSeen`, via
 * `profile.ts`'s `update()`-based, non-clobbering write) so the
 * preference genuinely follows the ACCOUNT, not the browser.
 *
 * Mounted once, globally, in `App.tsx` — same pattern as every module's
 * own `use<Module>FirebaseSync()` hook, just for a tiny non-financial
 * preference instead of a whole workbook, so no debounce/local-storage
 * plumbing is needed here (both stores already handle their own
 * localStorage persistence; this only adds the cloud round-trip).
 *
 * On sign-in: pull the cloud's own values if it has any (the account is
 * authoritative — a genuine cross-device sync); otherwise treat this as
 * the FIRST time this account has ever synced the preference and seed the
 * cloud from whatever's already configured locally (e.g. picked while
 * briefly browsing signed out before this sign-in) — safe, since there's
 * nothing real in the cloud yet to overwrite, unlike a workbook's own
 * financial data. On any later local change while signed in, push it to
 * the cloud so the next device picks it up too. */
export function useSyncCurrencyPreference(user: User | null): void {
  // The uid the initial cloud pull has actually completed for — guards the
  // "push on change" effects below from firing on stale/pre-pull state, and
  // from re-running the pull itself if `user` merely re-renders unchanged.
  const readyForUid = useRef<string | null>(null);

  useEffect(() => {
    // Cleared SYNCHRONOUSLY, before any async work, on every `user`
    // transition (including a switch to a DIFFERENT signed-in account,
    // not just sign-out) — this is what makes the "push on change" effects
    // below safe: if `resetAllLocalWorkbooks()` (called from
    // `useAuthState.ts` on this exact same transition) resets either store
    // to a blank value in the same render, `readyForUid.current` is
    // already `null` by the time that reset's own re-render runs the push
    // effects, so the guard there (`readyForUid.current !== user.uid`)
    // correctly skips pushing the reset's blank value to whichever
    // account's cloud profile `user` still pointed at — never overwriting
    // a real, already-configured preference with "not configured" just
    // because of transition timing.
    readyForUid.current = null;
    if (!user) return;
    let cancelled = false;
    (async () => {
      const cloud = await fetchProfile(user.uid);
      if (cancelled) return;
      if (cloud.enabledCurrencies !== undefined) {
        useEnabledCurrenciesStore.getState().setEnabledCodes(cloud.enabledCurrencies);
      } else {
        const local = useEnabledCurrenciesStore.getState().enabledCodes;
        if (local !== null) saveCurrencyPreference(user.uid, { enabledCurrencies: local }).catch(() => {});
      }
      if (cloud.currencyOnboardingSeen) {
        useCurrencyOnboardingStore.getState().dismiss();
      } else if (useCurrencyOnboardingStore.getState().seen) {
        saveCurrencyPreference(user.uid, { currencyOnboardingSeen: true }).catch(() => {});
      }
      readyForUid.current = user.uid;
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  const seen = useCurrencyOnboardingStore((s) => s.seen);

  useEffect(() => {
    if (!user || readyForUid.current !== user.uid) return;
    saveCurrencyPreference(user.uid, { enabledCurrencies: enabledCodes }).catch(() => {});
  }, [user, enabledCodes]);

  useEffect(() => {
    if (!user || readyForUid.current !== user.uid || !seen) return;
    saveCurrencyPreference(user.uid, { currencyOnboardingSeen: true }).catch(() => {});
  }, [user, seen]);
}
