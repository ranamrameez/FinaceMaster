import { describe, expect, it } from 'vitest';
import type { Property } from '../../../types/rentalsWorkbook';
import { generateLeaseRentPlans } from '../rentalPlanning';

const property = (over: Partial<Property>): Property => ({
  id: 'p1',
  name: 'Apartment 4B',
  currencyCode: 'USD',
  ...over,
});

describe('generateLeaseRentPlans', () => {
  it('returns nothing when lease info is incomplete', () => {
    expect(generateLeaseRentPlans(property({}))).toEqual([]);
    expect(generateLeaseRentPlans(property({ monthlyRent: 1000 }))).toEqual([]);
    expect(generateLeaseRentPlans(property({ monthlyRent: 1000, cycleStartDay: 1 }))).toEqual([]);
  });

  it('generates one plan per month from the lease start through its end date', () => {
    const p = property({ monthlyRent: 1000, cycleStartDay: 5, leaseStartDate: '2026-01-01', leaseEndDate: '2026-03-31' });
    const today = new Date('2026-01-01');
    const plans = generateLeaseRentPlans(p, today);
    expect(plans.map((pl) => pl.date)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
    expect(plans.every((pl) => pl.amount === 1000 && pl.type === 'RENT_INCOME' && !pl.executed)).toBe(true);
    expect(plans.every((pl) => pl.sourceLeasePropertyId === 'p1')).toBe(true);
  });

  it('caps an open-ended lease at a 12-month horizon from today', () => {
    const p = property({ monthlyRent: 500, cycleStartDay: 1, leaseStartDate: '2020-01-01' });
    const today = new Date('2026-01-01');
    const plans = generateLeaseRentPlans(p, today);
    expect(plans).toHaveLength(12);
    expect(plans[0].date).toBe('2026-01-01');
    expect(plans[11].date).toBe('2026-12-01');
  });

  it('clamps a cycle day past a short month to that month\'s last day', () => {
    const p = property({ monthlyRent: 500, cycleStartDay: 31, leaseStartDate: '2026-01-01', leaseEndDate: '2026-02-28' });
    const today = new Date('2026-01-01');
    const plans = generateLeaseRentPlans(p, today);
    expect(plans.map((pl) => pl.date)).toEqual(['2026-01-31', '2026-02-28']);
  });

  it('starts from today, not the lease start, when the lease already began', () => {
    const p = property({ monthlyRent: 500, cycleStartDay: 1, leaseStartDate: '2025-01-01', leaseEndDate: '2026-03-31' });
    const today = new Date('2026-01-15');
    const plans = generateLeaseRentPlans(p, today);
    expect(plans.map((pl) => pl.date)).toEqual(['2026-02-01', '2026-03-01']);
  });
});
