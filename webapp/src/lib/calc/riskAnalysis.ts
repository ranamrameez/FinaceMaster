import { breakEvenPrice } from './fees';
import type { FeeCalculator } from '../../types/workbook';

/** README item 20 / MODULES_PLAN.md §9: native port of the legacy
 * `Risk_Analysis_Calculator.html`'s averaging-down planner — given an open
 * position, model adding capital at the current price to see how the
 * average cost, break-even, and target-sell P/L move, plus a stress test
 * on the resulting position. Shared by QSE and PSX (each supplies its own
 * `calcFee`); unlike the legacy page (QSE-only, closed-form break-even
 * assuming a flat % fee), this reuses the app's real iterative
 * `breakEvenPrice` solver so it's correct under PSX's tiered/same-day-net
 * fee model too, not just QSE's flat percentage.
 *
 * One deliberate correctness fix vs. the legacy page: the legacy
 * `scenario()` didn't add a buy fee to the hypothetical new purchase's
 * cost, understating the new cost basis (and therefore understating the
 * resulting break-even) relative to how `computePositions()` treats every
 * other purchase in this app. Fixed here for consistency, not "guessing a
 * new formula" — same fee-inclusive-cost-basis convention used everywhere
 * else. Also dropped: the legacy page's hardcoded "MPHC/IQCD = severe"
 * headline special-case — that was leftover from one person's real
 * portfolio, not a generalizable rule, so it isn't ported. */

export type RiskMode = 'conservative' | 'balanced' | 'aggressive';

export const RISK_MODE_MULTIPLIERS: Record<RiskMode, number> = {
  conservative: 0.25,
  balanced: 0.5,
  aggressive: 1,
};

/** The suggested capital ceiling for averaging down, scaled off the
 * existing position's cost basis by risk appetite. Advisory only — never
 * enforced, never a guarantee of recovery. */
export function riskCeiling(existingCostBasis: number, mode: RiskMode): number {
  return existingCostBasis * RISK_MODE_MULTIPLIERS[mode];
}

export interface CurrentPositionMetrics {
  invested: number;
  breakEven: number;
  recoveryNeededPct: number;
  netPL: number;
  ceiling: number;
}

export function currentPositionMetrics(
  shares: number,
  avgCost: number,
  currentPrice: number,
  feePct: number,
  tick: number,
  calcFee: FeeCalculator,
  mode: RiskMode,
): CurrentPositionMetrics {
  const invested = shares * avgCost;
  const breakEven = breakEvenPrice(invested, shares, feePct, tick, calcFee);
  const recoveryNeededPct = currentPrice > 0 ? (breakEven / currentPrice - 1) * 100 : 0;
  const currentValue = shares * currentPrice;
  const netPL = currentValue - calcFee(currentValue, false, { shares }) - invested;
  return { invested, breakEven, recoveryNeededPct, netPL, ceiling: riskCeiling(invested, mode) };
}

export interface AveragingScenario {
  add: number;
  extraShares: number;
  newShares: number;
  newCost: number;
  newAvg: number;
  breakEven: number;
  /** % the current price would need to rise to reach the new break-even. */
  recoveryNeededPct: number;
  netAtTarget: number;
}

/** One "what if I add `add` at the current price" scenario. Null when
 * `add` doesn't even buy one whole share at the current price. */
export function computeAveragingScenario(
  add: number,
  currentPrice: number,
  shares: number,
  avgCost: number,
  targetSellPrice: number,
  feePct: number,
  tick: number,
  calcFee: FeeCalculator,
): AveragingScenario | null {
  if (currentPrice <= 0) return null;
  const extraShares = Math.floor(add / currentPrice);
  if (extraShares <= 0) return null;

  const oldCost = shares * avgCost;
  const buyFee = calcFee(extraShares * currentPrice, true, { shares: extraShares });
  const newShares = shares + extraShares;
  const newCost = oldCost + extraShares * currentPrice + buyFee;
  const newAvg = newCost / newShares;
  const breakEven = breakEvenPrice(newCost, newShares, feePct, tick, calcFee);
  const recoveryNeededPct = (breakEven / currentPrice - 1) * 100;

  const sellGross = targetSellPrice * newShares;
  const sellFee = calcFee(sellGross, false, { shares: newShares });
  const netAtTarget = sellGross - sellFee - newCost;

  return { add, extraShares, newShares, newCost, newAvg, breakEven, recoveryNeededPct, netAtTarget };
}

const SCENARIO_STEPS = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000];

/** A fixed capital-amount ladder (plus the user's own chosen amount,
 * inserted if not already a rung), scoped to roughly the user's chosen
 * capital so the table doesn't run pages past what's relevant. */
export function computeAveragingScenarios(
  capital: number,
  currentPrice: number,
  shares: number,
  avgCost: number,
  targetSellPrice: number,
  feePct: number,
  tick: number,
  calcFee: FeeCalculator,
): AveragingScenario[] {
  const ceiling = Math.max(capital, 250) * 1.2;
  const steps = new Set(SCENARIO_STEPS.filter((x) => x <= ceiling));
  if (capital > 0) steps.add(capital);
  return [...steps]
    .sort((a, b) => a - b)
    .map((add) => computeAveragingScenario(add, currentPrice, shares, avgCost, targetSellPrice, feePct, tick, calcFee))
    .filter((s): s is AveragingScenario => s !== null);
}

/** The scenario whose `add` is closest to the user's chosen capital. */
export function closestScenario(scenarios: AveragingScenario[], capital: number): AveragingScenario | null {
  if (!scenarios.length) return null;
  return scenarios.reduce((best, s) => (Math.abs(s.add - capital) < Math.abs(best.add - capital) ? s : best));
}

/** First scenario (walking up the capital ladder) where adding more only
 * improves the required recovery by less than `thresholdPp` percentage
 * points compared to the previous rung — a "further capital isn't
 * meaningfully helping anymore" signal, not a hard stop. */
export function findDiminishingReturnPoint(scenarios: AveragingScenario[], thresholdPp = 0.25): AveragingScenario | null {
  for (let i = 1; i < scenarios.length; i++) {
    const delta = scenarios[i - 1].recoveryNeededPct - scenarios[i].recoveryNeededPct;
    if (delta < thresholdPp) return scenarios[i];
  }
  return null;
}

export interface StressPoint {
  label: string;
  priceChangePct: number;
  pl: number;
}

const STRESS_DROPS: [string, number][] = [['Current', 0], ['-2%', -0.02], ['-5%', -0.05], ['-10%', -0.1], ['-15%', -0.15]];

/** P/L of the position resulting from `scenario` under a series of price
 * drops, ending with the user's own configured stress %. Uses the
 * scenario's own `newCost` (fee-inclusive) as the cost basis, not a
 * separately-recomputed approximation. */
export function stressTestScenario(
  scenario: AveragingScenario,
  currentPrice: number,
  stressPct: number,
  calcFee: FeeCalculator,
): StressPoint[] {
  const drops: [string, number][] = [...STRESS_DROPS, ['Stress', -Math.abs(stressPct) / 100]];
  return drops.map(([label, pct]) => {
    const price = currentPrice * (1 + pct);
    const value = scenario.newShares * price;
    const fee = calcFee(value, false, { shares: scenario.newShares });
    return { label, priceChangePct: pct * 100, pl: value - fee - scenario.newCost };
  });
}
