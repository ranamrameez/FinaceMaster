import { updateProfile as updateAuthProfile, type User } from 'firebase/auth';
import { get, onValue, ref, update } from 'firebase/database';
import { db } from './client';

export interface UserProfile {
  displayName: string;
  avatarEmoji: string;
  /** User-requested (2026-09-14): "the app asks the user on every new
   * device, which is wrong" — `enabledCurrenciesStore`/
   * `currencyOnboardingStore` used to be localStorage-only (a per-BROWSER
   * preference, not per-ACCOUNT), so a returning user on a new device saw
   * the onboarding prompt again with nothing configured. These two fields
   * mirror those stores' own shape into the account's real cloud profile —
   * see `useSyncCurrencyPreference.ts` for the actual sync logic.
   * `undefined`/`null` means "not set in the cloud yet" for either field,
   * same "null = not configured" convention `enabledCurrenciesStore`
   * already uses locally. */
  enabledCurrencies?: string[] | null;
  currencyOnboardingSeen?: boolean;
}

const DEFAULT_PROFILE: UserProfile = { displayName: '', avatarEmoji: '' };

function profilePath(uid: string) {
  return `users/${uid}/profile`;
}

export async function fetchProfile(uid: string): Promise<UserProfile> {
  if (!db) return DEFAULT_PROFILE;
  try {
    const snap = await get(ref(db, profilePath(uid)));
    return { ...DEFAULT_PROFILE, ...(snap.val() || {}) };
  } catch (e) {
    console.warn('Failed to read profile', e);
    return DEFAULT_PROFILE;
  }
}

export function watchProfile(uid: string, cb: (p: UserProfile) => void) {
  if (!db) return () => {};
  return onValue(ref(db, profilePath(uid)), (snap) => {
    cb({ ...DEFAULT_PROFILE, ...(snap.val() || {}) });
  });
}

/** Saves the profile to RTDB (per-account, not financial data — safe to
 * write directly on explicit user save, unlike the workbook sync). Also
 * mirrors displayName onto the Firebase Auth user record so it shows up
 * anywhere else that reads auth profile info.
 *
 * Uses `update()`, not `set()` — a plain `set()` at this path would
 * REPLACE the whole profile object, silently dropping `enabledCurrencies`/
 * `currencyOnboardingSeen` any time `ProfileEditor` saves just a display
 * name/avatar (it only ever passes those two fields). `update()` merges
 * into the existing children instead, so the two concerns (name/avatar vs.
 * currency preference, see `saveCurrencyPreference` below) can each be
 * saved independently without clobbering the other. */
export async function saveProfile(user: User, profile: Pick<UserProfile, 'displayName' | 'avatarEmoji'>): Promise<void> {
  if (!db) throw new Error('Cloud sync is unavailable — Firebase failed to load in this browser.');
  await update(ref(db, profilePath(user.uid)), profile);
  await updateAuthProfile(user, { displayName: profile.displayName || null });
}

/** Mirrors `enabledCurrenciesStore`/`currencyOnboardingStore`'s local
 * preference into the account's real cloud profile — see `UserProfile`'s
 * own doc comment for why. `enabledCurrencies: null` is written as `null`
 * deliberately (RTDB's `update()` deletes a key written as `null`,
 * matching "not configured" — an absent key and an explicit null mean the
 * same thing here, same convention the local store already uses). */
export async function saveCurrencyPreference(uid: string, patch: { enabledCurrencies?: string[] | null; currencyOnboardingSeen?: boolean }): Promise<void> {
  if (!db) throw new Error('Cloud sync is unavailable — Firebase failed to load in this browser.');
  await update(ref(db, profilePath(uid)), patch);
}
