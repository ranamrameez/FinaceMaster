import type { BankAccount, BankTransaction } from '../../types/bankWorkbook';
import type { CashEntry } from '../../types/cashWorkbook';
import type { PlannedBankTransaction } from '../../types/plannedBank';
import type { PlannedCashEntry } from '../../types/plannedCash';
import { totalBalanceByCurrency } from './bankModule';
import { cashBalanceByCurrency } from './cashModule';

export interface BalanceProjection {
  /** Balance from actual entries/transactions only. */
  real: number;
  /** `real` plus every not-yet-executed plan's signed amount — a "what if
   * I go through with everything I've planned" projection. Executed plans
   * are excluded since they already created a real entry counted in
   * `real`, so counting them again would double them up. */
  planned: number;
}

/** Real vs. planned cash balance per currency. See `PlannedCashEntry`'s
 * doc comment for why this exists (user request 2026-08-23: a guardrail
 * against overspending — see what your balance would look like if every
 * planned entry actually happened). */
export function plannedCashProjection(entries: CashEntry[], planned: PlannedCashEntry[]): Record<string, BalanceProjection> {
  const real = cashBalanceByCurrency(entries);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  planned
    .filter((p) => !p.executed)
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
): Record<string, BalanceProjection> {
  const real = totalBalanceByCurrency(accounts, transactions);
  const out: Record<string, BalanceProjection> = {};
  Object.keys(real).forEach((code) => {
    out[code] = { real: real[code], planned: real[code] };
  });
  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currencyCode]));
  planned
    .filter((p) => !p.executed)
    .forEach((p) => {
      const code = currencyByAccount.get(p.accountId);
      if (!code) return;
      if (!out[code]) out[code] = { real: real[code] ?? 0, planned: real[code] ?? 0 };
      out[code].planned += p.amount;
    });
  return out;
}
