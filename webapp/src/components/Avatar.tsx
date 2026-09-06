import type { User } from 'firebase/auth';

/** Shared avatar renderer — user-reported (2026-09): "Profile Picture not
 * coming from google, not a rounded circle as well." Root cause: `User`
 * (Firebase Auth) already exposes a real Google profile photo via
 * `photoURL` after a Google sign-in, but nothing in the app ever read that
 * field — both places that show "who's signed in" (`Sidebar.tsx`'s account
 * row, `ProfileEditor.tsx`'s bigger avatar) only ever rendered the user's
 * own hand-picked `avatarEmoji` or a plain text initial, ignoring
 * `photoURL` entirely. Fixed once here rather than in each call site,
 * same "fix at the shared layer" pattern as `MoneyValue`/`StatCard`/
 * `Field` elsewhere in this app.
 *
 * `avatarEmoji` is a plain string, not the whole `UserProfile` object, on
 * purpose — `ProfileEditor.tsx` needs to preview its own in-progress LOCAL
 * edit (before Save), not the last-persisted value, so it passes its own
 * component state instead of `profile.avatarEmoji` directly; `Sidebar.tsx`
 * just passes the persisted value straight through.
 *
 * Priority: a custom `avatarEmoji` (an explicit personalization) wins over
 * the Google photo; the Google photo wins over a plain text initial. The
 * "not a rounded circle" half of the report is the CSS class `.avatar-
 * circle` (theme.css) applied to the `<img>` itself — `border-radius` and
 * `object-fit` both work directly on an `<img>` element (a "replaced
 * element" in CSS terms), so the photo clips to a circle regardless of
 * its own real aspect ratio, matching the emoji/initial span's existing
 * circular look exactly. `referrerPolicy="no-referrer"` is required for
 * Google's own profile-photo URLs (`lh3.googleusercontent.com`) — some
 * browsers/privacy settings block an image request that carries this
 * app's own origin as a referrer, which silently fails to load the photo
 * (falls through to the browser's broken-image icon) with no console
 * error to explain why; omitting the referrer sidesteps that. */
export function Avatar({
  user, avatarEmoji, size = 22,
}: {
  user: User | null;
  avatarEmoji?: string;
  size?: number;
}) {
  const label = user?.displayName || user?.email || user?.phoneNumber || '?';
  const style = { width: size, height: size, fontSize: Math.round(size * 0.55) };

  if (avatarEmoji) {
    return <span className="avatar-circle" style={style} aria-hidden="true">{avatarEmoji}</span>;
  }
  if (user?.photoURL) {
    return <img className="avatar-circle" style={style} src={user.photoURL} alt="" referrerPolicy="no-referrer" />;
  }
  return <span className="avatar-circle" style={style} aria-hidden="true">{label.charAt(0).toUpperCase()}</span>;
}
