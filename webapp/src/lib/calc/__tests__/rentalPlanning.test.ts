import { describe, expect, it } from 'vitest';
import type { Property } from '../../../types/rentalsWorkbook';
import { generateLeaseRentPlans, nextPendingBalance, proposeRentCollection } from '../rentalPlanning';

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

describe('proposeRentCollection', () => {
  it('returns null when the property has no collection cycle set', () => {
    expect(proposeRentCollection(property({ lastCollectionDate: '2026-01-01' }))).toBeNull();
  });

  it('returns null when there is no anchor date to compute from', () => {
    expect(proposeRentCollection(property({ collectionCycle: 'monthly' }))).toBeNull();
  });

  it('falls back to leaseStartDate as the anchor when lastCollectionDate is unset', () => {
    const p = property({ collectionCycle: 'monthly', leaseStartDate: '2026-01-01', monthlyRent: 1000 });
    const proposal = proposeRentCollection(p, new Date('2026-01-15'));
    expect(proposal).toEqual({ dueDate: '2026-02-01', amount: 1000, isDue: false });
  });

  it('advances one cycle from lastCollectionDate for each cadence', () => {
    const base = { monthlyRent: 500 };
    expect(proposeRentCollection(property({ ...base, collectionCycle: 'daily', lastCollectionDate: '2026-01-01' }), new Date('2026-01-01'))?.dueDate).toBe('2026-01-02');
    expect(proposeRentCollection(property({ ...base, collectionCycle: 'weekly', lastCollectionDate: '2026-01-01' }), new Date('2026-01-01'))?.dueDate).toBe('2026-01-08');
    expect(proposeRentCollection(property({ ...base, collectionCycle: 'monthly', lastCollectionDate: '2026-01-01' }), new Date('2026-01-01'))?.dueDate).toBe('2026-02-01');
    expect(proposeRentCollection(property({ ...base, collectionCycle: 'annual', lastCollectionDate: '2026-01-01' }), new Date('2026-01-01'))?.dueDate).toBe('2027-01-01');
  });

  it('flags a proposal as due once its date has arrived, not before', () => {
    const p = property({ collectionCycle: 'monthly', lastCollectionDate: '2026-01-01', monthlyRent: 1000 });
    expect(proposeRentCollection(p, new Date('2026-01-15'))?.isDue).toBe(false);
    expect(proposeRentCollection(p, new Date('2026-02-01'))?.isDue).toBe(true);
    expect(proposeRentCollection(p, new Date('2026-03-01'))?.isDue).toBe(true);
  });

  it('adds a carried-forward pendingRentBalance on top of monthlyRent', () => {
    const p = property({ collectionCycle: 'monthly', lastCollectionDate: '2026-01-01', monthlyRent: 1000, pendingRentBalance: 250 });
    expect(proposeRentCollection(p, new Date('2026-02-01'))?.amount).toBe(1250);
  });
});

describe('nextPendingBalance', () => {
  it('is zero when the full expected amount is paid', () => {
    expect(nextPendingBalance(1000, 1000)).toBe(0);
  });

  it('carries the shortfall forward on a partial payment', () => {
    expect(nextPendingBalance(1000, 700)).toBe(300);
  });

  it('never goes negative on an overpayment', () => {
    expect(nextPendingBalance(1000, 1200)).toBe(0);
  });
});
