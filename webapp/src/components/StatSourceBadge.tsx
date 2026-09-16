import { Tooltip } from './Tooltip';

export type StatSource = 'official' | 'advisory' | 'history';

/** User-reported trust crisis (2026-09-16): "I don't have confidence in
 * Exchanges now... I dont know how your calculating and displaying the
 * stats." Three genuinely different calculations coexist on the same QSE/
 * PSX pages, with nothing on screen distinguishing them:
 *
 * - `official` — your REAL position (Avg Cost/Break-even/P&L), computed
 *   from `computePositions()` (weighted-average — QSE always, PSX unless
 *   you opted into FIFO under Settings). This is what your broker's own
 *   statement would show, and it is NEVER changed by anything on the Trade
 *   Strategy page — "Sell this lot"/Strategic Trades only ever *suggest* a
 *   future trade, they don't retroactively touch this number.
 * - `advisory` — a what-if projection from the Trade Strategy page
 *   (Strategic Trades / Partial Trade Advisor / a plan's blended stats) —
 *   deliberately scoped to just a plan or a lot, not your whole real
 *   position, and has no effect on anything until you actually log the
 *   trade (at which point it becomes part of `official`).
 * - `history` — a reporting-only ledger (Closed trades / Open trades on
 *   the Trade Transactions page) for browsing your own logged trades, with
 *   its own independent Match order toggle (FIFO / Cheapest lot first) —
 *   also disconnected from `official`, which never changes based on that
 *   toggle either.
 *
 * A small always-visible badge + tooltip next to each surface's own
 * heading, rather than trying to explain this once and hoping it's
 * remembered — the same "explain it right where it's shown" pattern this
 * app already uses for `Tooltip` everywhere else. */
const LABELS: Record<StatSource, { text: string; tone: string; tooltip: string }> = {
  official: {
    text: 'Official',
    tone: 'pill-info',
    tooltip:
      'Your real position, exactly as your broker would show it — computed from every trade you’ve logged (weighted-average cost, or FIFO if you turned that on in Settings). Nothing on the Trade Strategy page ever changes this number.',
  },
  advisory: {
    text: 'Strategic · Advisory',
    tone: 'pill-warn',
    tooltip:
      'A what-if projection, not your real position — blends a hypothetical plan or a cheapest-lot-first sell strategy with what you actually hold. Has zero effect on your Official Avg Cost/Break-even/P&L until you actually log the trade.',
  },
  history: {
    text: 'Trade history',
    tone: 'pill-neutral',
    tooltip:
      'A reporting view of your logged trades for browsing purposes, with its own Match order toggle — independent of, and never changes, your Official position stats shown elsewhere.',
  },
};

export function StatSourceBadge({ source }: { source: StatSource }) {
  const cfg = LABELS[source];
  return (
    <Tooltip text={cfg.tooltip}>
      <span className={`pill ${cfg.tone}`} style={{ fontSize: 10, marginLeft: 8, verticalAlign: 'middle' }}>
        {cfg.text}
      </span>
    </Tooltip>
  );
}
