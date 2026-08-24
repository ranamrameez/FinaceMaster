import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { fmtMoney, fmtMoneyCompact } from '../lib/format';

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

/** `title` (optional) becomes a native browser tooltip on the value —
 * used to show the full, un-rounded/un-abbreviated number when `value`
 * itself is a compact display string (e.g. "12.35M PKR" with a title of
 * "12,345,678.90 PKR"). Native `title` needs no extra markup/JS and works
 * the same on desktop hover as it does nowhere on mobile (there's no
 * hover there), which is fine — mobile's own screens are narrow enough
 * that the compact form is the point. */
/** A Card whose header toggles its body open/closed, accordion-style —
 * user request ("cards should be collapsible by their headers"). `title`
 * is whatever heading content the card already used (usually an `<h3>`);
 * `headerExtra` renders alongside it on the right (e.g. a "Full portfolio
 * →" link) and stops its own clicks from toggling the card, so it stays
 * independently clickable. Defaults open so nothing looks different from
 * a plain Card until the user actually collapses something. */
export function CollapsibleCard({
  title,
  headerExtra,
  defaultOpen = true,
  style,
  children,
}: {
  title: ReactNode;
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={style}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              transition: 'transform .15s ease',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'var(--muted)',
              fontSize: 12,
            }}
          >
            ▸
          </span>
          {title}
        </div>
        {headerExtra && <div onClick={(e) => e.stopPropagation()}>{headerExtra}</div>}
      </div>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </Card>
  );
}

export function StatCard({ label, value, sub, title }: { label: string; value: string; sub?: string; title?: string }) {
  return (
    <div className="card stat-card">
      <div className="label">{label}</div>
      <div className="value" title={title}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/** A money amount rendered in a stat-card `.value` div: the visible text is
 * the compact/abbreviated form (`fmtMoneyCompact`, e.g. "12.35M PKR"), and
 * the native `title` tooltip carries the full-precision amount — one place
 * for the "round for a clean look, keep the real number a hover away"
 * pattern used across every module's hand-rolled stat cards, instead of
 * repeating `fmtMoneyCompact`+`fmtMoney`+`title` at each of the ~20 call
 * sites that previously just rendered `fmtMoney` directly. `after` renders
 * extra inline text (e.g. a "(12.3%)" suffix) that isn't part of the money
 * amount itself and so isn't abbreviated or covered by the tooltip. */
export function MoneyValue({
  n,
  currency,
  className = 'value',
  after,
}: {
  n: number;
  currency: string;
  className?: string;
  after?: ReactNode;
}) {
  return (
    <div className={className} title={fmtMoney(n, currency)}>
      {fmtMoneyCompact(n, currency)}
      {after}
    </div>
  );
}
