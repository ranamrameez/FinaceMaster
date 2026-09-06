import { describe, expect, it } from 'vitest';
import { projectedNetWorthTrend } from '../netWorthTrend';
import type { NetWorthAsOfInputs } from '../netWorthAsOf';
import type { EMILoan } from '../../../types/emiWorkbook';
import type { BudgetActivity } from '../budgetPlanner';
import type { QSESettings } from '../../../types/workbook';
import type { PSXSettings } from '../../../types/psxWorkbook';

// 0%-interest loan: 1200 total over 12 months, 100/month straight-line,
// starting 2026-01-01, due on the 1st of each month. Hand-traced schedule:
// month1 due 2026-02-01 balance 1100, month2 due 2026-03-01 balance 1000,
// month3 due 2026-04-01 balance 900, ...
const loan: EMILoan = {
  id: 'L1', name: 'Test loan', lender: 'Test Bank', currencyCode: 'USD', principal: 1200, totalToReturn: 1200,
  repaymentMode: 'fixedTotal', tenureMonths: 12, startDate: '2026-01-01', paymentDayOfMonth: 1,
};

function activity(partial: Partial<BudgetActivity>): BudgetActivity {
  return { id: 'a', module: 'cash', sourceLabel: 'Cash', date: '2026-01-01', amount: 0, currencyCode: 'USD', description: '', executed: false, ...partial };
}

const emptyNetWorthAsOfInputs: NetWorthAsOfInputs = {
  cashEntries: [], cashSettings: { defaultCurrency: 'USD' }, bankAccounts: [], bankTransactions: [],
  personalLoans: [], personalLoanRepayments: [], emiLoans: [],
  fundsFunds: [], fundsTransactions: [], fundsPriceHistory: {},
  qseTransactions: [], qseTransfers: [], qseAdjustments: [], qsePriceHistory: {},
  qseSettings: { feePct: 0.15, minFee: 5, tick: 0.01, currency: 'USD', depositFee: 0 } as QSESettings,
  psxTransactions: [], psxTransfers: [], psxAdjustments: [], psxPriceHistory: {},
  psxSettings: { feePct: 0.2, lowPriceThreshold: 25, lowPriceFee: 0.05, sstPct: 15, nccplFeePct: 0.0119, currency: 'PKR', costBasisMethod: 'average' } as PSXSettings,
};

describe('projectedNetWorthTrend', () => {
  it('projects a future month as today\'s net worth (assets - liabilities) + non-EMI flow + EMI outstanding delta + the loan\'s own scheduled cash outflow', () => {
    const nonEmiExpense = activity({ id: 'e1', date: '2026-04-10', amount: -50 });
    const emiLinkedPlan = activity({ id: 'e2', date: '2026-04-01', amount: -100, sourceEmiLoanId: 'L1' });

    const result = projectedNetWorthTrend({
      months: ['2026-04'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentRows: [{ currency: 'USD', assets: 500, liabilities: 1000, net: -500, breakdown: [] }],
      activities: [nonEmiExpense, emiLinkedPlan],
      emiLoans: [loan],
      netWorthAsOfInputs: emptyNetWorthAsOfInputs,
    });

    // As of today (2026-03-15): 2 installments due (02-01, 03-01) -> outstanding 1000.
    // As of end of April: 3 installments due (+04-01) -> outstanding 900. Delta = +100.
    // Non-EMI flow after today through April: -50 (the EMI-linked -100 plan is excluded,
    // per README Done item 231 — its cash effect is now accounted for directly from the
    // schedule below, not via this Budget Planner activity).
    // Scheduled EMI cash outflow strictly after 2026-03-15 through end of April: just the
    // one 04-01 installment (100) — 02-01/03-01 are both on or before "today."
    // Assets: 500 + (-50) - 100 = 350. Liabilities: 1000 - 1000 + 900 = 900. Net: 350 - 900 = -550.
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('2026-04');
    expect(result[0].assetsByCurrency.USD).toBeCloseTo(350, 6);
    expect(result[0].liabilitiesByCurrency.USD).toBeCloseTo(900, 6);
    expect(result[0].byCurrency.USD).toBeCloseTo(-550, 6);
  });

  it('README Done item 231 regression: an EMI loan with NO linked bank plan at all still reduces future assets by its own scheduled installment — not free money', () => {
    // Before this fix, a loan the user never ran "Link to bank" for had
    // NOTHING capture its future cash cost: liabilities correctly shrank
    // via the schedule, but assets never moved, so Net Worth looked like it
    // improved for free purely from the loan quietly amortizing.
    const result = projectedNetWorthTrend({
      months: ['2026-04'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentRows: [{ currency: 'USD', assets: 500, liabilities: 1000, net: -500, breakdown: [] }],
      activities: [], // no Budget Planner activity for this loan at all
      emiLoans: [loan],
      netWorthAsOfInputs: emptyNetWorthAsOfInputs,
    });
    // Assets: 500 - 100 (the 04-01 installment, straight from the schedule) = 400.
    // Liabilities: unchanged from the test above (900) — the schedule-based liability
    // delta doesn't depend on whether a plan was ever linked.
    expect(result[0].assetsByCurrency.USD).toBeCloseTo(400, 6);
    expect(result[0].liabilitiesByCurrency.USD).toBeCloseTo(900, 6);
    expect(result[0].byCurrency.USD).toBeCloseTo(-500, 6);
  });

  it('a linked plan\'s own flow and the schedule-based figure never double-count each other', () => {
    // Same loan, same window, but with a linked (not-yet-executed) plan
    // present for the SAME installment the schedule-based figure already
    // covers — the result must match the "no plan at all" case exactly
    // above, not be double-deducted.
    const emiLinkedPlan = activity({ id: 'e2', date: '2026-04-01', amount: -100, sourceEmiLoanId: 'L1' });
    const result = projectedNetWorthTrend({
      months: ['2026-04'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentRows: [{ currency: 'USD', assets: 500, liabilities: 1000, net: -500, breakdown: [] }],
      activities: [emiLinkedPlan],
      emiLoans: [loan],
      netWorthAsOfInputs: emptyNetWorthAsOfInputs,
    });
    expect(result[0].assetsByCurrency.USD).toBeCloseTo(400, 6);
    expect(result[0].byCurrency.USD).toBeCloseTo(-500, 6);
  });

  it('the current (in-progress) month uses today\'s already-known real figure directly, unchanged by future-only activity', () => {
    const result = projectedNetWorthTrend({
      months: ['2026-03'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentRows: [{ currency: 'USD', assets: 500, liabilities: 1000, net: -500, breakdown: [] }],
      activities: [],
      emiLoans: [loan],
      netWorthAsOfInputs: emptyNetWorthAsOfInputs,
    });
    expect(result).toEqual([{
      month: '2026-03',
      byCurrency: { USD: -500 },
      assetsByCurrency: { USD: 500 },
      liabilitiesByCurrency: { USD: 1000 },
    }]);
  });

  it('a fully past month is computed for real from actual transaction history, not a saved snapshot', () => {
    const inputs: NetWorthAsOfInputs = {
      ...emptyNetWorthAsOfInputs,
      cashEntries: [
        { id: 'c1', date: '2026-01-05', isDeposit: true, amount: 1000, currencyCode: 'USD', categoryID: 'x' },
        { id: 'c2', date: '2026-02-10', isDeposit: true, amount: 5000, currencyCode: 'USD', categoryID: 'x' }, // after Jan 31
      ] as never,
    };
    const result = projectedNetWorthTrend({
      months: ['2026-01'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentRows: [{ currency: 'USD', assets: 6000, liabilities: 0, net: 6000, breakdown: [] }],
      activities: [],
      emiLoans: [],
      netWorthAsOfInputs: inputs,
    });
    // As of 2026-01-31, only the Jan deposit had happened — real figure is 1000, not today's 6000.
    expect(result[0].assetsByCurrency.USD).toBeCloseTo(1000, 6);
    expect(result[0].byCurrency.USD).toBeCloseTo(1000, 6);
  });

  it('a currency with zero activity that far back is undefined, not zero', () => {
    const result = projectedNetWorthTrend({
      months: ['2026-01'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentRows: [{ currency: 'USD', assets: 500, liabilities: 0, net: 500, breakdown: [] }],
      activities: [],
      emiLoans: [],
      netWorthAsOfInputs: emptyNetWorthAsOfInputs,
    });
    expect(result[0].byCurrency.USD).toBeUndefined();
  });
});
