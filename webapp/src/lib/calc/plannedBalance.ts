import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';
import type { CashEntry } from '../../types/cashWorkbook';
import type { CreditCard, CreditCardTransaction } from '../../types/creditCard';
import type { PlannedBankTransaction } from '../../types/plannedBank';
import type { PlannedCashEntry } from '../../types/plannedCash';
import type { PlannedCreditCardTransaction } from '../../types/plannedCreditCard';
import type { RecurrenceRule } from '../../types/recurrence';
import { totalBalanceByCurrency } from './bankModule';
import { cashBalanceByCurrency } from './cashModule';
import { totalOwedByCurrency } from './creditCardModule';
import { nextRecurrenceOccurrence } from './recurrence';

export interface BalanceProjection {
  /** Balance from actual entries/transactions only. */
  real: number;
  /** `real` plus every not-yet-executed, in-horizon plan's signed amount —
   * a "what if I go through with everything I've planned soon" projection.
   * Executed plans are excluded since they already created a real entry
   * counted in `real`, so counting them again would double them up. */
  planned: number;
}

/** A plan horizon in days from "now," or `null` for no limit at all. Any
 * non-negative number is valid (not restricted to the picker's own preset
 * choices below) — the calc engine itself has no reason to know about a
 * specific UI's menu. User-reported (2026-09-20): "you are dumping life
 * time plans with current months assets/net worth... app must default to 1
 * month" — before this, a one-off plan counted toward `planned` regardless
 * of its own date, so a plan dated years in the future silently distorted a
 * projection meant to read as "soon." `PLANNING_HORIZON_OPTIONS` below is
 * the one shared list of picker choices every "Balance projection"/
 * plan-list UI offers; 30 is the shared default ("This month"). */
export type PlanningHorizonDays = number | null;

export const PLANNING_HORIZON_OPTIONS: { value: PlanningHorizonDays; label: string }[] = [
  { value: 30, label: 'This month' },
  { value: 90, label: 'Next 3 months' },
  { value: 180, label: 'Next 6 months' },
  { value: 365, label: 'Next year' },
  { value: null, label: 'All time' },
];

/** Pure UTC integer date arithmetic (no local-timezone `Date` mixing) —
 * same discipline as `emiModule.ts`'s `installmentDueDate()`/
 * `lib/datetime.ts`'s own helpers, see either's doc comment for the exact
 * bug class this avoids. `Date.UTC` itself correctly normalizes an
 * out-of-range day across month/year boundaries, so `days` can just be
 * added straight onto the day component. */
function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days)).toISOString().slice(0, 10);
}

/** Whether `dateStr` is no more than `horizonDays` in the FUTURE of `asOf`
 * — deliberately unbounded on the past side, so an overdue-but-not-yet-
 * done plan (the single most urgent thing to see) is never hidden by a
 * short horizon; only a plan dated further out than the window is. */
function withinHorizon(dateStr: string, asOf: Date, horizonDays: number): boolean {
  return dateStr <= addDaysISO(asOf.toISOString().slice(0, 10), horizonDays);
}

/** Whether a plan's own relevant date (its own `date` for a one-off plan,
 * or its NEXT occurrence for a recurring one — same "next occurrence,
 * walked forward past whatever's already passed" resolution
 * `isPlanDue` uses) falls within `horizonDays` of `asOf`. Exported for each
 * module's own plan-LIST UI to reuse — unlike `isPlanDue` below, this
 * doesn't care whether the plan is already marked done, since a list
 * legitimately wants to show/hide by date regardless of status (that's a
 * separate, independent filter dimension there). A recurring plan with no
 * occurrence left at all (past its own `endDate`) is never hidden by this
 * — horizon filtering doesn't meaningfully apply to a plan that's already
 * finished recurring. */
export function planWithinHorizon(
  p: { recurrence?: RecurrenceRule; date: string },
  asOf: Date,
  horizonDays: PlanningHorizonDays,
): boolean {
  if (horizonDays == null) return true;
  const relevantDate = p.recurrence ? nextRecurrenceOccurrence(p.recurrence, asOf)?.toISOString().slice(0, 10) : p.date;
  return relevantDate ? withinHorizon(relevantDate, asOf, horizonDays) : true;
}

/** Whether a plan's own next-due occurrence should count toward the
 * "planned" projection right now (2026-09-07, recurrence support; horizon
 * added 2026-09-20 — see `PlanningHorizonDays`'s own doc comment). A
 * one-off plan (no `recurrence`) is unchanged: counted until `executed`,
 * now ALSO only while within `horizonDays`. A recurring plan counts its
 * OWN next occurrence — computed live via `nextRecurrenceOccurrence`,
 * which already walks forward past any cycle that's already passed —
 * UNLESS `executedThrough` shows that specific occurrence was already
 * turned into a real entry (already counted in `real`, so counting it
 * again here would double it); once a later cycle rolls the "next" date
 * past `executedThrough`, it naturally counts again — and that next
 * occurrence still has to fall within the horizon to count.
 *
 * Exported so any other "what's still hanging over my balance" indicator
 * (e.g. `BalancesSummary`'s own "N upcoming plans" sub-line) can reuse the
 * exact same not-yet-done-and-in-horizon logic instead of a weaker,
 * ad-hoc `!p.executed` check that (a) never applied a horizon at all and
 * (b) is meaningless for a recurring plan, which never sets `executed` in
 * the first place. */
export function isPlanDue(
  p: { executed?: boolean; recurrence?: RecurrenceRule; executedThrough?: string; date: string },
  asOf: Date,
  horizonDays: PlanningHorizonDays,
): boolean {
  if (!p.recurrence) {
    if (p.executed) return false;
    return horizonDays == null || withinHorizon(p.date, asOf, horizonDays);
  }
  const next = nextRecurrenceOccurrence(p.recurrence, asOf);
  if (!next) return false;
  const nextStr = next.toISOString().slice(0, 10);
  if (p.executedThrough && p.executedThrough >= nextStr) return false;
  return horizonDays == null || withinHorizon(nextStr, asOf, horizonDays);
}

/** Real vs. planned cash balance per currency. See `PlannedCashEntry`'s
 * doc comment for why this exists (user request 2026-08-23: a guardrail
 * against overspending — see what your balance would look like if every
 * planned entry actually happened). */
export function plannedCashProjection(
  entries: CashEntry[],
  planned: PlannedCashEntry[],
  asOf: Date = new Date(),
  horizonDays: PlanningHorizonDays = null,
): Record<string, BalanceProjection> {
  const real = cashBalanceByCurrency(entries);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  planned
    .filter((p) => isPlanDue(p, asOf, horizonDays))
    .forEach((p) => {
      if (!out[p.currencyCode]) out[p.currencyCode] = { real: real[p.currencyCode] ?? 0, planned: real[p.currencyCode] ?? 0 };
      out[p.currencyCode].planned += p.type === 'IN' ? p.amount : -p.amount;
    });
  return out;
}

/** Real vs. planned Banking balance per currency, across all accounts.
 * A plan referencing a since-deleted account is skipped (there's no
 * currency to attribute it to) rather than guessed at. */
export function plannedBankProjection(
  accounts: BankAccount[],
  transactions: BankTransaction[],
  planned: PlannedBankTransaction[],
  asOf: Date = new Date(),
  horizonDays: PlanningHorizonDays = null,
): Record<string, BalanceProjection> {
  const real = totalBalanceByCurrency(accounts, transactions);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currencyCode]));
  planned
    .filter((p) => isPlanDue(p, asOf, horizonDays))
    .forEach((p) => {
      const code = currencyByAccount.get(p.accountId);
      if (!code) return;
      if (!out[code]) out[code] = { real: real[code] ?? 0, planned: real[code] ?? 0 };
      out[code].planned += p.amount;
    });
  return out;
}

/** Real vs. planned Credit Card balance, per currency — unlike Cash/Bank's
 * own "planned" line, this figure is money OWED, not money held: a HIGHER
 * "planned" number is the worse outcome, the opposite intuition from
 * `plannedCashProjection`/`plannedBankProjection`. A plan referencing a
 * since-deleted card is skipped, same as `plannedBankProjection` does for
 * a deleted account. `kind` decides a planned entry's effect on what's
 * owed — mirrors `CreditCardTransaction`'s own doc comment ("kind decides
 * the effect, not the sign"): a charge/fee/markup/cashAdvance ADDS to the
 * balance, a payment SUBTRACTS from it. */
export function plannedCreditCardProjection(
  cards: CreditCard[],
  transactions: CreditCardTransaction[],
  planned: PlannedCreditCardTransaction[],
  asOf: Date = new Date(),
  horizonDays: PlanningHorizonDays = null,
): Record<string, BalanceProjection> {
  const real = totalOwedByCurrency(cards, transactions);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  const currencyByCard = new Map(cards.map((c) => [c.id, c.currencyCode]));
  planned
    .filter((p) => isPlanDue(p, asOf, horizonDays))
    .forEach((p) => {
      const code = currencyByCard.get(p.cardId);
      if (!code) return;
      if (!out[code]) out[code] = { real: real[code] ?? 0, planned: real[code] ?? 0 };
      out[code].planned += p.kind === 'payment' ? -p.amount : p.amount;
    });
  return out;
}
