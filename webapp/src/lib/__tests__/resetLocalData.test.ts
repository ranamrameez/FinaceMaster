import { beforeEach, describe, expect, it } from 'vitest';
import { resetAllLocalWorkbooks } from '../resetLocalData';
import { useBankWorkbookStore } from '../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../store/cashWorkbookStore';
import { useEMIWorkbookStore } from '../../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../../store/fundsWorkbookStore';
import { useInterEntityTransfersStore } from '../../store/interEntityTransfersStore';
import { usePersonalLoansWorkbookStore } from '../../store/personalLoansWorkbookStore';
import { usePSXWorkbookStore } from '../../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../../store/rentalsWorkbookStore';
import { useWorkbookStore } from '../../store/workbookStore';

beforeEach(() => {
  localStorage.clear();
});

describe('resetAllLocalWorkbooks', () => {
  it('clears every per-account module store, in memory and in localStorage', () => {
    // Seed every store with something that shouldn't survive a reset.
    useWorkbookStore.getState().addTransfer({ id: 'a', date: '2026-01-01', type: 'DEPOSIT', gross: 100, fee: 0 });
    usePSXWorkbookStore.getState().addTransfer({ id: 'b', date: '2026-01-01', type: 'DEPOSIT', gross: 100, fee: 0 });
    useCashWorkbookStore.getState().addEntry({ id: 'c', date: '2026-01-01', type: 'IN', amount: 50, currencyCode: 'USD', source: 'manual' });
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

    expect(useWorkbookStore.getState().workbook.transfers).toHaveLength(1);
    expect(usePSXWorkbookStore.getState().workbook.transfers).toHaveLength(1);
    expect(useCashWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(useBankWorkbookStore.getState().workbook.settings.accounts).toHaveLength(1);
    expect(usePersonalLoansWorkbookStore.getState().workbook.loans).toHaveLength(1);
    expect(useEMIWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(useFundsWorkbookStore.getState().workbook.funds).toHaveLength(1);
    expect(useRentalsWorkbookStore.getState().workbook.settings.properties).toHaveLength(1);
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(1);

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

    // Persisted to localStorage too, not just in-memory — a page reload
    // right after logout must not bring the old data back.
    expect(localStorage.getItem('financerecorder_qse_workbook_v1')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('financerecorder_qse_workbook_v1')!).transfers).toHaveLength(0);
  });
});
