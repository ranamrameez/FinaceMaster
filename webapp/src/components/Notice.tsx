import type { CSSProperties, ReactNode } from 'react';

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

const NOTICE_ICON: Record<NoticeTone, string> = { info: 'ℹ', warning: '⚠', danger: '⛔', success: '✓' };

/** A visually distinct callout for warnings/notices — user-reported (item
 * 11) that ad hoc `borderLeft: '3px solid var(--warn, orange)'` boxes on a
 * plain `.card` (13 near-identical call sites app-wide before this) didn't
 * read as meaningfully different from a regular card, and (item 10) that a
 * thin left-border accent looks bad on its own. Uses a full tinted
 * background + matching border instead of a left bar, plus a leading icon,
 * so a notice is unmistakably not just another card. */
export function Notice({ tone = 'info', children, style }: { tone?: NoticeTone; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`notice notice-${tone}`} style={style}>
      <span className="notice-icon" aria-hidden="true">{NOTICE_ICON[tone]}</span>
      <div className="notice-body">{children}</div>
    </div>
  );
}
