import { describe, expect, it } from 'vitest';
import { buildLinkedRecords, isSupportedLinkPair } from '../interEntityLink';
import type { InterEntityTransferInput } from '../../types/interEntityTransfer';

const ids = { linkId: 'link-1', fromRecordId: 'from-1', toRecordId: 'to-1' };

describe('buildLinkedRecords', () => {
  it('builds a Cash-out / Bank-in pair for a Cash -> Bank transfer', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-05',
      amount: 250,
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
    expect(link).toMatchObject({ id: 'link-1', fromRecordId: 'from-1', toRecordId: 'to-1', amount: 250 });
  });

  it('signs the Bank record negative when Bank is the `from` side', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-05',
      amount: 100,
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
      amount: 5000,
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
      amount: 1200,
      from: { module: 'qse' },
      to: { module: 'bank', ref: 'acct-2' },
    };
    const { from, to } = buildLinkedRecords(input, ids);
    expect(from.module).toBe('qse');
    if (from.module === 'qse') expect(from.record).toMatchObject({ type: 'WITHDRAWAL', gross: 1200 });
    expect(to.module).toBe('bank');
    if (to.module === 'bank') expect(to.record.amount).toBe(1200);
  });

  it('throws for a Bank side missing an account ref', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-01',
      amount: 10,
      from: { module: 'cash' },
      to: { module: 'bank' },
    };
    expect(() => buildLinkedRecords(input, ids)).toThrow();
  });

  it('reuses the same ids when recomputing for an edit', () => {
    const input: InterEntityTransferInput = {
      date: '2026-01-01',
      amount: 10,
      from: { module: 'cash', currencyCode: 'USD' },
      to: { module: 'bank', ref: 'acct-1' },
    };
    const first = buildLinkedRecords(input, ids);
    const edited = buildLinkedRecords({ ...input, amount: 99 }, ids);
    expect(first.link.id).toBe(edited.link.id);
    expect(first.from.record.id).toBe(edited.from.record.id);
    expect(edited.link.amount).toBe(99);
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
  });

  it('rejects pairs outside v1 scope', () => {
    expect(isSupportedLinkPair('cash', 'qse')).toBe(false);
    expect(isSupportedLinkPair('qse', 'psx')).toBe(false);
    expect(isSupportedLinkPair('cash', 'cash')).toBe(false);
  });
});
