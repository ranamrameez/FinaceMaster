/** Small inline-SVG icon set for buttons — no icon library dependency,
 * matches this project's existing convention of hand-rolled visuals over
 * new packages. 14px, stroke=currentColor so they inherit button text color. */
type IconProps = { size?: number };

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** A small "more info" trigger — pairs with `Tooltip` to move a long
 * explanation out of permanent on-page text (a real user-reported clutter
 * complaint, comparing this app's forms unfavorably to a competitor's
 * clean-looking screen) into something shown only on demand. */
export function InfoIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function SaveIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}

export function TrashIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

/** User-reported: generic, repeated table-row actions (Edit/Delete/Save/
 * Cancel) and toolbar utilities (Export/Clear) should be icon-only with
 * their label moved into a tooltip, not a permanent text button — this is
 * the pencil half of that; `TrashIcon`/`SaveIcon`/`CheckIcon` already
 * cover Delete/Save/Cancel. */
export function EditIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export function ExportIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function XIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function LogInIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

/** The FinanceRecorder app logo mark (README Pending item 87) — until now
 * the sidebar/browser tab only ever had the "FinanceRecorder" text
 * wordmark (Done item 32) plus `public/favicon.svg`'s leftover generic
 * Vite scaffold art, never a real designed asset. Fixed brand colors (not
 * currentColor, same deliberate exception as `GoogleIcon` below) — a
 * logo mark is meant to read as a stable, recognizable brand identity
 * independent of whichever of the app's 12 in-app color themes the
 * viewer happens to have picked, the same way a real app's logo doesn't
 * reskin with the user's own UI theme. Three ascending bars evoke a
 * growth/portfolio chart, on a deep navy badge chosen to read clearly on
 * both the light and dark sidebar background. `public/favicon.svg` is the
 * same mark as a static file, for the browser tab. */
export function LogoMark({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1f3a5f" />
      <rect x="7" y="18" width="4.5" height="8" rx="1.5" fill="#ffffff" />
      <rect x="13.75" y="13" width="4.5" height="13" rx="1.5" fill="#ffffff" />
      <rect x="20.5" y="7" width="4.5" height="19" rx="1.5" fill="#ffffff" />
    </svg>
  );
}

/** A short ledger/list glyph — used for "view this entity's transactions"
 * quick-links (e.g. the Banking homepage's per-account card action). */
export function ListIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function SettingsIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

/** Google's official "G" mark — fixed brand colors (not currentColor, since
 * this one is genuinely 4-color), used only on the "Sign in with Google"
 * button. Everything else in this file is a stroke icon that inherits the
 * button's text color; this is the one deliberate exception. */
export function GoogleIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
