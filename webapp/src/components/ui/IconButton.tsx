import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from '../Tooltip';

/** A generic, repeated utility button (Edit/Delete/Save/Cancel/Export/etc)
 * shown as icon-only with its label moved into a real `Tooltip` popup
 * instead of a permanent text label — user-reported: these buttons were
 * cluttering already-dense rows/toolbars with text that a tooltip conveys
 * just as well once the icon itself is self-evident from position/shape.
 * Not for primary CTAs (e.g. "Save transaction") — those keep visible text
 * since they're a page's main action, not a repeated small utility. */
export function IconButton({
  label,
  icon,
  align = 'left',
  className = 'btn secondary small',
  ...rest
}: {
  label: string;
  icon: ReactNode;
  align?: 'left' | 'right';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip text={label} align={align}>
      <button {...rest} className={className} aria-label={label} style={{ padding: '5px 9px', ...rest.style }}>
        {icon}
      </button>
    </Tooltip>
  );
}
