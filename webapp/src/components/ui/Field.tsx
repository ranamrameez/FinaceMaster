import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

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
export function Field({ label, children, width }: { label?: string; children: ReactNode; width?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, fontSize: 12, color: 'var(--muted)', width }}>
      {label}
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
