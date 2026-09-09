/** A small chip-style toggle for a record's `isPending` flag ("placed but
 * not yet cleared/filled"). User-reported (2026-09-09): "the Pending
 * checkbox's clickable area is too big. i clicked on white space at my
 * mouse position by mistake, causing a pending trade... we may use
 * toggle/chip for better UX."
 *
 * Root cause was structural, not cosmetic: every call site wrapped a bare
 * `<input type="checkbox">` in a `<label style={{display:'flex', ...}}>`
 * with no width constraint — a block-level flex `<label>` stretches to
 * fill its container (a `Field`'s full column width inside a popup, or
 * the whole form's width when placed directly in a block layout), so the
 * ENTIRE stretched box became clickable, not just the checkbox+text. This
 * one shared control (a `.chip`/`.chip.active` button — the same
 * shrink-to-fit toggle pattern `ChartFilterBar` already uses, so it can
 * never grow past its own text) fixes the click-area bug and gives every
 * `isPending` control across the app the same look, in one place. */
export function PendingToggle({
  checked,
  onChange,
  label = 'Pending',
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`chip${checked ? ' active' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      title={title}
      style={{ alignSelf: 'flex-start' }}
    >
      {label}
    </button>
  );
}
