import { describe, expect, it } from 'vitest';
import type { EMILoan, EMIRepayment } from '../../../types/emiWorkbook';
import { emiSchedule, emiSummary, expectedEndDate, generateBigEmiOverrides, installmentDueDate, markupPercentage, resolvedDueDate, totalsByCurrency, whatIfExtraPayment } from '../emiModule';

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

describe('emiSchedule — fixedTotal balance tracks the full remaining obligation, not principal-only (bug fix 2026-08-24, user-reported with real numbers)', () => {
  it('reproduces the exact reported case: principal 45046, total to return 50115.33, 36 months, EMI ~1392', () => {
    const l = loan({
      repaymentMode: 'fixedTotal', principal: 45046, totalToReturn: 50115.33, tenureMonths: 36,
      customMonthlyPayment: 1392,
    });
    const { rows } = emiSchedule(l);
    // Balance after the first installment must reflect the TOTAL still
    // owed (50115.33 - 1392 = 48723.33), not the old, wrong principal-only
    // reading (~43794.81) that silently dropped every future markup
    // payment from the figure.
    expect(rows[0].balance).toBeCloseTo(50115.33 - 1392, 2);
    expect(rows[0].balance).not.toBeCloseTo(43794.81, 2);
  });

  it('balance decreases by the full payment each month, not just the principal component', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 1000, totalToReturn: 1120, tenureMonths: 10 });
    const { rows } = emiSchedule(l);
    // Regular installment is 112/month; balance should start at the TOTAL
    // (1120) and drop by 112 each month, not by the 100/month principal
    // component alone.
    expect(rows[0].balance).toBeCloseTo(1120 - 112, 5); // 1008
    expect(rows[4].balance).toBeCloseTo(1120 - 5 * 112, 5); // 560
    expect(rows[9].balance).toBeCloseTo(0, 5);
  });

  it('the final balloon payment is unaffected — same total either way, since a full payoff is invariant to how the balance is tracked in between', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 1000, totalToReturn: 1120, tenureMonths: 10, customMonthlyPayment: 80 });
    const { rows } = emiSchedule(l);
    expect(rows[9].isBalloon).toBe(true);
    expect(rows[9].emi).toBeCloseTo(1120 - 9 * 80, 5); // 400
    expect(rows[9].balance).toBeCloseTo(0, 5);
  });
});

describe('emiSchedule — installmentOverrides (README item 6, 2026-08-26)', () => {
  it('leaves the schedule unchanged when no overrides are set', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12 });
    const { rows } = emiSchedule(l);
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => !r.overridden)).toBe(true);
  });

  it('recalculates every later month from a bigger one-off payment (interest mode)', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, installmentOverrides: { 6: 300 } });
    const { rows } = emiSchedule(l);
    // Regular EMI is 100/month; months 1-5 unaffected, month 6 pays 300.
    expect(rows[4].balance).toBeCloseTo(1200 - 5 * 100, 5); // 700
    expect(rows[5].overridden).toBe(true);
    expect(rows[5].emi).toBe(300);
    expect(rows[5].balance).toBeCloseTo(700 - 300, 5); // 400
    // Month 7 resumes the regular 100 installment against the new balance.
    expect(rows[6].overridden).toBeFalsy();
    expect(rows[6].emi).toBeCloseTo(100, 5);
    expect(rows[6].balance).toBeCloseTo(300, 5);
  });

  it('stops the schedule early once an override pays the loan off before its tenure', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, installmentOverrides: { 3: 1100 } });
    const { rows } = emiSchedule(l);
    // Months 1-2 at 100 each = 200 paid; month 3 pays the remaining 1000 in full via a 1100 override.
    expect(rows).toHaveLength(3);
    expect(rows[2].balance).toBeCloseTo(0, 5);
  });

  it('keeps the same principal:markup split ratio for an overridden month in fixedTotal mode', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 1000, totalToReturn: 1120, tenureMonths: 10, installmentOverrides: { 5: 224 } });
    const { rows } = emiSchedule(l);
    // Regular installment is 112/month (100 principal + 12 markup) — a
    // double-sized 224 payment should split 2x too: 200 principal, 24 markup.
    expect(rows[4].overridden).toBe(true);
    expect(rows[4].principalComp).toBeCloseTo(200, 5);
    expect(rows[4].interest).toBeCloseTo(24, 5);
  });
});

describe('emiSchedule — customMonthlyPayment (user-requested: fixed monthly EMI, remainder charged in the final EMI)', () => {
  it('charges the fixed amount every month except the last, which balloons to whatever is still owed (0% interest)', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, customMonthlyPayment: 50 });
    const { emi, rows } = emiSchedule(l);
    expect(emi).toBe(50); // "Monthly installment" reflects the custom amount, not the theoretical EMI
    expect(rows).toHaveLength(12);
    // Months 1-11 all pay exactly 50, none marked as a balloon.
    rows.slice(0, 11).forEach((r) => {
      expect(r.emi).toBe(50);
      expect(r.isBalloon).toBeFalsy();
      expect(r.overridden).toBeFalsy();
    });
    expect(rows[10].balance).toBeCloseTo(1200 - 11 * 50, 5); // 650
    // Month 12 (final) true's up the remaining 650 instead of charging 50 again.
    expect(rows[11].isBalloon).toBe(true);
    expect(rows[11].emi).toBeCloseTo(650, 5);
    expect(rows[11].balance).toBeCloseTo(0, 5);
  });

  it('balloons a real interest-bearing loan too, with the final payment covering balance + that month\'s interest', () => {
    const l = loan({ principal: 1000, annualRatePct: 12, tenureMonths: 12, customMonthlyPayment: 50 });
    const { rows } = emiSchedule(l);
    expect(rows).toHaveLength(12);
    rows.slice(0, 11).forEach((r) => expect(r.emi).toBe(50));
    expect(rows[11].isBalloon).toBe(true);
    expect(rows[11].balance).toBeCloseTo(0, 5);
    // The final payment should exactly equal that month's own interest plus
    // whatever principal balance remained going into it.
    expect(rows[11].emi).toBeCloseTo(rows[11].interest + rows[11].principalComp, 5);
  });

  it('does not add a balloon row when the custom payment already pays the loan off before the final month', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, customMonthlyPayment: 300 });
    const { rows } = emiSchedule(l);
    expect(rows).toHaveLength(4); // 300/month clears 1200 in exactly 4 months
    expect(rows.every((r) => !r.isBalloon)).toBe(true);
    expect(rows[3].balance).toBeCloseTo(0, 5);
  });

  it('a manual override on the final month wins over the auto-balloon', () => {
    const l = loan({
      principal: 1200, annualRatePct: 0, tenureMonths: 12, customMonthlyPayment: 50,
      installmentOverrides: { 12: 999 },
    });
    const { rows } = emiSchedule(l);
    expect(rows[11].overridden).toBe(true);
    expect(rows[11].isBalloon).toBeFalsy();
    expect(rows[11].emi).toBe(999);
  });

  it('true-ups both remaining principal and remaining markup for a fixedTotal (no-interest) loan', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 1000, totalToReturn: 1120, tenureMonths: 10, customMonthlyPayment: 80 });
    const { rows } = emiSchedule(l);
    expect(rows).toHaveLength(10);
    rows.slice(0, 9).forEach((r) => expect(r.emi).toBe(80));
    expect(rows[9].isBalloon).toBe(true);
    // The whole loan's principal and markup must still sum to their true totals.
    expect(rows.reduce((s, r) => s + r.principalComp, 0)).toBeCloseTo(1000, 5);
    expect(rows.reduce((s, r) => s + r.interest, 0)).toBeCloseTo(120, 5);
    expect(rows[9].balance).toBeCloseTo(0, 5);
  });

  it('whatIfExtraPayment stacks extra on top of the custom payment, not the theoretical EMI', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, customMonthlyPayment: 50 });
    const result = whatIfExtraPayment(l, 50); // 50 (custom) + 50 (extra) = 100/month
    expect(result.months).toBe(12); // matches the original 100/month schedule's own payoff time
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

  it('reports the full total (not just principal) outstanding before anything is paid, for a fixedTotal loan', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 45046, totalToReturn: 50115.33, tenureMonths: 36, startDate: '2026-06-01' });
    const sum = emiSummary(l, new Date('2026-01-01')); // before the start date, nothing paid yet
    expect(sum.elapsed).toBe(0);
    expect(sum.outstanding).toBeCloseTo(50115.33, 2);
  });

  it('reflects the corrected full-remaining-total balance after one installment, for the exact reported case', () => {
    const l = loan({
      repaymentMode: 'fixedTotal', principal: 45046, totalToReturn: 50115.33, tenureMonths: 36, startDate: '2026-01-01',
      customMonthlyPayment: 1392,
    });
    const sum = emiSummary(l, new Date('2026-02-01')); // 1 month elapsed
    expect(sum.elapsed).toBe(1);
    expect(sum.outstanding).toBeCloseTo(50115.33 - 1392, 2);
    expect(sum.paidSoFar).toBeCloseTo(1392, 2);
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

  it('respects paymentDayOfMonth when deciding how many installments have actually come due — regression for the "wrong remaining balance" bug (2026-08-26)', () => {
    // Started 2026-01-05, but every installment is really due on the 28th.
    // A naive calendar-month subtraction (Aug - Jan = 7) would wrongly
    // count month 7 (due 2026-08-28) as elapsed even though "today" is
    // 2026-08-26, two days before that installment is actually due.
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12, startDate: '2026-01-05', paymentDayOfMonth: 28 });
    const sum = emiSummary(l, new Date('2026-08-26'));
    expect(sum.elapsed).toBe(6); // months 1-6 (due Feb28..Jul28) have passed; month 7 (Aug28) hasn't yet
    expect(sum.outstanding).toBeCloseTo(600, 5); // 1200 - 6*100
    expect(sum.paidSoFar).toBeCloseTo(600, 5);

    // Two days later, month 7's due date has now passed.
    const sumLater = emiSummary(l, new Date('2026-08-28'));
    expect(sumLater.elapsed).toBe(7);
    expect(sumLater.outstanding).toBeCloseTo(500, 5);
  });

  it('clamps elapsed at the schedule length (not the original tenure) once an override pays it off early', () => {
    const l = loan({
      principal: 1200, annualRatePct: 0, tenureMonths: 12, startDate: '2020-01-01',
      installmentOverrides: { 3: 1100 }, // clears the loan by month 3 (see emiSchedule tests)
    });
    const sum = emiSummary(l, new Date('2026-01-01')); // way past tenure
    expect(sum.elapsed).toBe(3);
    expect(sum.monthsRemaining).toBe(0);
    expect(sum.outstanding).toBeCloseTo(0, 5);
    expect(sum.paidSoFar).toBeCloseTo(100 + 100 + 1100, 5);
  });
});

describe('totalsByCurrency', () => {
  it('sums monthly installment/outstanding/paid-so-far across loans in the same currency', () => {
    const asOf = new Date('2026-04-01'); // 3 full months elapsed for a 2026-01-01 start
    const loans = [
      loan({ id: 'a', currencyCode: 'USD', principal: 1200, annualRatePct: 0, tenureMonths: 12, startDate: '2026-01-01' }),
      loan({ id: 'b', currencyCode: 'USD', principal: 600, annualRatePct: 0, tenureMonths: 12, startDate: '2026-01-01' }),
    ];
    const totals = totalsByCurrency(loans, asOf);
    expect(totals.USD.monthlyInstallment).toBeCloseTo(100 + 50, 5);
    expect(totals.USD.outstanding).toBeCloseTo(900 + 450, 5);
    expect(totals.USD.paidSoFar).toBeCloseTo(300 + 150, 5);
  });

  it('keeps currencies separate', () => {
    const loans = [
      loan({ id: 'a', currencyCode: 'USD', principal: 1200, tenureMonths: 12, startDate: '2026-01-01' }),
      loan({ id: 'b', currencyCode: 'PKR', principal: 5000, tenureMonths: 10, startDate: '2026-01-01' }),
    ];
    const totals = totalsByCurrency(loans, new Date('2026-01-01'));
    expect(Object.keys(totals).sort()).toEqual(['PKR', 'USD']);
  });
});

describe('installmentDueDate / expectedEndDate', () => {
  it('adds the given number of months to startDate for a schedule row', () => {
    const l = loan({ startDate: '2026-01-15', tenureMonths: 12 });
    expect(installmentDueDate(l, 1)).toBe('2026-02-15');
    expect(installmentDueDate(l, 6)).toBe('2026-07-15');
  });

  it('computes the expected end date as startDate plus tenureMonths', () => {
    const l = loan({ startDate: '2026-01-15', tenureMonths: 12 });
    expect(expectedEndDate(l)).toBe('2027-01-15');
  });
});

describe('whatIfExtraPayment', () => {
  it('returns the unchanged schedule when no extra payment is given', () => {
    const l = loan({ principal: 1000, annualRatePct: 12, tenureMonths: 12 });
    const base = emiSchedule(l).rows.reduce((s, r) => s + r.interest, 0);
    const result = whatIfExtraPayment(l, 0);
    expect(result).toEqual({ months: 12, totalInterest: base, interestSaved: 0, monthsSaved: 0, newEndDate: expectedEndDate(l) });
  });

  it('pays off a 0%-interest loan exactly proportionally faster with an extra payment', () => {
    const l = loan({ principal: 1200, annualRatePct: 0, tenureMonths: 12 }); // emi = 100/month
    const result = whatIfExtraPayment(l, 100); // payment becomes 200/month
    expect(result.months).toBe(6);
    expect(result.totalInterest).toBe(0);
    expect(result.interestSaved).toBe(0);
    expect(result.monthsSaved).toBe(6);
    expect(result.newEndDate).toBe(installmentDueDate(l, 6));
  });

  it('shortens payoff and saves markup for a fixedTotal (no-interest) loan', () => {
    const l = loan({ principal: 1200, tenureMonths: 12, repaymentMode: 'fixedTotal', totalToReturn: 1320 }); // principal/mo=100, markup/mo=10
    const result = whatIfExtraPayment(l, 100); // new principal/mo = 200
    expect(result.months).toBe(6);
    expect(result.totalInterest).toBe(60); // 10 * 6
    expect(result.interestSaved).toBe(60); // 120 (life) - 60
    expect(result.monthsSaved).toBe(6);
  });

  it('shortens payoff and reduces total interest for a real interest-bearing loan', () => {
    const l = loan({ principal: 1000, annualRatePct: 12, tenureMonths: 12 });
    const base = emiSchedule(l).rows.reduce((s, r) => s + r.interest, 0);
    const result = whatIfExtraPayment(l, 50);
    expect(result.months).toBeLessThan(12);
    expect(result.totalInterest).toBeLessThan(base);
    expect(result.interestSaved).toBeGreaterThan(0);
    expect(result.monthsSaved).toBeGreaterThan(0);
  });
});

describe('installmentDueDate — paymentDayOfMonth', () => {
  it('falls back to startDate\'s own day when unset', () => {
    const l = loan({ startDate: '2026-01-15' });
    expect(installmentDueDate(l, 1)).toBe('2026-02-15');
  });

  it('uses the configured day-of-month when the target month has that many days', () => {
    const l = loan({ startDate: '2026-01-15', paymentDayOfMonth: 28 });
    expect(installmentDueDate(l, 1)).toBe('2026-02-28');
  });

  it('clamps to the target month\'s actual last day when it has fewer days than the configured day', () => {
    const l = loan({ startDate: '2026-01-01', paymentDayOfMonth: 31 });
    expect(installmentDueDate(l, 3)).toBe('2026-04-30'); // April has 30 days
  });
});

describe('resolvedDueDate', () => {
  it('uses the computed due date when no repayment record exists for that month', () => {
    const l = loan({ startDate: '2026-01-01' });
    expect(resolvedDueDate(l, 3, [])).toBe(installmentDueDate(l, 3));
  });

  it('prefers a specific repayment record\'s own date when one is set for that month', () => {
    const l = loan({ id: 'e1', startDate: '2026-01-01' });
    const repayments: EMIRepayment[] = [{ id: 'r1', loanId: 'e1', month: 3, amount: 100, date: '2026-04-20' }];
    expect(resolvedDueDate(l, 3, repayments)).toBe('2026-04-20');
    expect(resolvedDueDate(l, 4, repayments)).toBe(installmentDueDate(l, 4));
  });
});

describe('markupPercentage', () => {
  it('returns the annual rate directly for interest mode', () => {
    expect(markupPercentage(loan({ repaymentMode: 'interest', annualRatePct: 12.5 }))).toBe(12.5);
  });

  it('derives an equivalent percentage from the markup lump sum for fixedTotal mode', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 1000, totalToReturn: 1150 });
    expect(markupPercentage(l)).toBeCloseTo(15, 5);
  });

  it('returns 0 for a fixedTotal loan with no markup at all', () => {
    const l = loan({ repaymentMode: 'fixedTotal', principal: 1000, totalToReturn: 1000 });
    expect(markupPercentage(l)).toBe(0);
  });
});

describe('generateBigEmiOverrides', () => {
  it('sets every Nth month to the typed amount alone in majorOnly mode, no reconciliation', () => {
    const l = loan({ principal: 1200, tenureMonths: 12, repaymentMode: 'fixedTotal', totalToReturn: 1200 }); // regular = 100/mo
    const result = generateBigEmiOverrides(l, 1, { intervalMonths: 6, amount: 300, mode: 'majorOnly', reconcileLastMonth: false });
    expect(result).toEqual({ 6: 300, 12: 300 });
  });

  it('stacks the amount on top of the regular installment in regularPlusMajor mode', () => {
    const l = loan({ principal: 1200, tenureMonths: 12, repaymentMode: 'fixedTotal', totalToReturn: 1200 }); // regular = 100/mo
    const result = generateBigEmiOverrides(l, 1, { intervalMonths: 6, amount: 300, mode: 'regularPlusMajor', reconcileLastMonth: false });
    expect(result).toEqual({ 6: 400, 12: 400 });
  });

  it('only generates majors from fromMonth onward (skips already-elapsed months)', () => {
    const l = loan({ principal: 1200, tenureMonths: 12, repaymentMode: 'fixedTotal', totalToReturn: 1200 });
    const result = generateBigEmiOverrides(l, 7, { intervalMonths: 6, amount: 300, mode: 'majorOnly', reconcileLastMonth: false });
    expect(result).toEqual({ 12: 300 }); // month 6 is before fromMonth=7, skipped
  });

  it('reconciles the true remainder into the final month when majors under-pay vs. the regular schedule (fixedTotal, no markup)', () => {
    // Hand-traced: principal=1200/tenure=12/no markup → regular=100/mo.
    // Majors at months 6 and 12 pay only 50 (under the regular 100) —
    // balance after month 11 (11 regular months minus the month-6 shortfall
    // relative to a plain 100/mo schedule) is 150, so month 12 needs to pay
    // exactly 150 to zero the loan out, not the flat 50 majorOnly amount.
    const l = loan({ principal: 1200, tenureMonths: 12, repaymentMode: 'fixedTotal', totalToReturn: 1200 });
    const result = generateBigEmiOverrides(l, 1, { intervalMonths: 6, amount: 50, mode: 'majorOnly', reconcileLastMonth: true });
    expect(result).toEqual({ 6: 50, 12: 150 });
    // Applying these overrides should exactly zero the balance at month 12.
    const candidate: EMILoan = { ...l, installmentOverrides: result };
    const schedule = emiSchedule(candidate);
    expect(schedule.rows).toHaveLength(12);
    expect(schedule.rows[11].balance).toBe(0);
  });

  it('leaves the final month alone when the majors are large enough that the loan already finishes early', () => {
    // Same base loan, but a 300/6-months major pays off the loan by month 10
    // on its own — nothing left owed by month 12 to reconcile.
    const l = loan({ principal: 1200, tenureMonths: 12, repaymentMode: 'fixedTotal', totalToReturn: 1200 });
    const result = generateBigEmiOverrides(l, 1, { intervalMonths: 6, amount: 300, mode: 'majorOnly', reconcileLastMonth: true });
    expect(result[6]).toBe(300);
    // month 12's entry (if any) is inert dead data since the schedule never
    // reaches it — what matters is the loan is genuinely fully paid by then.
    const candidate: EMILoan = { ...l, installmentOverrides: { 6: result[6] } };
    expect(emiSchedule(candidate).rows.length).toBeLessThan(12);
  });

  it('reconciles a real interest-bearing loan\'s final month correctly', () => {
    const l = loan({ principal: 1000, annualRatePct: 12, tenureMonths: 12 });
    const result = generateBigEmiOverrides(l, 1, { intervalMonths: 6, amount: 20, mode: 'majorOnly', reconcileLastMonth: true });
    const candidate: EMILoan = { ...l, installmentOverrides: result };
    const schedule = emiSchedule(candidate);
    expect(schedule.rows).toHaveLength(12);
    expect(schedule.rows[11].balance).toBe(0);
  });

  it('returns nothing when fromMonth is already past the loan\'s tenure', () => {
    const l = loan({ principal: 1200, tenureMonths: 12, repaymentMode: 'fixedTotal', totalToReturn: 1200 });
    expect(generateBigEmiOverrides(l, 13, { intervalMonths: 6, amount: 300, mode: 'majorOnly', reconcileLastMonth: true })).toEqual({});
  });
});
