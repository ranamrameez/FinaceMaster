import type { ReactNode } from 'react';
import { Tooltip } from '../Tooltip';

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
