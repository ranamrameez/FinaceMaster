import { updateProfile as updateAuthProfile, type User } from 'firebase/auth';
import { get, onValue, ref, set } from 'firebase/database';
import { db } from './client';

export interface UserProfile {
  displayName: string;
  avatarEmoji: string;
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
 * anywhere else that reads auth profile info. */
export async function saveProfile(user: User, profile: UserProfile): Promise<void> {
  if (!db) throw new Error('Cloud sync is unavailable — Firebase failed to load in this browser.');
  await set(ref(db, profilePath(user.uid)), profile);
  await updateAuthProfile(user, { displayName: profile.displayName || null });
}
