import { describe, expect, it } from 'vitest';
import type { PricePoint } from '../../../types/workbook';
import { computePriceStats } from '../priceHistory';

describe('computePriceStats', () => {
  it('computes min/max/median across a single update per day (unaffected by the fix)', () => {
    const history: Record<string, PricePoint[]> = {
      TEST: [
        { date: '2026-08-20', price: 100 },
        { date: '2026-08-21', price: 110 },
        { date: '2026-08-22', price: 90 },
      ],
    };
    const stats = computePriceStats('TEST', history);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(90);
    expect(stats!.max).toBe(110);
    expect(stats!.median).toBe(100);
    expect(stats!.chronological.map((p) => p.price)).toEqual([100, 110, 90]);
  });

  it('reflects real intraday movement across many same-day updates instead of collapsing to the last one', () => {
    // Real bug (2026-08-24): several updates on the same calendar day used
    // to collapse to just the last value before min/max/median were
    // computed, so a genuinely volatile day showed identical
    // lowest/median/highest — exactly what a user reported as "the graph
    // isn't picking up today's prices."
    const history: Record<string, PricePoint[]> = {
      TEST: [
        { date: '2026-08-24', price: 332, time: '2026-08-24T05:09:07.678Z' },
        { date: '2026-08-24', price: 330.21, time: '2026-08-24T06:23:12.126Z' },
        { date: '2026-08-24', price: 331.35, time: '2026-08-24T07:06:11.606Z' },
        { date: '2026-08-24', price: 332.49, time: '2026-08-24T07:29:04.242Z' },
      ],
    };
    const stats = computePriceStats('TEST', history);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(330.21);
    expect(stats!.max).toBe(332.49);
    expect(stats!.min).not.toBe(stats!.max); // the exact symptom of the bug: these came out equal
    expect(stats!.chronological.map((p) => p.price)).toEqual([332, 330.21, 331.35, 332.49]);
    expect(stats!.recent).toHaveLength(4);
  });

  it('sorts chronological/recent by time when present, falling back to date for older entries without one', () => {
    const history: Record<string, PricePoint[]> = {
      TEST: [
        { date: '2026-08-24', price: 100 }, // no time — legacy entry
        { date: '2026-08-24', price: 105, time: '2026-08-24T09:00:00.000Z' },
      ],
    };
    const stats = computePriceStats('TEST', history);
    expect(stats!.chronological.map((p) => p.price)).toEqual([100, 105]);
  });

  it('returns null when there is no price history at all', () => {
    expect(computePriceStats('TEST', {})).toBeNull();
  });
});
