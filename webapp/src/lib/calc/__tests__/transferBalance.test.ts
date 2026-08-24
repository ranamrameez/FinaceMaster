import { describe, expect, it } from 'vitest';
import { transferRunningBalance } from '../transferBalance';
import type { Transfer } from '../../../types/workbook';

const t = (over: Partial<Transfer>): Transfer => ({ id: crypto.randomUUID(), date: '2026-01-01', type: 'DEPOSIT', gross: 0, fee: 0, ...over });

describe('transferRunningBalance', () => {
  it('accumulates deposits net of fee', () => {
    const a = t({ date: '2026-01-01', type: 'DEPOSIT', gross: 1000, fee: 10 });
    const b = t({ date: '2026-01-05', type: 'DEPOSIT', gross: 500, fee: 5 });
    const balances = transferRunningBalance([a, b]);
    expect(balances.get(a.id)).toBe(990);
    expect(balances.get(b.id)).toBe(990 + 495);
  });

  it('subtracts withdrawal gross plus fee', () => {
    const a = t({ date: '2026-01-01', type: 'DEPOSIT', gross: 1000, fee: 0 });
    const b = t({ date: '2026-01-05', type: 'WITHDRAWAL', gross: 300, fee: 5 });
    const balances = transferRunningBalance([a, b]);
    expect(balances.get(a.id)).toBe(1000);
    expect(balances.get(b.id)).toBe(1000 - 305);
  });

  it('is independent of input array order — sorts by date first', () => {
    const early = t({ date: '2026-01-01', type: 'DEPOSIT', gross: 100, fee: 0 });
    const later = t({ date: '2026-01-10', type: 'DEPOSIT', gross: 50, fee: 0 });
    const balancesReversed = transferRunningBalance([later, early]);
    expect(balancesReversed.get(early.id)).toBe(100);
    expect(balancesReversed.get(later.id)).toBe(150);
  });

  it('keeps original entry order for same-day transfers (stable tie-break)', () => {
    const first = t({ date: '2026-01-01', type: 'DEPOSIT', gross: 100, fee: 0 });
    const second = t({ date: '2026-01-01', type: 'WITHDRAWAL', gross: 30, fee: 0 });
    const balances = transferRunningBalance([first, second]);
    expect(balances.get(first.id)).toBe(100);
    expect(balances.get(second.id)).toBe(70);
  });
});
