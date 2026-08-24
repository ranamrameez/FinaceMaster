import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useAmountFormat } from '../hooks/useAmountFormat';
import { fmtMoney } from '../lib/format';
import { Tooltip } from './Tooltip';

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
  open: openProp,
  onToggle,
  style,
  children,
}: {
  title: ReactNode;
  headerExtra?: ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state — when provided, the card no longer tracks its
   * own open/closed state internally and the parent must respond to
   * `onToggle` to actually change it. Used by `Tabs` (item 1: "chip should
   * jump to a section and decollapse it") so a top-level chip click can
   * force a specific section open even if the user had collapsed it. Omit
   * both props to keep the original self-contained behavior every other
   * call site already relies on. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const toggle = () => {
    const next = !open;
    if (onToggle) onToggle(next);
    else setInternalOpen(next);
  };
  return (
    <Card style={style}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        onClick={toggle}
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

/** `hue` sets the `--card-hue` custom property `.stat-card`'s own CSS
 * already reads for its left-border accent and background tint — that CSS
 * existed but nothing ever set the variable, so every stat card silently
 * fell back to the same plain `--accent` color regardless of what it
 * showed (a real user-reported "hard to visually tell cards apart"
 * complaint). Pass any CSS color (a hex from a shared palette, or
 * `var(--profit)`/`var(--loss)` for a P/L-sign-driven stat) to give a
 * card its own identity; omit it to keep the old single-color look. */
export function StatCard({ label, value, sub, title, hue }: { label: string; value: string; sub?: string; title?: string; hue?: string }) {
  return (
    <div className="card stat-card" style={hue ? ({ '--card-hue': hue } as CSSProperties) : undefined}>
      <div className="label">{label}</div>
      {title ? (
        <Tooltip text={title}>
          <div className="value">{value}</div>
        </Tooltip>
      ) : (
        <div className="value">{value}</div>
      )}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/** A money amount rendered in a stat-card `.value` div: the visible text is
 * either the compact/abbreviated form (`fmtMoneyCompact`, e.g. "12.35M
 * PKR") or the full un-abbreviated number, per the user's Appearance →
 * "Number display" preference (`useAmountFormat`, README item 56's compact
 * form followed by a later user-requested toggle away from it being the
 * only option). In compact mode the native `title` tooltip still carries
 * the full-precision amount; in raw mode the visible text already IS that
 * amount, so the tooltip would be redundant and is skipped. One place for
 * this pattern instead of repeating it at each of the ~20 call sites that
 * previously just rendered `fmtMoney` directly. `after` renders extra
 * inline text (e.g. a "(12.3%)" suffix) that isn't part of the money
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
  const { raw, money } = useAmountFormat();
  const content = (
    <div className={className}>
      {money(n, currency)}
      {after}
    </div>
  );
  return raw ? content : <Tooltip text={fmtMoney(n, currency)}>{content}</Tooltip>;
}
