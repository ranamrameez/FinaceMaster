import { beforeEach, describe, expect, it } from 'vitest';
import { resetAllLocalWorkbooks } from '../resetLocalData';
import { useBankWorkbookStore } from '../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../store/cashWorkbookStore';
import { useCategoryStore } from '../../store/categoryStore';
import { useEMIWorkbookStore } from '../../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../../store/fundsWorkbookStore';
import { useInterEntityTransfersStore } from '../../store/interEntityTransfersStore';
import { useNetWorthSnapshotsWorkbookStore } from '../../store/netWorthSnapshotsWorkbookStore';
import { usePersonalLoansWorkbookStore } from '../../store/personalLoansWorkbookStore';
import { usePlannedBankWorkbookStore } from '../../store/plannedBankWorkbookStore';
import { usePlannedCashWorkbookStore } from '../../store/plannedCashWorkbookStore';
import { usePlannedRentalsWorkbookStore } from '../../store/plannedRentalsWorkbookStore';
import { usePSXWorkbookStore } from '../../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../../store/rentalsWorkbookStore';
import { useSubscriptionsWorkbookStore } from '../../store/subscriptionsWorkbookStore';
import { useWorkbookStore } from '../../store/workbookStore';

beforeEach(() => {
  localStorage.clear();
});

describe('resetAllLocalWorkbooks', () => {
  it('clears every per-account module store, in memory and in localStorage', () => {
    // Seed every store with something that shouldn't survive a reset.
    useWorkbookStore.getState().addTransfer({ id: 'a', date: '2026-01-01', type: 'DEPOSIT', gross: 100, fee: 0 });
    usePSXWorkbookStore.getState().addTransfer({ id: 'b', date: '2026-01-01', type: 'DEPOSIT', gross: 100, fee: 0 });
    useCashWorkbookStore.getState().addEntry({ id: 'c', date: '2026-01-01', isDeposit: true, amount: 50, currencyCode: 'USD', source: 'manual' });
    useBankWorkbookStore.getState().addAccount({ id: 'd', name: 'Checking', currencyCode: 'USD', openingBalance: 0 });
    usePersonalLoansWorkbookStore.getState().addLoan({ id: 'e', person: 'Alex', direction: 'i_owe', currencyCode: 'USD', principal: 100, date: '2026-01-01' });
    useEMIWorkbookStore.getState().addEntry({
      id: 'f', name: 'Car', lender: 'Bank', currencyCode: 'USD', principal: 1000, tenureMonths: 12,
      startDate: '2026-01-01', repaymentMode: 'interest', annualRatePct: 5,
    });
    useFundsWorkbookStore.getState().setWorkbook({ ...useFundsWorkbookStore.getState().workbook, funds: [{ id: 'g', name: 'Index Fund', code: 'VT', platform: 'Fidelity', category: 'Equity', currencyCode: 'USD' }] });
    useRentalsWorkbookStore.getState().addProperty({ id: 'h', name: 'Apt', currencyCode: 'USD' });
    useInterEntityTransfersStore.getState().addEntry({
      id: 'i', date: '2026-01-01', fromAmount: 10, toAmount: 10,
      from: { module: 'cash' }, to: { module: 'bank', ref: 'd' }, fromRecordId: 'x', toRecordId: 'y',
    });
    // These four stores were added to the app after resetAllLocalWorkbooks
    // was originally written and were never wired into it — the exact bug
    // this function exists to prevent (see its own updated doc comment).
    useSubscriptionsWorkbookStore.getState().addEntry({
      id: 'j', name: 'Netflix', amount: 15, currencyCode: 'USD', billingCycle: 'monthly', startDate: '2026-01-01', active: true,
    });
    usePlannedCashWorkbookStore.getState().addEntry({ id: 'k', date: '2026-01-01', type: 'IN', amount: 100, currencyCode: 'USD' });
    usePlannedBankWorkbookStore.getState().addEntry({ id: 'l', accountId: 'd', date: '2026-01-01', description: 'Rent', amount: -100 });
    usePlannedRentalsWorkbookStore.getState().addEntry({ id: 'm', propertyId: 'h', date: '2026-01-01', type: 'RENT_INCOME', amount: 500 });
    useNetWorthSnapshotsWorkbookStore.getState().addEntry({ id: 'n', date: '2026-01-01', byCurrency: { USD: 1000 } });
    // Category registry (2026-09-03) — same "was this new store actually
    // wired into the reset" check as the four stores above.
    const seededCategoryCount = useCategoryStore.getState().workbook.categories.length;
    useCategoryStore.getState().addCategory('A Custom Category');

    expect(useWorkbookStore.getState().workbook.transfers).toHaveLength(1);
    expect(usePSXWorkbookStore.getState().workbook.transfers).toHaveLength(1);
    expect(useCashWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(useBankWorkbookStore.getState().workbook.settings.accounts).toHaveLength(1);
    expect(usePersonalLoansWorkbookStore.getState().workbook.loans).toHaveLength(1);
    expect(useEMIWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(useFundsWorkbookStore.getState().workbook.funds).toHaveLength(1);
    expect(useRentalsWorkbookStore.getState().workbook.settings.properties).toHaveLength(1);
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(1);
    expect(useSubscriptionsWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(usePlannedCashWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(usePlannedBankWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(usePlannedRentalsWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(useNetWorthSnapshotsWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(useCategoryStore.getState().workbook.categories).toHaveLength(seededCategoryCount + 1);

    resetAllLocalWorkbooks();

    expect(useWorkbookStore.getState().workbook.transfers).toHaveLength(0);
    expect(usePSXWorkbookStore.getState().workbook.transfers).toHaveLength(0);
    expect(useCashWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(useBankWorkbookStore.getState().workbook.settings.accounts).toHaveLength(0);
    expect(usePersonalLoansWorkbookStore.getState().workbook.loans).toHaveLength(0);
    expect(useEMIWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(useFundsWorkbookStore.getState().workbook.funds).toHaveLength(0);
    expect(useRentalsWorkbookStore.getState().workbook.settings.properties).toHaveLength(0);
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(0);
    expect(useSubscriptionsWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(usePlannedCashWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(usePlannedBankWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(usePlannedRentalsWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(useNetWorthSnapshotsWorkbookStore.getState().workbook.entries).toHaveLength(0);
    // Resets back to the bundled defaults, discarding the custom category.
    expect(useCategoryStore.getState().workbook.categories).toHaveLength(seededCategoryCount);

    // Persisted to localStorage too, not just in-memory — a page reload
    // right after logout must not bring the old data back.
    expect(localStorage.getItem('financerecorder_qse_workbook_v1')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('financerecorder_qse_workbook_v1')!).transfers).toHaveLength(0);
  });
});
