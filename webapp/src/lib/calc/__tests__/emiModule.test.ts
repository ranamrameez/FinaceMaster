import { describe, expect, it } from 'vitest';
import type { EMILoan } from '../../../types/emiWorkbook';
import { emiSchedule, emiSummary } from '../emiModule';

const loan = (over: Partial<EMILoan>): EMILoan => ({
  id: 'e1',
  name: 'Test Loan',
  lender: 'Test Bank',
  currencyCode: 'USD',
  principal: 1000,
  tenureMonths: 12,
  startDate: '2026-01-01',
  repaymentMode: 'interest',
  annualRatePct: 12,
  ...over,
});

describe('emiSchedule — interest mode', () => {
  it('produces a standard reducing-balance EMI that fully amortizes to ~0 by the last month', () => {
    const l = loan({ principal: 1000, annualRatePct: 12, tenureMonths: 12 });
    const { emi, rows } = emiSchedule(l);
    expect(rows).toHaveLength(12);
    expect(emi).toBeGreaterThan(0);
    // Reducing-balance EMI: last row's balance should be ~0 (fully paid off).
    expect(rows[11].balance).toBeCloseTo(0, 2);
    // Each month's principal component should increase as interest shrinks.
    expect(rows[11].principalComp).toBeGreaterThan(rows[0].principalComp);
    expect(rows[0].interest).toBeGreaterThan(rows[11].interest);
  });

  it('handles a 0% rate as a straight-line principal/tenure split', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12 });
    const { emi, rows } = emiSchedule(l);
    expect(emi).toBeCloseTo(100, 5);
    expect(rows.every((r) => r.interest === 0)).toBe(true);
    expect(rows[11].balance).toBeCloseTo(0, 5);
  });
});

describe('emiSchedule — fixedTotal mode (no-interest/Sharia)', () => {
  it('spreads principal straight-line and markup evenly, no compounding', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 1000, totalToReturn: 1120, tenureMonths: 10 });
    const { emi, rows } = emiSchedule(l);
    expect(emi).toBeCloseTo(112, 5); // 1120/10
    expect(rows[0].principalComp).toBeCloseTo(100, 5); // 1000/10
    expect(rows[0].interest).toBeCloseTo(12, 5); // (1120-1000)/10
    // Markup is flat across months (no compounding), unlike interest mode.
    expect(rows[5].interest).toBeCloseTo(rows[0].interest, 5);
    expect(rows[9].balance).toBeCloseTo(0, 5);
  });
});

describe('emiSummary', () => {
  it('reports full principal outstanding and zero elapsed before the start date', () => {
    const l = loan({ principal: 1000, startDate: '2026-06-01' });
    const sum = emiSummary(l, new Date('2026-01-01'));
    expect(sum.elapsed).toBe(0);
    expect(sum.outstanding).toBe(1000);
    expect(sum.paidSoFar).toBe(0);
  });

  it('reads outstanding/paid-so-far off the schedule at the elapsed-months row', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, startDate: '2026-01-01' });
    const sum = emiSummary(l, new Date('2026-04-01')); // 3 full months elapsed
    expect(sum.elapsed).toBe(3);
    expect(sum.outstanding).toBeCloseTo(900, 5); // 1200 - 3*100
    expect(sum.paidSoFar).toBeCloseTo(300, 5);
  });

  it('clamps elapsed at the loan tenure once fully repaid', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, startDate: '2020-01-01' });
    const sum = emiSummary(l, new Date('2026-01-01')); // way past tenure
    expect(sum.elapsed).toBe(12);
    expect(sum.monthsRemaining).toBe(0);
    expect(sum.outstanding).toBeCloseTo(0, 5);
  });
});
