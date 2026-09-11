import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmDialog } from '../../components/ConfirmDialog';
import {
  createLinkedTransfer,
  deleteLinkCascade,
  findLinkForRecord,
  propagateLinkedEdit,
  resolveLinkedEdit,
  updateLinkedTransfer,
  warnIfLinked,
} from '../linkCascade';

vi.mock('../../components/ConfirmDialog', () => ({ confirmDialog: vi.fn() }));
vi.mock('../../components/LinkedEditChoiceDialog', () => ({ linkedEditChoiceDialog: vi.fn() }));
import { linkedEditChoiceDialog } from '../../components/LinkedEditChoiceDialog';
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
    expect(useCashWorkbookStore.getState().workbook.entries[0]).toMatchObject({ isDeposit: false, amount: 100 });
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

describe('warnIfLinked', () => {
  it('resolves true without prompting when the record is not part of any link', async () => {
    const mockedConfirm = vi.mocked(confirmDialog);
    mockedConfirm.mockClear();
    await expect(warnIfLinked('cash', 'not-a-real-id')).resolves.toBe(true);
    expect(mockedConfirm).not.toHaveBeenCalled();
  });

  it('prompts and returns the user\'s choice when the record is linked', async () => {
    const created = createLinkedTransfer(cashToBankInput);
    if (!('link' in created)) throw new Error('expected success');

    const mockedConfirm = vi.mocked(confirmDialog);
    mockedConfirm.mockResolvedValueOnce(false);
    await expect(warnIfLinked('cash', created.link.fromRecordId)).resolves.toBe(false);
    expect(mockedConfirm).toHaveBeenCalledTimes(1);
    expect(mockedConfirm.mock.calls[0][0]).toContain('Banking');

    mockedConfirm.mockResolvedValueOnce(true);
    await expect(warnIfLinked('bank', created.link.toRecordId)).resolves.toBe(true);
  });
});

// User-reported (2026-09-11): the old confirm-dialog gate (`warnIfLinked`,
// above) told the user to "use the Transfers page instead for a
// fully-synced edit" — a page that no longer exists (README Done item
// 216). `resolveLinkedEdit`/`propagateLinkedEdit` replace that for every
// single-record edit flow with a real three-way choice that can actually
// deliver the fully-synced edit right there.
describe('resolveLinkedEdit', () => {
  it("resolves 'this' without prompting when the record is not part of any link", async () => {
    const mockedDialog = vi.mocked(linkedEditChoiceDialog);
    mockedDialog.mockClear();
    await expect(resolveLinkedEdit('cash', 'not-a-real-id')).resolves.toBe('this');
    expect(mockedDialog).not.toHaveBeenCalled();
  });

  it('prompts with the OTHER side\'s module label and returns the dialog\'s choice when linked', async () => {
    const created = createLinkedTransfer(cashToBankInput);
    if (!('link' in created)) throw new Error('expected success');

    const mockedDialog = vi.mocked(linkedEditChoiceDialog);
    mockedDialog.mockResolvedValueOnce('both');
    await expect(resolveLinkedEdit('cash', created.link.fromRecordId)).resolves.toBe('both');
    expect(mockedDialog).toHaveBeenCalledWith('Banking');

    mockedDialog.mockResolvedValueOnce('cancel');
    await expect(resolveLinkedEdit('bank', created.link.toRecordId)).resolves.toBe('cancel');
    expect(mockedDialog).toHaveBeenCalledWith('Cash');
  });
});

describe('propagateLinkedEdit', () => {
  it('is a no-op when the record is not linked', () => {
    expect(propagateLinkedEdit('cash', 'not-a-real-id', { amount: 999 })).toEqual({});
  });

  it('mirrors a new amount onto BOTH sides when they share a currency, without touching the edited side a second time', () => {
    const created = createLinkedTransfer(cashToBankInput);
    if (!('link' in created)) throw new Error('expected success');

    // Simulate the native module already having saved this side's own
    // record with a value `propagateLinkedEdit` should never see or touch
    // (a `note` it doesn't take as a `changes` field here) — proves the
    // function only re-dispatches the OTHER side.
    useCashWorkbookStore.getState().updateEntry(created.link.fromRecordId, { amount: 250, note: 'set by the native edit form' });

    const result = propagateLinkedEdit('cash', created.link.fromRecordId, { date: '2026-02-01', amount: 250 });
    expect(result.error).toBeUndefined();
    expect(result.message).toBeUndefined();

    expect(useCashWorkbookStore.getState().workbook.entries[0].note).toBe('set by the native edit form');
    expect(useBankWorkbookStore.getState().workbook.transactions[0].amount).toBe(250);
    expect(useBankWorkbookStore.getState().workbook.transactions[0].date).toBe('2026-02-01');
    expect(useInterEntityTransfersStore.getState().workbook.entries[0]).toMatchObject({ fromAmount: 250, toAmount: 250, date: '2026-02-01' });
  });

  it('leaves the other side\'s own amount untouched when the currencies differ, and says so', () => {
    useBankWorkbookStore.getState().setWorkbook({
      ...useBankWorkbookStore.getState().workbook,
      settings: { accounts: [{ id: bankAccountId, name: 'Checking', currencyCode: 'PKR', openingBalance: 0 }] },
    });
    const created = createLinkedTransfer(cashToBankInput); // cash is USD, bank is now PKR
    if (!('link' in created)) throw new Error('expected success');

    const result = propagateLinkedEdit('cash', created.link.fromRecordId, { amount: 250 });
    expect(result.error).toBeUndefined();
    expect(result.message).toMatch(/currency differs/i);

    expect(useBankWorkbookStore.getState().workbook.transactions[0].amount).toBe(100); // unchanged
    const link = useInterEntityTransfersStore.getState().workbook.entries[0];
    expect(link.fromAmount).toBe(250); // the edited side's own link figure still updates
    expect(link.toAmount).toBe(100); // the other side's is left alone
  });

  it('propagates the date/note even when amount is not being changed', () => {
    const created = createLinkedTransfer(cashToBankInput);
    if (!('link' in created)) throw new Error('expected success');

    propagateLinkedEdit('cash', created.link.fromRecordId, { date: '2026-03-15', note: 'renamed' });

    expect(useBankWorkbookStore.getState().workbook.transactions[0].date).toBe('2026-03-15');
    expect(useBankWorkbookStore.getState().workbook.transactions[0].amount).toBe(100); // unchanged
    expect(useInterEntityTransfersStore.getState().workbook.entries[0].note).toBe('renamed');
  });
});
