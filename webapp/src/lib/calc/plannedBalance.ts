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
  /** `real` plus every not-yet-executed plan's signed amount — a "what if
   * I go through with everything I've planned" projection. Executed plans
   * are excluded since they already created a real entry counted in
   * `real`, so counting them again would double them up. */
  planned: number;
}

/** Whether a plan's own next-due occurrence should count toward the
 * "planned" projection right now (2026-09-07, recurrence support). A
 * one-off plan (no `recurrence`) is unchanged: counted until `executed`.
 * A recurring plan counts its OWN next occurrence — computed live via
 * `nextRecurrenceOccurrence`, which already walks forward past any cycle
 * that's already passed — UNLESS `executedThrough` shows that specific
 * occurrence was already turned into a real entry (already counted in
 * `real`, so counting it again here would double it); once a later cycle
 * rolls the "next" date past `executedThrough`, it naturally counts again. */
function isPlanDue(p: { executed?: boolean; recurrence?: RecurrenceRule; executedThrough?: string }, asOf: Date): boolean {
  if (!p.recurrence) return !p.executed;
  const next = nextRecurrenceOccurrence(p.recurrence, asOf);
  if (!next) return false;
  const nextStr = next.toISOString().slice(0, 10);
  return !p.executedThrough || p.executedThrough < nextStr;
}

/** Real vs. planned cash balance per currency. See `PlannedCashEntry`'s
 * doc comment for why this exists (user request 2026-08-23: a guardrail
 * against overspending — see what your balance would look like if every
 * planned entry actually happened). */
export function plannedCashProjection(entries: CashEntry[], planned: PlannedCashEntry[], asOf: Date = new Date()): Record<string, BalanceProjection> {
  const real = cashBalanceByCurrency(entries);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  planned
    .filter((p) => isPlanDue(p, asOf))
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
): Record<string, BalanceProjection> {
  const real = totalBalanceByCurrency(accounts, transactions);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currencyCode]));
  planned
    .filter((p) => isPlanDue(p, asOf))
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
): Record<string, BalanceProjection> {
  const real = totalOwedByCurrency(cards, transactions);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  const currencyByCard = new Map(cards.map((c) => [c.id, c.currencyCode]));
  planned
    .filter((p) => isPlanDue(p, asOf))
    .forEach((p) => {
      const code = currencyByCard.get(p.cardId);
      if (!code) return;
      if (!out[code]) out[code] = { real: real[code] ?? 0, planned: real[code] ?? 0 };
      out[code].planned += p.kind === 'payment' ? -p.amount : p.amount;
    });
  return out;
}
