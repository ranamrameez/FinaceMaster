import { describe, expect, it } from 'vitest';
import { impliedFundNav } from '../fundsDailyHistoryImport';

describe('impliedFundNav', () => {
  it('divides balance by units held', () => {
    expect(impliedFundNav(1150, 100)).toBeCloseTo(11.5, 8);
  });

  it('returns null when no units are held yet', () => {
    expect(impliedFundNav(1150, 0)).toBeNull();
    expect(impliedFundNav(1150, -1)).toBeNull();
  });
});
