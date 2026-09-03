import { describe, expect, it } from 'vitest';
import { assignSerialNumbersForEntities, backfillSerialNumber, nextSerialNumber, nextSerialNumberForEntity } from '../financeSerial';

describe('nextSerialNumber', () => {
  it('returns 1 for an empty array', () => {
    expect(nextSerialNumber([])).toBe(1);
  });

  it('returns one more than the highest existing serialNumber', () => {
    expect(nextSerialNumber([{ serialNumber: 1 }, { serialNumber: 5 }, { serialNumber: 3 }])).toBe(6);
  });
});

describe('backfillSerialNumber', () => {
  it('leaves records untouched when every record already has a serialNumber', () => {
    const records = [{ id: 'a', serialNumber: 1 }, { id: 'b', serialNumber: 2 }];
    expect(backfillSerialNumber(records, records)).toBe(records);
  });

  it('assigns increasing serialNumber in chronological order, preserving original array order', () => {
    const c: { id: string; serialNumber?: number } = { id: 'c' };
    const a: { id: string; serialNumber?: number } = { id: 'a' };
    const b: { id: string; serialNumber?: number } = { id: 'b' };
    const result = backfillSerialNumber([c, a, b], [a, b, c]);
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    const byId = Object.fromEntries(result.map((r) => [r.id, r.serialNumber]));
    expect(byId.a).toBe(1);
    expect(byId.b).toBe(2);
    expect(byId.c).toBe(3);
  });
});

describe('nextSerialNumberForEntity', () => {
  it('numbers each entity (e.g. currency) independently of the whole array', () => {
    const existing = [
      { currencyCode: 'USD', serialNumber: 1 },
      { currencyCode: 'USD', serialNumber: 2 },
      { currencyCode: 'PKR', serialNumber: 1 },
      { currencyCode: 'PKR', serialNumber: 2 },
      { currencyCode: 'PKR', serialNumber: 3 },
    ];
    // Real user-reported scenario (2026-09-03): a currency with fewer
    // entries must not see gap-looking numbers just because a DIFFERENT
    // currency in the same workbook has more.
    expect(nextSerialNumberForEntity(existing, (r) => r.currencyCode, 'USD')).toBe(3);
    expect(nextSerialNumberForEntity(existing, (r) => r.currencyCode, 'PKR')).toBe(4);
  });
});

describe('assignSerialNumbersForEntities', () => {
  it('numbers a batch spanning multiple entities (e.g. bank accounts) independently, per entity', () => {
    const existing: { accountId: string; serialNumber?: number }[] = [{ accountId: 'acc1', serialNumber: 3 }];
    const batch: { accountId: string; serialNumber?: number }[] = [
      { accountId: 'acc1' },
      { accountId: 'acc2' },
      { accountId: 'acc1' },
    ];
    const result = assignSerialNumbersForEntities(existing, batch, (r) => r.accountId);
    expect(result.filter((r) => r.accountId === 'acc1').map((r) => r.serialNumber)).toEqual([4, 5]);
    expect(result.filter((r) => r.accountId === 'acc2').map((r) => r.serialNumber)).toEqual([1]);
  });
});
