import { describe, expect, it } from 'vitest';
import { canMoveInTie, moveInTie } from '../useTieGroupReorder';

interface Row { id: string; order?: number; instant: number; }
const instantOf = (r: Row) => r.instant;
const idOf = (r: Row) => r.id;
const orderOf = (r: Row) => r.order;

describe('canMoveInTie', () => {
  it('allows moving up/down within a tie group of 2', () => {
    const rows: Row[] = [
      { id: 'a', order: 1, instant: 100 },
      { id: 'b', order: 2, instant: 100 },
    ];
    expect(canMoveInTie(rows, 0, 'up', instantOf)).toBe(false); // no row above
    expect(canMoveInTie(rows, 0, 'down', instantOf)).toBe(true);
    expect(canMoveInTie(rows, 1, 'up', instantOf)).toBe(true);
    expect(canMoveInTie(rows, 1, 'down', instantOf)).toBe(false); // no row below
  });

  it('disallows moving across a real instant boundary', () => {
    const rows: Row[] = [
      { id: 'a', order: 1, instant: 100 },
      { id: 'b', order: 2, instant: 200 }, // different real time — not a tie
    ];
    expect(canMoveInTie(rows, 0, 'down', instantOf)).toBe(false);
    expect(canMoveInTie(rows, 1, 'up', instantOf)).toBe(false);
  });

  it('a middle row in a 3-way tie can move both directions', () => {
    const rows: Row[] = [
      { id: 'a', order: 1, instant: 100 },
      { id: 'b', order: 2, instant: 100 },
      { id: 'c', order: 3, instant: 100 },
    ];
    expect(canMoveInTie(rows, 1, 'up', instantOf)).toBe(true);
    expect(canMoveInTie(rows, 1, 'down', instantOf)).toBe(true);
  });

  it('a row with distinct neighbors on both sides cannot move either way', () => {
    const rows: Row[] = [
      { id: 'a', order: 1, instant: 50 },
      { id: 'b', order: 2, instant: 100 },
      { id: 'c', order: 3, instant: 150 },
    ];
    expect(canMoveInTie(rows, 1, 'up', instantOf)).toBe(false);
    expect(canMoveInTie(rows, 1, 'down', instantOf)).toBe(false);
  });
});

describe('moveInTie', () => {
  it('swaps the two adjacent tied rows\' order values, leaving id untouched', () => {
    const rows: Row[] = [
      { id: 'a', order: 1, instant: 100 },
      { id: 'b', order: 2, instant: 100 },
    ];
    const result = moveInTie(rows, 1, 'up', instantOf, idOf, orderOf);
    expect(result).toEqual([
      { id: 'b', order: 1 },
      { id: 'a', order: 2 },
    ]);
  });

  it('returns null when the move is invalid (not a tie)', () => {
    const rows: Row[] = [
      { id: 'a', order: 1, instant: 100 },
      { id: 'b', order: 2, instant: 200 },
    ];
    expect(moveInTie(rows, 0, 'down', instantOf, idOf, orderOf)).toBeNull();
  });

  it('returns null at the edge of the array', () => {
    const rows: Row[] = [{ id: 'a', order: 1, instant: 100 }];
    expect(moveInTie(rows, 0, 'up', instantOf, idOf, orderOf)).toBeNull();
    expect(moveInTie(rows, 0, 'down', instantOf, idOf, orderOf)).toBeNull();
  });

  it('treats a missing order value as 0 rather than leaving it undefined in the swap', () => {
    const rows: Row[] = [
      { id: 'a', instant: 100 }, // no order at all — an old, un-backfilled record
      { id: 'b', order: 5, instant: 100 },
    ];
    const result = moveInTie(rows, 0, 'down', instantOf, idOf, orderOf);
    expect(result).toEqual([
      { id: 'a', order: 5 },
      { id: 'b', order: 0 },
    ]);
  });

  it('a 3-way tie: moving the middle row down swaps it with the last, leaving the first untouched', () => {
    const rows: Row[] = [
      { id: 'a', order: 1, instant: 100 },
      { id: 'b', order: 2, instant: 100 },
      { id: 'c', order: 3, instant: 100 },
    ];
    const result = moveInTie(rows, 1, 'down', instantOf, idOf, orderOf);
    expect(result).toEqual([
      { id: 'b', order: 3 },
      { id: 'c', order: 2 },
    ]);
  });
});
