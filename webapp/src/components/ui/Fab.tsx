import { useState, type ReactNode } from 'react';
import { Tooltip } from '../Tooltip';
import { MenuIcon, XIcon } from '../icons';

/** The floating "+" action button every module uses for its "Often" tier
 * add-entity flow (Done items 82/166/170/202) — was 9 byte-identical
 * copies of the same fixed-position/Tooltip/button block, one per module.
 * Extracted once so the shared `.fab-btn` hover/press animation (a real
 * user-reported gap — "UI should be more interactive... rather than
 * looking like a static motionless page") applies everywhere at once. */
export function FabButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500 }}>
      <Tooltip text={label} align="right">
        <button className="btn fab-btn" onClick={onClick} aria-label={label}>
          {children}
        </button>
      </Tooltip>
    </div>
  );
}

export interface FabAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

/** User-requested (2026-08-28): "single Transfers button... add it to our
 * FAB panel in the whole app. Relevant FABs appear when we expand it
 * (animate click, show more FABs)." Every module page today renders at
 * most ONE always-visible `FabButton` (its own "add a new entity" action) —
 * this generalizes that into a small expandable stack so the same fixed
 * corner can hold that action AND the new app-wide "Transfers" action
 * without permanently showing two buttons on top of each other.
 *
 * A page with only one action (e.g. `AccountDetailPage`, which has no
 * "add a new account" action of its own — only "Transfers" makes sense
 * there) renders exactly like the plain `FabButton` always did, with no
 * pointless expand step for a single choice. */
export function FabPanel({ actions }: { actions: FabAction[] }) {
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  if (actions.length === 1) {
    return <FabButton label={actions[0].label} onClick={actions[0].onClick}>{actions[0].icon}</FabButton>;
  }
  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 500, display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 10 }}>
      {open &&
        actions.map((a, i) => (
          <Tooltip key={i} text={a.label} align="right">
            <button
              className="btn fab-btn fab-btn-secondary"
              onClick={() => {
                a.onClick();
                setOpen(false);
              }}
              aria-label={a.label}
            >
              {a.icon}
            </button>
          </Tooltip>
        ))}
      <Tooltip text={open ? 'Close' : 'Actions'} align="right">
        <button
          className="btn fab-btn"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close actions' : 'Open actions'}
          aria-expanded={open}
        >
          {open ? <XIcon size={18} /> : <MenuIcon size={20} />}
        </button>
      </Tooltip>
    </div>
  );
}
