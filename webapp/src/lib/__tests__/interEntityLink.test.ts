import { describe, expect, it } from 'vitest';
import { buildLinkedRecords, isSupportedLinkPair } from '../interEntityLink';
import type { InterEntityTransferInput } from '../../types/interEntityTransfer';

const ids = { linkId: 'link-1', fromRecordId: 'from-1', toRecordId: 'to-1' };

describe('buildLinkedRecords', () => {
  it('builds a Cash-out / Bank-in pair for a Cash -> Bank transfer', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-05',
      fromAmount: 250,
      toAmount: 250,
      from: { module: 'cash', currencyCode: 'USD' },
      to: { module: 'bank', ref: 'acct-1' },
      note: 'Deposited cash',
    };
    const { from, to, link } = buildLinkedRecords(input, ids);

    expect(from.module).toBe('cash');
    if (from.module === 'cash') {
      expect(from.record).toMatchObject({ id: 'from-1', type: 'OUT', amount: 250, currencyCode: 'USD', date: '2026-01-05' });
    }
    expect(to.module).toBe('bank');
    if (to.module === 'bank') {
      // Bank amounts are signed: money arriving is positive.
      expect(to.record).toMatchObject({ id: 'to-1', accountId: 'acct-1', amount: 250 });
    }
    expect(link).toMatchObject({ id: 'link-1', fromRecordId: 'from-1', toRecordId: 'to-1', fromAmount: 250, toAmount: 250 });
  });

  it('signs the Bank record negative when Bank is the `from` side', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-05',
      fromAmount: 100,
      toAmount: 100,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'cash', currencyCode: 'PKR' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('bank');
    if (from.module === 'bank') expect(from.record.amount).toBe(-100);
    expect(to.module).toBe('cash');
    if (to.module === 'cash') expect(to.record).toMatchObject({ type: 'IN', amount: 100, currencyCode: 'PKR' });
  });

  it('maps Bank -> QSE to a WITHDRAWAL/DEPOSIT pair with zero fee', () => {
    const input: InterEntityTransferInput = {
      date: '2026-02-01',
      fromAmount: 5000,
      toAmount: 5000,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'qse' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('bank');
    if (from.module === 'bank') expect(from.record.amount).toBe(-5000);
    expect(to.module).toBe('qse');
    if (to.module === 'qse') expect(to.record).toMatchObject({ type: 'DEPOSIT', gross: 5000, fee: 0 });
  });

  it('maps QSE -> Bank to a WITHDRAWAL on the QSE side', () => {
    const input: InterEntityTransferInput = {
      date: '2026-02-01',
      fromAmount: 1200,
      toAmount: 1200,
      from: { module: 'qse' },
      to: { module: 'bank', ref: 'acct-2' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('qse');
    if (from.module === 'qse') expect(from.record).toMatchObject({ type: 'WITHDRAWAL', gross: 1200 });
    expect(to.module).toBe('bank');
    if (to.module === 'bank') expect(to.record.amount).toBe(1200);
  });

  it('supports genuinely different amounts on each side for a cross-currency transfer', () => {
    // 500 USD converted to 1400 PKR at the user's real bank rate — no live
    // FX lookup, the user enters both sides from their own conversion.
    const input: InterEntityTransferInput = {
      date: '2026-03-01',
      fromAmount: 500,
      toAmount: 140000,
      from: { module: 'bank', ref: 'usd-acct' },
      to: { module: 'cash', currencyCode: 'PKR' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('bank');
    if (from.module === 'bank') expect(from.record.amount).toBe(-500);
    expect(to.module).toBe('cash');
    if (to.module === 'cash') expect(to.record).toMatchObject({ amount: 140000, currencyCode: 'PKR' });
  });

  // Rentals has no real balance of its own — RENT_INCOME/EXPENSE just
  // categorize what actually happened to the REAL (Bank/Cash) side, they
  // don't follow the generic from='out'/to='in' opposite-polarity
  // convention a transfer between two real money pools uses. Real rent
  // landing in Bank and the property's own income going up are the SAME
  // event, not money moving from one pool to another — so the two cases
  // below are keyed off what happens to Bank's balance, not off which side
  // is nominally "from" or "to". (README Done item 126 — this was inverted
  // before that fix, see the comment on the `rentals` case in
  // interEntityLink.ts for the full reasoning.)
  it('maps a real money transfer OUT of Bank (Bank -> Rentals) to an EXPENSE on the property side', () => {
    const input: InterEntityTransferInput = {
      date: '2026-04-01',
      fromAmount: 800,
      toAmount: 800,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'rentals', ref: 'prop-1' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('bank');
    if (from.module === 'bank') expect(from.record.amount).toBe(-800);
    expect(to.module).toBe('rentals');
    if (to.module === 'rentals') expect(to.record).toMatchObject({ propertyId: 'prop-1', type: 'EXPENSE', amount: 800 });
  });

  it('maps a real money transfer INTO Bank (Rentals -> Bank) to RENT_INCOME on the property side', () => {
    const input: InterEntityTransferInput = {
      date: '2026-04-05',
      fromAmount: 150,
      toAmount: 150,
      from: { module: 'rentals', ref: 'prop-1' },
      to: { module: 'bank', ref: 'acct-1' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('rentals');
    if (from.module === 'rentals') expect(from.record).toMatchObject({ propertyId: 'prop-1', type: 'RENT_INCOME', amount: 150 });
    expect(to.module).toBe('bank');
    if (to.module === 'bank') expect(to.record.amount).toBe(150);
  });

  it('throws for a Rentals side missing a property ref', () => {
    const input: InterEntityTransferInput = {
      date: '2026-04-01',
      fromAmount: 10,
      toAmount: 10,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'rentals' },
    };
    expect(() => buildLinkedRecords(input, ids)).toThrow();
  });

  it('maps Bank -> Personal Loans to a repayment against the chosen loan', () => {
    const input: InterEntityTransferInput = {
      date: '2026-05-01',
      fromAmount: 300,
      toAmount: 300,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'personalLoans', ref: 'loan-1' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('bank');
    if (from.module === 'bank') expect(from.record.amount).toBe(-300);
    expect(to.module).toBe('personalLoans');
    if (to.module === 'personalLoans') expect(to.record).toMatchObject({ loanId: 'loan-1', amount: 300, date: '2026-05-01' });
  });

  it('maps Personal Loans -> Cash to a repayment with the same positive amount, direction ignored', () => {
    // A repayment always logs a positive amount against the loan regardless
    // of which side of the link it's on or which way the debt runs.
    const input: InterEntityTransferInput = {
      date: '2026-05-02',
      fromAmount: 75,
      toAmount: 75,
      from: { module: 'personalLoans', ref: 'loan-2' },
      to: { module: 'cash', currencyCode: 'USD' },
    };
    const { from } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('personalLoans');
    if (from.module === 'personalLoans') expect(from.record).toMatchObject({ loanId: 'loan-2', amount: 75 });
  });

  it('throws for a Personal Loans side missing a loan ref', () => {
    const input: InterEntityTransferInput = {
      date: '2026-05-01',
      fromAmount: 10,
      toAmount: 10,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'personalLoans' },
    };
    expect(() => buildLinkedRecords(input, ids)).toThrow();
  });

  it('throws for a Bank side missing an account ref', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-01',
      fromAmount: 10,
      toAmount: 10,
      from: { module: 'cash' },
      to: { module: 'bank' },
    };
    expect(() => buildLinkedRecords(input, ids)).toThrow();
  });

  it('maps Bank -> EMI to a repayment against the chosen loan and month', () => {
    const input: InterEntityTransferInput = {
      date: '2026-07-01',
      fromAmount: 250,
      toAmount: 250,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'emi', ref: 'loan-1', emiMonth: 3 },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('bank');
    if (from.module === 'bank') expect(from.record.amount).toBe(-250);
    expect(to.module).toBe('emi');
    if (to.module === 'emi') expect(to.record).toMatchObject({ loanId: 'loan-1', month: 3, amount: 250, date: '2026-07-01' });
  });

  it('maps EMI -> Cash to a repayment with the same positive amount, direction ignored', () => {
    const input: InterEntityTransferInput = {
      date: '2026-07-02',
      fromAmount: 100,
      toAmount: 100,
      from: { module: 'emi', ref: 'loan-2', emiMonth: 5 },
      to: { module: 'cash', currencyCode: 'USD' },
    };
    const { from } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('emi');
    if (from.module === 'emi') expect(from.record).toMatchObject({ loanId: 'loan-2', month: 5, amount: 100 });
  });

  it('throws for an EMI side missing a loan ref', () => {
    const input: InterEntityTransferInput = {
      date: '2026-07-01',
      fromAmount: 10,
      toAmount: 10,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'emi', emiMonth: 1 },
    };
    expect(() => buildLinkedRecords(input, ids)).toThrow();
  });

  it('throws for an EMI side missing a resolved month', () => {
    const input: InterEntityTransferInput = {
      date: '2026-07-01',
      fromAmount: 10,
      toAmount: 10,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'emi', ref: 'loan-1' },
    };
    expect(() => buildLinkedRecords(input, ids)).toThrow();
  });

  it('maps Bank -> Funds to a WITHDRAWAL/DEPOSIT pair with zero fee, same as QSE/PSX', () => {
    const input: InterEntityTransferInput = {
      date: '2026-06-01',
      fromAmount: 2000,
      toAmount: 2000,
      from: { module: 'bank', ref: 'acct-1' },
      to: { module: 'funds' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('bank');
    if (from.module === 'bank') expect(from.record.amount).toBe(-2000);
    expect(to.module).toBe('funds');
    if (to.module === 'funds') expect(to.record).toMatchObject({ type: 'DEPOSIT', gross: 2000, fee: 0 });
  });

  it('maps Funds -> Cash to a WITHDRAWAL on the Funds side', () => {
    const input: InterEntityTransferInput = {
      date: '2026-06-02',
      fromAmount: 500,
      toAmount: 500,
      from: { module: 'funds' },
      to: { module: 'cash', currencyCode: 'USD' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('funds');
    if (from.module === 'funds') expect(from.record).toMatchObject({ type: 'WITHDRAWAL', gross: 500 });
    expect(to.module).toBe('cash');
    if (to.module === 'cash') expect(to.record).toMatchObject({ type: 'IN', amount: 500 });
  });

  it('reuses the same ids when recomputing for an edit', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-01',
      fromAmount: 10,
      toAmount: 10,
      from: { module: 'cash', currencyCode: 'USD' },
      to: { module: 'bank', ref: 'acct-1' },
    };
    const first = buildLinkedRecords(input, ids);
    const edited = buildLinkedRecords({ ...input, fromAmount: 99, toAmount: 99 }, ids);
    expect(first.link.id).toBe(edited.link.id);
    expect(first.from.record.id).toBe(edited.from.record.id);
    expect(edited.link.fromAmount).toBe(99);
  });
});

describe('isSupportedLinkPair', () => {
  it('accepts the v1 pairs', () => {
    expect(isSupportedLinkPair('cash', 'bank')).toBe(true);
    expect(isSupportedLinkPair('bank', 'cash')).toBe(true);
    expect(isSupportedLinkPair('bank', 'bank')).toBe(true);
    expect(isSupportedLinkPair('bank', 'qse')).toBe(true);
    expect(isSupportedLinkPair('qse', 'bank')).toBe(true);
    expect(isSupportedLinkPair('bank', 'psx')).toBe(true);
    expect(isSupportedLinkPair('psx', 'bank')).toBe(true);
    expect(isSupportedLinkPair('bank', 'rentals')).toBe(true);
    expect(isSupportedLinkPair('rentals', 'bank')).toBe(true);
    expect(isSupportedLinkPair('cash', 'rentals')).toBe(true);
    expect(isSupportedLinkPair('rentals', 'cash')).toBe(true);
    expect(isSupportedLinkPair('bank', 'personalLoans')).toBe(true);
    expect(isSupportedLinkPair('personalLoans', 'bank')).toBe(true);
    expect(isSupportedLinkPair('cash', 'personalLoans')).toBe(true);
    expect(isSupportedLinkPair('personalLoans', 'cash')).toBe(true);
    expect(isSupportedLinkPair('bank', 'funds')).toBe(true);
    expect(isSupportedLinkPair('funds', 'bank')).toBe(true);
    expect(isSupportedLinkPair('cash', 'funds')).toBe(true);
    expect(isSupportedLinkPair('funds', 'cash')).toBe(true);
    expect(isSupportedLinkPair('bank', 'emi')).toBe(true);
    expect(isSupportedLinkPair('emi', 'bank')).toBe(true);
    expect(isSupportedLinkPair('cash', 'emi')).toBe(true);
    expect(isSupportedLinkPair('emi', 'cash')).toBe(true);
  });

  it('rejects pairs outside v1 scope', () => {
    expect(isSupportedLinkPair('cash', 'qse')).toBe(false);
    expect(isSupportedLinkPair('qse', 'psx')).toBe(false);
    expect(isSupportedLinkPair('cash', 'cash')).toBe(false);
    expect(isSupportedLinkPair('qse', 'funds')).toBe(false);
    expect(isSupportedLinkPair('rentals', 'funds')).toBe(false);
  });
});
