import { describe, expect, it } from 'vitest';
import { stripUndefinedDeep } from '../useWorkbookCloudSync';

describe('stripUndefinedDeep', () => {
  it('removes an undefined property instead of leaving it as literal undefined', () => {
    // Real bug: PersonalLoansPage.tsx's AddLoanForm sets `note: undefined`
    // for a loan added without a note. Firebase's set() throws
    // synchronously on any literal `undefined` in the value tree, which is
    // exactly what broke Personal Loans cloud sync.
    const loan = { id: 'l1', person: 'Bilal', note: undefined as string | undefined };
    const cleaned = stripUndefinedDeep(loan);
    expect('note' in cleaned).toBe(false);
    expect(cleaned).toEqual({ id: 'l1', person: 'Bilal' });
  });

  it('strips undefined at any nesting depth, including inside arrays', () => {
    const workbook = {
      settings: { defaultCurrency: 'USD' },
      loans: [
        { id: 'l1', person: 'Bilal', note: undefined as string | undefined },
        { id: 'l2', person: 'Ahmed', note: 'Real note' },
      ],
    };
    const cleaned = stripUndefinedDeep(workbook);
    expect(cleaned.loans[0]).toEqual({ id: 'l1', person: 'Bilal' });
    expect(cleaned.loans[1]).toEqual({ id: 'l2', person: 'Ahmed', note: 'Real note' });
  });

  it('leaves ordinary values (including null and zero) intact', () => {
    const value = { a: 1, b: 0, c: null, d: 'text', e: false };
    expect(stripUndefinedDeep(value)).toEqual(value);
  });
});
