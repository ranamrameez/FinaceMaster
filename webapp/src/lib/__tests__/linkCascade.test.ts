import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLinkedTransfer,
  deleteLinkCascade,
  findLinkForRecord,
  updateLinkedTransfer,
} from '../linkCascade';
import { useBankWorkbookStore } from '../../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../../store/cashWorkbookStore';
import { createEmptyBankWorkbook } from '../../store/defaultBankWorkbook';
import { createEmptyCashWorkbook } from '../../store/defaultCashWorkbook';
import { createEmptyPersonalLoansWorkbook } from '../../store/defaultPersonalLoansWorkbook';
import { useInterEntityTransfersStore } from '../../store/interEntityTransfersStore';
import { usePersonalLoansWorkbookStore } from '../../store/personalLoansWorkbookStore';
import type { InterEntityTransferInput } from '../../types/interEntityTransfer';

const bankAccountId = 'acct-1';
const loanId = 'loan-1';

beforeEach(() => {
  localStorage.clear();
  useCashWorkbookStore.getState().setWorkbook(createEmptyCashWorkbook());
  useBankWorkbookStore.getState().setWorkbook({
    ...createEmptyBankWorkbook(),
    settings: { accounts: [{ id: bankAccountId, name: 'Checking', currencyCode: 'USD', openingBalance: 0 }] },
  });
  usePersonalLoansWorkbookStore.getState().setWorkbook({
    ...createEmptyPersonalLoansWorkbook(),
    loans: [{ id: loanId, person: 'Bilal', direction: 'i_owe', currencyCode: 'USD', principal: 1000, date: '2026-01-01' }],
  });
  useInterEntityTransfersStore.getState().setWorkbook({ settings: {}, entries: [] });
});

const cashToBankInput: InterEntityTransferInput = {
  date: '2026-01-01',
  fromAmount: 100,
  toAmount: 100,
  from: { module: 'cash', currencyCode: 'USD' },
  to: { module: 'bank', ref: bankAccountId },
};

describe('createLinkedTransfer', () => {
  it('writes a record to each module store and the link store', () => {
    const result = createLinkedTransfer(cashToBankInput);
    expect('link' in result).toBe(true);
    if (!('link' in result)) return;

    expect(useCashWorkbookStore.getState().workbook.entries).toHaveLength(1);
    expect(useCashWorkbookStore.getState().workbook.entries[0]).toMatchObject({ type: 'OUT', amount: 100 });
    expect(useBankWorkbookStore.getState().workbook.transactions).toHaveLength(1);
    expect(useBankWorkbookStore.getState().workbook.transactions[0]).toMatchObject({ accountId: bankAccountId, amount: 100 });
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(1);
    expect(useInterEntityTransfersStore.getState().workbook.entries[0].id).toBe(result.link.id);
  });

  it('rolls back the first side if the second side fails to build', () => {
    // A Bank side with no ref throws inside buildSideRecord — but that
    // happens before either dispatch here (buildLinkedRecords runs first),
    // so this just confirms no partial write happens when validation fails
    // upstream of the dispatches.
    const result = createLinkedTransfer({ ...cashToBankInput, to: { module: 'bank' } });
    expect('error' in result).toBe(true);
    expect(useCashWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(useBankWorkbookStore.getState().workbook.transactions).toHaveLength(0);
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(0);
  });

  it('rolls back BOTH side records if the link-store write fails after both succeed (Sourcery follow-up, PR #2)', () => {
    // The original fix only tracked `fromModule`, so a failure here — after
    // both `dispatchAdd` calls had already succeeded — rolled back the
    // `from` side but left the `to` side (the bank transaction) orphaned.
    const addEntrySpy = vi
      .spyOn(useInterEntityTransfersStore.getState(), 'addEntry')
      .mockImplementation(() => { throw new Error('simulated link-store write failure'); });

    const result = createLinkedTransfer(cashToBankInput);

    expect('error' in result).toBe(true);
    expect(useCashWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(useBankWorkbookStore.getState().workbook.transactions).toHaveLength(0);
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(0);

    addEntrySpy.mockRestore();
  });
});

describe('findLinkForRecord', () => {
  it('finds the link by either side\'s record id', () => {
    const result = createLinkedTransfer(cashToBankInput);
    if (!('link' in result)) throw new Error('expected success');
    expect(findLinkForRecord('cash', result.link.fromRecordId)?.id).toBe(result.link.id);
    expect(findLinkForRecord('bank', result.link.toRecordId)?.id).toBe(result.link.id);
    expect(findLinkForRecord('cash', 'nonexistent-id')).toBeUndefined();
  });
});

describe('updateLinkedTransfer', () => {
  it('updates both side records and the link record', () => {
    const created = createLinkedTransfer(cashToBankInput);
    if (!('link' in created)) throw new Error('expected success');

    const result = updateLinkedTransfer({ ...cashToBankInput, fromAmount: 250, toAmount: 250 }, created.link);
    expect('link' in result).toBe(true);
    if (!('link' in result)) return;

    expect(useCashWorkbookStore.getState().workbook.entries[0].amount).toBe(250);
    expect(useBankWorkbookStore.getState().workbook.transactions[0].amount).toBe(250);
    expect(useInterEntityTransfersStore.getState().workbook.entries[0].fromAmount).toBe(250);
  });
});

describe('deleteLinkCascade', () => {
  it('removes both side records and the link record', () => {
    const created = createLinkedTransfer(cashToBankInput);
    if (!('link' in created)) throw new Error('expected success');

    deleteLinkCascade(created.link);

    expect(useCashWorkbookStore.getState().workbook.entries).toHaveLength(0);
    expect(useBankWorkbookStore.getState().workbook.transactions).toHaveLength(0);
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(0);
  });
});

describe('Personal Loans as a linked module', () => {
  const bankToLoanInput: InterEntityTransferInput = {
    date: '2026-05-01',
    fromAmount: 200,
    toAmount: 200,
    from: { module: 'bank', ref: bankAccountId },
    to: { module: 'personalLoans', ref: loanId },
  };

  it('creates a repayment on the loan and a matching bank transaction', () => {
    const result = createLinkedTransfer(bankToLoanInput);
    expect('link' in result).toBe(true);
    if (!('link' in result)) return;

    expect(usePersonalLoansWorkbookStore.getState().workbook.repayments).toHaveLength(1);
    expect(usePersonalLoansWorkbookStore.getState().workbook.repayments[0]).toMatchObject({ loanId, amount: 200 });
    expect(useBankWorkbookStore.getState().workbook.transactions[0]).toMatchObject({ accountId: bankAccountId, amount: -200 });
  });

  it('cascades a delete to both the repayment and the bank transaction', () => {
    const created = createLinkedTransfer(bankToLoanInput);
    if (!('link' in created)) throw new Error('expected success');

    deleteLinkCascade(created.link);

    expect(usePersonalLoansWorkbookStore.getState().workbook.repayments).toHaveLength(0);
    expect(useBankWorkbookStore.getState().workbook.transactions).toHaveLength(0);
    expect(useInterEntityTransfersStore.getState().workbook.entries).toHaveLength(0);
  });
});
