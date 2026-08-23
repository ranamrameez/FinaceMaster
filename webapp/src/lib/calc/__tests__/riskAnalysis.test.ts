import { describe, expect, it } from 'vitest';
import type { FeeCalculator } from '../../../types/workbook';
import {
  closestScenario,
  computeAveragingScenario,
  computeAveragingScenarios,
  currentPositionMetrics,
  findDiminishingReturnPoint,
  riskCeiling,
  stressTestScenario,
} from '../riskAnalysis';

// A simple flat 1% fee, no minimum — makes the numbers hand-traceable.
const flatFee: FeeCalculator = (amount) => (amount > 0 ? Math.round(amount * 0.01 * 100) / 100 : 0);

describe('riskCeiling', () => {
  it('scales existing cost basis by risk mode', () => {
    expect(riskCeiling(1000, 'conservative')).toBe(250);
    expect(riskCeiling(1000, 'balanced')).toBe(500);
    expect(riskCeiling(1000, 'aggressive')).toBe(1000);
  });
});

describe('currentPositionMetrics', () => {
  it('computes invested, break-even, recovery %, and net P/L', () => {
    // 100 shares bought at 10 = 1000 invested. Selling at break-even with a
    // 1% fee means price*shares*(1-0.01) == 1000 -> price ≈ 10.101.
    const m = currentPositionMetrics(100, 10, 9, 1, 0.001, flatFee, 'balanced');
    expect(m.invested).toBe(1000);
    expect(m.breakEven).toBeCloseTo(10.101, 2);
    expect(m.recoveryNeededPct).toBeGreaterThan(0); // underwater at current price 9
    expect(m.netPL).toBeLessThan(0); // 9*100 - fee - 1000 < 0
    expect(m.ceiling).toBe(500);
  });
});

describe('computeAveragingScenario', () => {
  it('returns null when the added capital cannot buy a whole share', () => {
    expect(computeAveragingScenario(5, 10, 100, 10, 12, 1, 0.001, flatFee)).toBeNull();
  });

  it('computes a lower average cost and a real break-even after averaging down', () => {
    // 100 shares @ avg 10 (invested 1000), current price 8 (underwater).
    // Add 800 at 8 -> 100 extra shares.
    const s = computeAveragingScenario(800, 8, 100, 10, 9, 1, 0.001, flatFee);
    expect(s).not.toBeNull();
    expect(s!.extraShares).toBe(100);
    expect(s!.newShares).toBe(200);
    // newCost = 1000 (old) + 800 (buy) + buyFee(800*0.01=8) = 1808
    expect(s!.newCost).toBeCloseTo(1808, 2);
    expect(s!.newAvg).toBeCloseTo(1808 / 200, 4);
    // New average (9.04) is below the old average (10) — averaging down worked.
    expect(s!.newAvg).toBeLessThan(10);
  });
});

describe('computeAveragingScenarios / closestScenario', () => {
  it('includes the users own capital amount even if off the fixed ladder', () => {
    const scenarios = computeAveragingScenarios(333, 8, 100, 10, 9, 1, 0.001, flatFee);
    expect(scenarios.some((s) => s.add === 333)).toBe(true);
    // Sorted ascending by add.
    expect(scenarios.map((s) => s.add)).toEqual([...scenarios.map((s) => s.add)].sort((a, b) => a - b));
  });

  it('closestScenario picks the rung nearest the requested capital', () => {
    const scenarios = computeAveragingScenarios(500, 8, 100, 10, 9, 1, 0.001, flatFee);
    const best = closestScenario(scenarios, 500);
    expect(best?.add).toBe(500);
  });
});

describe('findDiminishingReturnPoint', () => {
  it('finds the first rung whose marginal improvement drops below the threshold', () => {
    // Recovery-needed % strictly decreasing with sharply diminishing steps.
    const scenarios = [
      { add: 100, recoveryNeededPct: 20 },
      { add: 200, recoveryNeededPct: 10 },
      { add: 300, recoveryNeededPct: 9.9 }, // delta 0.1pp < default 0.25pp threshold
      { add: 400, recoveryNeededPct: 9.8 },
    ] as never[];
    const stop = findDiminishingReturnPoint(scenarios as never, 0.25);
    expect((stop as never as { add: number } | null)?.add).toBe(300);
  });

  it('returns null when every step still improves meaningfully', () => {
    const scenarios = [
      { add: 100, recoveryNeededPct: 20 },
      { add: 200, recoveryNeededPct: 10 },
      { add: 300, recoveryNeededPct: 1 },
    ] as never[];
    expect(findDiminishingReturnPoint(scenarios as never, 0.25)).toBeNull();
  });
});

describe('stressTestScenario', () => {
  it('applies price drops against the scenario position, ending with the custom stress %', () => {
    const s = computeAveragingScenario(800, 8, 100, 10, 9, 1, 0.001, flatFee)!;
    const points = stressTestScenario(s, 8, 20, flatFee);
    expect(points.map((p) => p.label)).toEqual(['Current', '-2%', '-5%', '-10%', '-15%', 'Stress']);
    expect(points[0].priceChangePct).toBe(0);
    expect(points.at(-1)!.priceChangePct).toBe(-20);
    // P/L should be monotonically worse as the drop gets deeper.
    for (let i = 1; i < points.length - 1; i++) {
      // (Stress is appended last and may not sit on the monotonic curve if
      // the user's stress % is milder than -15%, so only assert up to -15%.)
      if (points[i].label !== 'Stress') expect(points[i].pl).toBeLessThanOrEqual(points[i - 1].pl);
    }
  });
});
