import { describe, expect, it } from 'vitest';
import { projectedNetWorthTrend } from '../netWorthTrend';
import type { EMILoan } from '../../../types/emiWorkbook';
import type { BudgetActivity } from '../budgetPlanner';
import type { NetWorthSnapshot } from '../../../types/netWorthSnapshot';

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

describe('projectedNetWorthTrend', () => {
  it('projects a future month as today\'s net worth + non-EMI flow + EMI outstanding delta', () => {
    const nonEmiExpense = activity({ id: 'e1', date: '2026-04-10', amount: -50 });
    const emiLinkedPlan = activity({ id: 'e2', date: '2026-04-01', amount: -100, sourceEmiLoanId: 'L1' });

    const result = projectedNetWorthTrend({
      months: ['2026-04'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentNetWorthByCurrency: { USD: -500 },
      activities: [nonEmiExpense, emiLinkedPlan],
      emiLoans: [loan],
      snapshots: [],
    });

    // As of today (2026-03-15): 2 installments due (02-01, 03-01) -> outstanding 1000.
    // As of end of April: 3 installments due (+04-01) -> outstanding 900. Delta = +100.
    // Non-EMI flow after today through April: -50 (the EMI-linked -100 plan is excluded).
    // Expected: -500 + (-50) + 100 = -450.
    expect(result).toEqual([{ month: '2026-04', byCurrency: { USD: -450 } }]);
  });

  it('leaves the current month unchanged when nothing happens between today and month-end', () => {
    const result = projectedNetWorthTrend({
      months: ['2026-03'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentNetWorthByCurrency: { USD: -500 },
      activities: [],
      emiLoans: [loan],
      snapshots: [],
    });
    expect(result).toEqual([{ month: '2026-03', byCurrency: { USD: -500 } }]);
  });

  it('reads a past month from the latest snapshot at or before it, undefined when none exists', () => {
    const snapshots: NetWorthSnapshot[] = [{ id: 's1', date: '2026-02-15', byCurrency: { USD: -600 } }];
    const result = projectedNetWorthTrend({
      months: ['2026-01', '2026-02'],
      currentMonth: '2026-03',
      todayISODate: '2026-03-15',
      currentNetWorthByCurrency: { USD: -500 },
      activities: [],
      emiLoans: [loan],
      snapshots,
    });
    expect(result).toEqual([
      { month: '2026-01', byCurrency: { USD: undefined } },
      { month: '2026-02', byCurrency: { USD: -600 } },
    ]);
  });
});
