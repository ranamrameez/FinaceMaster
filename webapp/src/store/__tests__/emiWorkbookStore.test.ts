import { beforeEach, describe, expect, it } from 'vitest';
import { useEMIWorkbookStore } from '../emiWorkbookStore';
import { createEmptyEMIWorkbook } from '../defaultEmiWorkbook';
import type { EMILoan } from '../../types/emiWorkbook';

const loan: EMILoan = {
  id: 'loan-1',
  name: 'Car Financing',
  lender: 'Bank X',
  currencyCode: 'USD',
  principal: 1200,
  tenureMonths: 12,
  startDate: '2026-01-01',
  repaymentMode: 'interest',
  annualRatePct: 0,
};

describe('emiWorkbookStore repayment/override sync', () => {
  beforeEach(() => {
    useEMIWorkbookStore.getState().setWorkbook(createEmptyEMIWorkbook(), { skipPersist: true });
    useEMIWorkbookStore.getState().addEntry(loan);
  });

  it('addRepayment sets a matching installmentOverrides entry', () => {
    useEMIWorkbookStore.getState().addRepayment({ id: 'r1', loanId: 'loan-1', month: 3, amount: 150, date: '2026-04-01' });
    const wb = useEMIWorkbookStore.getState().workbook;
    expect(wb.repayments).toHaveLength(1);
    expect(wb.entries[0].installmentOverrides).toMatchObject({ 3: 150 });
  });

  it('updateRepayment moves the override when the month changes', () => {
    useEMIWorkbookStore.getState().addRepayment({ id: 'r1', loanId: 'loan-1', month: 3, amount: 150, date: '2026-04-01' });
    useEMIWorkbookStore.getState().updateRepayment('r1', { month: 5, amount: 200 });
    const wb = useEMIWorkbookStore.getState().workbook;
    expect(wb.entries[0].installmentOverrides?.[3]).toBeUndefined();
    expect(wb.entries[0].installmentOverrides).toMatchObject({ 5: 200 });
    expect(wb.repayments[0]).toMatchObject({ month: 5, amount: 200 });
  });

  it('deleteRepayment clears the matching override', () => {
    useEMIWorkbookStore.getState().addRepayment({ id: 'r1', loanId: 'loan-1', month: 3, amount: 150, date: '2026-04-01' });
    useEMIWorkbookStore.getState().deleteRepayment('r1');
    const wb = useEMIWorkbookStore.getState().workbook;
    expect(wb.repayments).toHaveLength(0);
    expect(wb.entries[0].installmentOverrides?.[3]).toBeUndefined();
  });

  it('deleteEntry (delete loan) cascades to its own repayments', () => {
    useEMIWorkbookStore.getState().addRepayment({ id: 'r1', loanId: 'loan-1', month: 3, amount: 150, date: '2026-04-01' });
    useEMIWorkbookStore.getState().deleteEntry('loan-1');
    const wb = useEMIWorkbookStore.getState().workbook;
    expect(wb.entries).toHaveLength(0);
    expect(wb.repayments).toHaveLength(0);
  });
});
