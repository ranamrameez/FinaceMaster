import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Pos {
  top: number;
  left?: number;
  right?: number;
  placement: 'above' | 'below';
}

/** A real popup-style tooltip — user-reported: native `title` hover
 * tooltips are small, easy to miss, and invisible on mobile/touch
 * entirely (no hover there). Shows a themed, larger-font popup on hover
 * (desktop) AND on click/tap (so touch users can see it too).
 *
 * Positioning is two-pass: the popup first mounts `visibility: hidden` at
 * a guessed spot (below the trigger) so its OWN actual rendered height
 * can be measured — a long tooltip's height isn't known until it's
 * actually laid out, and guessing at a fixed "is there N px above"
 * threshold up front still clipped a long tooltip whose real height
 * exceeded that guess (confirmed via a real screenshot: a 9-line tooltip
 * still ran off the top of the viewport). Once measured, it's placed
 * above the trigger only if that measured height actually fits there,
 * then made visible. `position: fixed` (not `absolute`) so a trigger
 * inside a scrollable table/card never gets its tooltip clipped by the
 * container's own `overflow`. */
export function Tooltip({ text, children, align = 'left' }: { text: string; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [measured, setMeasured] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      setMeasured(false);
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: align === 'right' ? undefined : rect.left,
      right: align === 'right' ? window.innerWidth - rect.right : undefined,
      placement: 'below',
    });
  }, [open, align]);

  useLayoutEffect(() => {
    if (!open || measured || !pos || !triggerRef.current || !popupRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popupHeight = popupRef.current.getBoundingClientRect().height;
    const fitsAbove = triggerRect.top - 6 - popupHeight > 8;
    if (fitsAbove) {
      setPos({ ...pos, top: triggerRect.top - 6, placement: 'above' });
    }
    setMeasured(true);
  }, [open, measured, pos]);

  if (!text) return <>{children}</>;
  return (
    <span
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      {children}
      {open && pos && (
        <span
          ref={popupRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            right: pos.right,
            transform: pos.placement === 'above' ? 'translateY(-100%)' : undefined,
            visibility: measured ? 'visible' : 'hidden',
            zIndex: 200,
            background: 'var(--panel-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 14,
            lineHeight: 1.4,
            fontWeight: 400,
            width: 'max-content',
            maxWidth: 280,
            boxShadow: '0 6px 24px rgba(0,0,0,.25)',
            whiteSpace: 'normal',
            textAlign: 'left',
            // User-reported (item 3): a trigger nested inside a <th> (e.g.
            // RiskCalculator's "Recovery"/"Signal" table-header tooltips)
            // inherits `thead th`'s global text-transform:uppercase — this
            // popup is a DOM child of that same <th>, `position:fixed`
            // only changes where it paints, not what it inherits, so it
            // picked up the same uppercase transform even though it's
            // explanatory body text, not a heading. Reset explicitly
            // rather than depending on knowing every ancestor a Tooltip
            // might ever be nested inside.
            textTransform: 'none',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
