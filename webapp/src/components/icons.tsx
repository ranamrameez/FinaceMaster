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

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} {...base} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
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
