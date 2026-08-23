import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { watchProfile, type UserProfile } from './profile';

const EMPTY: UserProfile = { displayName: '', avatarEmoji: '' };

export function useProfile(user: User | null): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(EMPTY);

  useEffect(() => {
    if (!user) {
      setProfile(EMPTY);
      return;
    }
    return watchProfile(user.uid, setProfile);
  }, [user]);

  return profile;
}
