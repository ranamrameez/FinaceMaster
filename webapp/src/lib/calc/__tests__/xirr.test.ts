import { describe, expect, it } from 'vitest';
import { xirr } from '../xirr';

describe('xirr', () => {
  it('computes an exact 10% annualized return for a simple one-year round trip', () => {
    const rate = xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2026-01-01'), amount: 1100 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate! * 100).toBeCloseTo(10, 0);
  });

  it('gives a higher rate for a bigger return over the same period', () => {
    const modest = xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2026-01-01'), amount: 1050 },
    ]);
    const big = xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2026-01-01'), amount: 1300 },
    ]);
    expect(modest).not.toBeNull();
    expect(big).not.toBeNull();
    expect(big!).toBeGreaterThan(modest!);
  });

  it('handles multiple investments at different times plus a final valuation', () => {
    const rate = xirr([
      { date: new Date('2024-01-01'), amount: -5000 },
      { date: new Date('2024-09-01'), amount: -2000 },
      { date: new Date('2026-08-23'), amount: 8500 }, // final synthetic "current value" flow
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0); // grew overall
  });

  it('returns null with fewer than two cash flows', () => {
    expect(xirr([])).toBeNull();
    expect(xirr([{ date: new Date(), amount: -100 }])).toBeNull();
  });

  it('returns null when every flow is the same sign (no real rate solves it)', () => {
    expect(xirr([
      { date: new Date('2025-01-01'), amount: -100 },
      { date: new Date('2025-06-01'), amount: -200 },
    ])).toBeNull();
    expect(xirr([
      { date: new Date('2025-01-01'), amount: 100 },
      { date: new Date('2025-06-01'), amount: 200 },
    ])).toBeNull();
  });
});
