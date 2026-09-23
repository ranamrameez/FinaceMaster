import { describe, expect, it } from 'vitest';
import { presetDateRange } from '../dateRange';

describe('presetDateRange', () => {
  it('uses first through last day for This month', () => {
    expect(presetDateRange('1', '', '', new Date(2026, 8, 23, 12))).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
  });

  it('uses whole calendar months for wider presets', () => {
    expect(presetDateRange('3', '', '', new Date(2026, 8, 23, 12))).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    });
  });

  it('handles leap-year month ends', () => {
    expect(presetDateRange('1', '', '', new Date(2028, 1, 10, 12))).toEqual({
      startDate: '2028-02-01',
      endDate: '2028-02-29',
    });
  });
});
