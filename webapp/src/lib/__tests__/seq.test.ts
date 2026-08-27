import { describe, expect, it } from 'vitest';
import { backfillSeq, nextSeq } from '../seq';

describe('nextSeq', () => {
  it('returns 1 for an empty array', () => {
    expect(nextSeq([])).toBe(1);
  });

  it('returns one more than the highest existing seq', () => {
    expect(nextSeq([{ seq: 1 }, { seq: 5 }, { seq: 3 }])).toBe(6);
  });

  it('treats a missing seq as 0', () => {
    expect(nextSeq([{ seq: 2 }, {}])).toBe(3);
  });
});

describe('backfillSeq', () => {
  it('leaves records untouched when every record already has a seq', () => {
    const records = [{ id: 'a', seq: 1 }, { id: 'b', seq: 2 }];
    expect(backfillSeq(records, records)).toBe(records); // same reference, no-op
  });

  it('assigns increasing seq in chronological order, preserving the original array order', () => {
    const c: { id: string; date: string; seq?: number } = { id: 'c', date: '2026-01-03' }; // seq missing
    const a: { id: string; date: string; seq?: number } = { id: 'a', date: '2026-01-01' }; // seq missing
    const b: { id: string; date: string; seq?: number } = { id: 'b', date: '2026-01-02' }; // seq missing
    // Stored (original) array order is c, a, b — deliberately NOT chronological.
    const records = [c, a, b];
    const chronological = [a, b, c]; // caller's own best-guess chronological order
    const result = backfillSeq(records, chronological);
    // Original array order preserved.
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    // Seq assigned in chronological order: a=1, b=2, c=3.
    const byId = Object.fromEntries(result.map((r) => [r.id, r.seq]));
    expect(byId.a).toBe(1);
    expect(byId.b).toBe(2);
    expect(byId.c).toBe(3);
  });

  it('never assigns a backfilled seq lower than an already-present one', () => {
    const old: { id: string; date: string; seq?: number } = { id: 'old', date: '2026-01-01', seq: 100 }; // already has a real seq
    const newer: { id: string; date: string; seq?: number } = { id: 'newer', date: '2026-01-02' }; // missing seq, chronologically after `old`
    const records = [old, newer];
    const result = backfillSeq(records, [old, newer]);
    const byId = Object.fromEntries(result.map((r) => [r.id, r.seq]));
    expect(byId.old).toBe(100);
    expect(byId.newer).toBeGreaterThan(100);
  });
});
