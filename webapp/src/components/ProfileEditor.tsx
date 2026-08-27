import type { User } from 'firebase/auth';
import { useState } from 'react';
import { toast } from './Toast';
import { SaveIcon } from './icons';
import { saveProfile } from '../lib/firebase/profile';
import { useProfile } from '../lib/firebase/useProfile';

/** Avatar-emoji + display-name editor — shared by every place that shows
 * "who's signed in" (the global Account hub, and each module's own
 * per-exchange Settings page which still links to that hub for the rest
 * of Account/Security but keeps its own Profile row for now). Moved out
 * of QSE's SettingsPage.tsx (2026-08-27 redesign) so both places use one
 * implementation instead of two copies drifting apart. */
export function ProfileEditor({ user }: { user: User }) {
  const profile = useProfile(user);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarEmoji, setAvatarEmoji] = useState(profile.avatarEmoji);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Keep local edit state in sync with the live profile until the user
  // starts typing (avoids clobbering an in-progress edit if the profile
  // listener fires again).
  if (!dirty && (displayName !== profile.displayName || avatarEmoji !== profile.avatarEmoji)) {
    setDisplayName(profile.displayName);
    setAvatarEmoji(profile.avatarEmoji);
  }

  const initial = (displayName || user.email || user.phoneNumber || '?').charAt(0).toUpperCase();

  const save = async () => {
    setBusy(true);
    try {
      await saveProfile(user, { displayName: displayName.trim(), avatarEmoji: avatarEmoji.trim() });
      toast('Profile saved.');
      setDirty(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div
        style={{
          width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--on-accent-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 40px', fontSize: 18,
        }}
      >
        {avatarEmoji || initial}
      </div>
      <input
        placeholder="Display name"
        value={displayName}
        onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
        style={{ width: 160 }}
      />
      <input
        placeholder="Avatar emoji"
        value={avatarEmoji}
        maxLength={4}
        onChange={(e) => { setAvatarEmoji(e.target.value); setDirty(true); }}
        style={{ width: 90 }}
        title="Pick one or two emoji as your avatar"
      />
      <button className="btn secondary small" disabled={busy || !dirty} onClick={save}>
        <SaveIcon size={12} />Save profile
      </button>
      <span className="footer-note">{user.email || user.phoneNumber || user.uid}</span>
    </div>
  );
}
