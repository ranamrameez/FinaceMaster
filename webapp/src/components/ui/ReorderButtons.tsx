import { ArrowDownIcon, ArrowUpIcon } from '../icons';
import { IconButton } from './IconButton';
import { canMoveInTie, moveInTie } from '../../hooks/useTieGroupReorder';

/** Same-day reorder controls (Done item 235) — renders NOTHING for a row
 * that isn't part of a tie group at all (the common case), keeping every
 * ordinary row visually clean; only a row genuinely tied with a neighbor
 * on the exact same real instant gets up/down buttons at all, and each
 * one is individually disabled once it's at the edge of its own tie
 * group. `rows` must already be in the table's real display order — see
 * `useTieGroupReorder.ts`'s own doc comment for the full reasoning.
 *
 * `idOf`/`orderOf` are getters rather than assuming fixed field names —
 * Cash/Bank/Rentals use `serialNumber`, QSE/PSX/Funds/Personal Loans use
 * `seq` — so one component covers both without either module renaming
 * its own field. `onMove` receives the raw `{id, order}` pairs; the
 * caller maps `order` onto whichever field name its own `updateX(id,
 * patch)` action expects. */
export function ReorderButtons<T>({
  rows,
  index,
  instantOf,
  idOf,
  orderOf,
  onMove,
}: {
  rows: T[];
  index: number;
  instantOf: (r: T) => number;
  idOf: (r: T) => string;
  orderOf: (r: T) => number | undefined;
  onMove: (pairs: [{ id: string; order: number }, { id: string; order: number }]) => void;
}) {
  const up = canMoveInTie(rows, index, 'up', instantOf);
  const down = canMoveInTie(rows, index, 'down', instantOf);
  if (!up && !down) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      <IconButton
        label="Move up — shares the same date/time as the row above; this only changes their relative order, not either one's real date."
        icon={<ArrowUpIcon size={12} />}
        disabled={!up}
        onClick={() => {
          const pair = moveInTie(rows, index, 'up', instantOf, idOf, orderOf);
          if (pair) onMove(pair);
        }}
      />
      <IconButton
        label="Move down — shares the same date/time as the row below; this only changes their relative order, not either one's real date."
        icon={<ArrowDownIcon size={12} />}
        disabled={!down}
        onClick={() => {
          const pair = moveInTie(rows, index, 'down', instantOf, idOf, orderOf);
          if (pair) onMove(pair);
        }}
      />
    </span>
  );
}
