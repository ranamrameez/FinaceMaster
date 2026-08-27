import { useEffect, useRef, useState } from 'react';

export interface ModuleSyncStatus {
  name: string;
  status: string;
}

type Tier = 'error' | 'syncing' | 'stale' | 'synced';

function classify(status: string): Tier {
  const s = status.toLowerCase();
  if (s.includes('error') || s.includes('unavailable')) return 'error';
  if (s === 'syncing…') return 'syncing';
  if (s.includes('no cloud data found')) return 'stale';
  return 'synced';
}

const RANK: Record<Tier, number> = { error: 0, syncing: 1, stale: 2, synced: 3 };
const LABEL: Record<Tier, string> = { error: 'Sync issue', syncing: 'Syncing…', stale: 'No cloud data yet', synced: 'Synced' };
const DOT: Record<Tier, string> = { error: 'var(--loss)', syncing: '#f5a623', stale: 'var(--muted)', synced: 'var(--profit)' };

/** App-wide sync-status indicator (README Pending item 76) — a single
 * worst-of-N summary of every module's own independent cloud-sync hook,
 * previously buried inside each module's own "Account" section, with a
 * click-to-expand popover breaking down every module's real status text
 * (the third option the Pending item named, kept alongside worst-of-N
 * rather than instead of it).
 *
 * "Worst-of-N" (not most-recent) was the deliberate choice here: a single
 * module failing to sync is exactly the kind of thing worth surfacing
 * immediately — a most-recent-wins design would hide a stuck/erroring
 * module behind whatever happened to sync last, which defeats the point
 * of a unified indicator. Only rendered once signed in — the existing
 * "Not signed in — tap to sign in" account row in the Sidebar already
 * covers the signed-out state clearly; duplicating that message here
 * would be redundant, not additive.
 *
 * Reuses the exact `position:fixed`-with-no-explicit-offsets popover
 * pattern already used by `AppearancePanel`/`CategoryNav` (see
 * `theme.css`'s own comment on `.appearance-panel` for why: it escapes
 * the sidebar's `overflow:auto` clipping while staying visually anchored
 * where it'd sit in normal flow) — new `.sync-status-*` CSS, kept
 * separate from `.appearance-*`/`.category-*` since these are a third
 * independent trigger/panel pair, not a variant of an existing one. */
export function SyncStatusIndicator({ modules }: { modules: ModuleSyncStatus[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!modules.length) return null;
  const worst = modules.reduce((acc, m) => (RANK[classify(m.status)] < RANK[classify(acc.status)] ? m : acc));
  const tier = classify(worst.status);

  return (
    <div className="sync-status-popover" ref={containerRef}>
      <button
        type="button"
        className="navbtn account-sub-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="num" style={{ color: DOT[tier] }} aria-hidden="true">●</span>
        {LABEL[tier]}
      </button>
      {open && (
        <div className="sync-status-panel">
          <div className="appearance-panel-title">Sync status by module</div>
          {modules.map((m) => {
            const t = classify(m.status);
            return (
              <div key={m.name} className="sync-status-row">
                <span className="num" style={{ color: DOT[t] }} aria-hidden="true">●</span>
                <span style={{ flex: 1 }}>{m.name}</span>
                <span className="footer-note">{m.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
