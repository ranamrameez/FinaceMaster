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
 * than the browser's own native validation UI.
 *
 * User-reported (app-wide audit), TWICE — a hand-rolled `<span>{' *'}</span>`
 * with a JS-string non-breaking space still visibly wrapped the asterisk
 * onto its own line in a real narrow Field (e.g. the "Add a trade" popup's
 * Ticker/Shares/Price columns). Rather than keep debugging the exact JSX/
 * flex interaction that let it break, moved to the simpler, more robust
 * fix the user asked for directly: a single `.field-required::after` CSS
 * rule (`theme.css`) with the marker as one pseudo-element `content`
 * string — there's no separate DOM text node + sibling `<span>` for a line
 * break to ever land between, since the label text and its marker are one
 * indivisible box as far as text layout is concerned. */
/** `width` defaults to 180 (2026-08-28, user-reported: "give same width
 * ...to all form elements app wide...for best UI consistency") — most
 * `Field` call sites across the app either pass their own considered width
 * (a short Currency code, a wide Description) or pass none at all, in
 * which case the wrapping label — and, via flex's default `align-items:
 * stretch`, the input/select inside it — used to size itself off native
 * browser defaults, which is exactly the "inconsistent" sizing being
 * reported. A shared default here fixes every no-width call site at once
 * without touching the ones that already pass their own `width` for a real
 * reason (an explicit `width` prop always wins, same as before). */
/** `as="div"` (2026-09-09, user-reported "you falsely claimed a fix!" on
 * the Pending chip): wrapping a `<button>` in this component's `<label>`
 * did NOT fix the earlier "checkbox click area too big" bug — `<button>`
 * is itself a "labelable" HTML element, so the `<label>` still forwarded
 * ANY click landing on its own blank space (the whole ~180x50 box, not
 * just the visible chip) to the nested button, exactly like it did for a
 * checkbox. Confirmed live: clicking 10px into the "Order" label's
 * caption text — nowhere near the rendered chip — still toggled
 * `isPending`. Tried suppressing it with `e.preventDefault()` in a
 * bubble-phase click handler on the label first (the textbook fix for
 * this exact browser behavior) — confirmed via a console.log that the
 * handler DOES fire and DOES call `preventDefault()`, and the chip STILL
 * toggled anyway; empirically, React's root-level event delegation
 * doesn't suppress the browser's native label→control click forwarding
 * the way a direct native listener would, so that approach doesn't
 * actually work here. The robust fix instead sidesteps the whole
 * question: render a plain `<div>` (no label-activation behavior exists
 * for a div at all) instead of a `<label>` wherever the wrapped content
 * isn't a real input/select a caption should focus into. Default stays
 * `'label'` — every existing call site (wrapping a real input/select,
 * where click-to-focus the caption IS the whole point) is unaffected;
 * only `PendingToggle`'s own Field wrappers pass `as="div"`. */
export function Field({ label, children, width = 180, title, required, as = 'label' }: { label?: string; children: ReactNode; width?: number; title?: string; required?: boolean; as?: 'label' | 'div' }) {
  const labelContent = required ? <span className="field-required">{label}</span> : label;
  const Tag = as;
  return (
    <Tag style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, fontSize: 12, color: 'var(--muted)', width, marginBottom: 0 }}>
      {title ? <Tooltip text={title}><span style={{ cursor: 'pointer' }}>{labelContent}</span></Tooltip> : labelContent}
      {children}
    </Tag>
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
