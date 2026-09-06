import { CheckIcon } from '../icons';

/** User-reported (2026-09-06), on Banking's linked-transfer flow: "use
 * radio/chips for withdrawal or deposit instead of positive & negative
 * entries!" — a two-chip toggle (same `.chip`/`.chip.active` pattern
 * `ChartFilterBar`'s ticker filters and Net Worth's `IncludeChip` already
 * use) for picking a money-movement direction, paired with a plain
 * MAGNITUDE amount input rather than a signed one the user has to
 * remember to prefix with `-`.
 *
 * This directly fixes a real bug, not just a UX preference: Bank had no
 * direction control at all in `TransactionEntryModal` (it relied on the
 * typed amount's own sign), so a LINKED transfer's `from`/`to` side — which
 * `createLinkedTransfer` always decides from `row.direction`, never from
 * amount sign — silently ignored a negative amount and always treated the
 * Bank side as the receiving ("in") side, regardless of what the user
 * typed. Giving Bank a real, user-controlled `direction` value (via this
 * component, wired into `DIRECTION_LABELS`) fixes the sign-vs-direction
 * mismatch at its root, not just in the plain (non-linked) case. */
export function DirectionChips({
  value,
  onChange,
  labels,
}: {
  value: 'in' | 'out';
  onChange: (v: 'in' | 'out') => void;
  labels: { in: string; out: string };
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {(['in', 'out'] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          className={`chip${value === dir ? ' active' : ''}`}
          onClick={() => onChange(dir)}
        >
          {value === dir && <CheckIcon size={11} />}
          {labels[dir]}
        </button>
      ))}
    </div>
  );
}
