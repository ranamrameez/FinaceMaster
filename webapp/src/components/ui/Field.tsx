import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/** Labeled form field wrapper — consistent label+control spacing instead of
 * ad-hoc inline styles scattered per page. */
export function Field({ label, children, width }: { label?: string; children: ReactNode; width?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)', width }}>
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
