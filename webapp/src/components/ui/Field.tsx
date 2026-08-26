import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Tooltip } from '../Tooltip';

/** Labeled form field wrapper — consistent label+control spacing instead of
 * ad-hoc inline styles scattered per page.
 *
 * `justifyContent: 'flex-end'` matters here: a row of Fields with
 * differently-sized labels (some wrap to 2-3 lines, some don't) gets
 * stretched to a common height by the parent `.row`'s default
 * `align-items: stretch` — without this, each Field packs its label+input
 * at the *top* of that stretched box, leaving leftover space below the
 * input, so a short-label field's input sits noticeably higher than a
 * long-label field's input in the same row (a real user-reported "inputs
 * don't line up" bug). Anchoring to the bottom instead means every input's
 * bottom edge lands on the same line regardless of how tall its own label
 * happens to be. */
/** `title` (optional, item 4: "tooltips still missing") wraps the label
 * text in the same `Tooltip` popup used everywhere else in the app —
 * a one-line addition here gives any `Field` call site a real tooltip
 * for jargon-y labels (e.g. "Break-even", "CGT") without each page having
 * to wire up its own `Tooltip` around the label by hand. */
/** `marginBottom: 0` overrides the base `label{margin-bottom:5px}` rule
 * (meant for a plain caption sitting above unrelated content below it) —
 * user-reported: a bare `<button>`/`<input>` sitting in the same
 * `align-items:flex-end` row as a `Field` sat visibly higher than the
 * Field's own input, since flexbox aligns by each item's MARGIN box, and
 * the Field's inherited 5px bottom margin (this component's outer element
 * is itself a `<label>`) pushed its whole box up from the row's true
 * bottom edge by that same 5px — a margin-less sibling had nothing to
 * offset it by and sat exactly on that edge instead. Confirmed via a real
 * Playwright measurement (a "Note" Field's wrapping label carried
 * `margin: 0px 0px 5px`, computed) before writing this fix. */
/** `required` (user-requested, 2026-08-26: "clearly mark the required
 * fields") renders a small red asterisk after the label — a quick visual
 * scan distinct from an "(optional)" suffix baked into the label text
 * itself (several fields already spell that out, e.g. "Account number
 * (optional)"); this is the marker for the opposite case. Purely visual —
 * doesn't add HTML `required` validation, since several "required" fields
 * here are validated with a friendlier toast message on submit rather
 * than the browser's own native validation UI. */
export function Field({ label, children, width, title, required }: { label?: string; children: ReactNode; width?: number; title?: string; required?: boolean }) {
  const labelContent = required ? (
    <>
      {label}
      <span style={{ color: 'var(--loss)' }} aria-hidden="true"> *</span>
    </>
  ) : (
    label
  );
  return (
    <label style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, fontSize: 12, color: 'var(--muted)', width, marginBottom: 0 }}>
      {title ? <Tooltip text={title}><span style={{ cursor: 'pointer' }}>{labelContent}</span></Tooltip> : labelContent}
      {children}
    </label>
  );
}

export function TextInput({ width, ...rest }: InputHTMLAttributes<HTMLInputElement> & { width?: number }) {
  return <input {...rest} style={{ width, ...rest.style }} />;
}

export function Select({ width, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { width?: number; children: ReactNode }) {
  return (
    <select {...rest} style={{ width, ...rest.style }}>
      {children}
    </select>
  );
}
