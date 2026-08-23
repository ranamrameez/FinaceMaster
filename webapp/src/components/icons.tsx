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
