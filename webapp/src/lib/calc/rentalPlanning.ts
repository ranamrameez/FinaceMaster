import type { Property } from '../../types/rentalsWorkbook';
import type { PlannedRentalEntry } from '../../types/plannedRentals';

const MAX_HORIZON_MONTHS = 12;

/** One step forward from `date` by the given cadence. Calendar month/year
 * steps use `Date`'s own rollover (no day-of-month clamping like the lease
 * generator's `cycleDate` needs) since this advances from a real anchor
 * date, not a fixed target day-of-month. */
function advanceByCycle(date: Date, cycle: NonNullable<Property['collectionCycle']>): Date {
  const d = new Date(date);
  switch (cycle) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'annual':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

export interface RentCollectionProposal {
  dueDate: string;
  /** `monthlyRent` plus any carried-forward `pendingRentBalance` — a
   * partial payment last cycle rolls its shortfall into this one. */
  amount: number;
  /** True once `dueDate` has arrived (today or earlier) — the UI's cue
   * that this collection is actually ready to propose, not just upcoming. */
  isDue: boolean;
}

/** Semi-automated rent collection (README item 61) — a separate, simpler
 * mechanism from `generateLeaseRentPlans` above: rather than bulk-projecting
 * a whole lease's cycles up front, this proposes just the ONE next-due
 * collection from a cycle + an anchor date, for the user to approve (and
 * adjust the date/amount of) one at a time — never auto-creates anything
 * itself. Returns `null` when the property hasn't opted in (no
 * `collectionCycle` set) or has no anchor to compute from yet (neither
 * `lastCollectionDate` nor `leaseStartDate`). The anchor is meant to
 * advance to whatever date a collection was actually logged at, so a
 * missed cycle surfaces as one overdue proposal rather than silently
 * skipping ahead — the caller advances it by calling this again after
 * logging, not by this function looping past multiple missed cycles. */
export function proposeRentCollection(property: Property, today: Date = new Date()): RentCollectionProposal | null {
  if (!property.collectionCycle) return null;
  const anchor = property.lastCollectionDate ?? property.leaseStartDate;
  if (!anchor) return null;
  const due = advanceByCycle(new Date(anchor), property.collectionCycle);
  const dueDate = due.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  return {
    dueDate,
    amount: (property.monthlyRent ?? 0) + (property.pendingRentBalance ?? 0),
    isDue: dueDate <= todayStr,
  };
}

/** After logging a collection of `amountPaid` against a proposal that
 * expected `expectedAmount`, this is the new `pendingRentBalance` to carry
 * into the next proposal — never negative (an overpayment just clears the
 * balance rather than tracking a credit, an accepted v1 simplification). */
export function nextPendingBalance(expectedAmount: number, amountPaid: number): number {
  return Math.max(0, expectedAmount - amountPaid);
}

/** Due date for one cycle: `cycleStartDay` clamped to the target month's
 * actual length (day 31 in February lands on the 28th/29th) — same
 * accepted simplification as EMI/Loans' `installmentDueDate`. */
function cycleDate(year: number, monthIndex0: number, day: number): string {
  const lastDayOfMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const d = new Date(year, monthIndex0, Math.min(day, lastDayOfMonth));
  return d.toISOString().slice(0, 10);
}

/** Generates one projected RENT_INCOME plan per rent cycle from a
 * property's lease info, starting from whichever is later of
 * `leaseStartDate` and today (no point projecting rent that's already in
 * the past), and capped at `leaseEndDate` if set or a 12-month horizon
 * otherwise — an open-ended lease shouldn't generate plans forever in one
 * click. Returns an empty array (rather than throwing) if the property is
 * missing the fields needed to project anything, so the caller can just
 * check `.length` to decide whether to show a "add lease info first"
 * message. */
export function generateLeaseRentPlans(property: Property, today: Date = new Date()): PlannedRentalEntry[] {
  if (!property.monthlyRent || property.monthlyRent <= 0) return [];
  if (!property.cycleStartDay || property.cycleStartDay < 1 || property.cycleStartDay > 31) return [];
  if (!property.leaseStartDate) return [];

  const leaseStart = new Date(property.leaseStartDate);
  const leaseEnd = property.leaseEndDate ? new Date(property.leaseEndDate) : null;
  // "Next 12 months" means 12 cycle points, not 13 — end one day short of
  // the 13th month's start.
  const horizonEnd = new Date(today);
  horizonEnd.setMonth(horizonEnd.getMonth() + MAX_HORIZON_MONTHS);
  horizonEnd.setDate(horizonEnd.getDate() - 1);
  const cutoff = leaseEnd && leaseEnd < horizonEnd ? leaseEnd : horizonEnd;

  // Start from whichever cycle is next: the lease's own first cycle if
  // that's still in the future, otherwise the first cycle at/after today.
  let cursor = new Date(Math.max(leaseStart.getTime(), today.getTime()));
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

  const todayStr = today.toISOString().slice(0, 10);
  const leaseStartStr = property.leaseStartDate;
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const plans: PlannedRentalEntry[] = [];
  while (cursor <= cutoff) {
    const date = cycleDate(cursor.getFullYear(), cursor.getMonth(), property.cycleStartDay);
    if (date >= todayStr && date >= leaseStartStr && date <= cutoffStr) {
      plans.push({
        id: crypto.randomUUID(),
        propertyId: property.id,
        date,
        type: 'RENT_INCOME',
        amount: property.monthlyRent,
        category: 'Rent',
        executed: false,
        sourceLeasePropertyId: property.id,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return plans;
}
