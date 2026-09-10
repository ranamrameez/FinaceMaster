/**
 * User-requested (2026-09-06): "let the user choose (checkboxes?) to
 * include the accounts in the Net calcs. right now, EMI is giving me
 * unrealistic values." Confirmed the granularity with the user via
 * `AskUserQuestion`: per-account/loan/fund for Bank/EMI/Personal Loans/
 * Funds (each has multiple entities to pick from individually), and a
 * whole-module on/off switch for Cash/QSE/PSX (each is a single per-
 * currency ledger with nothing more granular to toggle).
 *
 * `includeInNetWorth` is a NEW, separate field on each entity type —
 * deliberately NOT reusing the existing `isActive` archive flag
 * (Bank/EMI/Personal Loans/Funds all added one on 2026-09-03), since that
 * field's own doc comments explicitly lock in "archiving must never
 * silently change a real financial figure, only what's shown by default."
 * This is the opposite: a control that DOES change the figure, on purpose.
 *
 * Applied in exactly ONE place per entity type (this file), then reused by
 * every consumer that needs "which accounts actually count" — today's live
 * Net Worth (`useNetWorthSummary`), a past month's real recomputation
 * (`netWorthAsOfDate`), and the future projection's EMI cash-outflow term
 * (`netWorthTrend`'s `emiScheduledCashOutflowByCurrency` call) — so an
 * excluded entity disappears from all three consistently, never just one.
 *
 * Filtering the top-level entity ARRAY is sufficient everywhere it's used
 * (verified by reading each consumer): `assetBalanceByCurrency`/
 * `creditCardLiabilityByCurrency` compute one account's own balance by
 * filtering `transactions` BY THAT ACCOUNT internally, `totalsByCurrency`
 * (EMI) and `netPositionByCurrency` (Personal Loans) iterate the loans
 * array directly with no separate top-level transaction list, and
 * `fundsValueByCurrency` looks up each fund's position by `fund.id` from
 * an already-computed set — so excluding an entity from the array alone
 * correctly excludes everything derived from it, no separate transaction/
 * repayment filtering needed.
 */
import type { BankAccount } from '../../types/bankWorkbook';
import type { CreditCard } from '../../types/creditCard';
import type { EMILoan } from '../../types/emiWorkbook';
import type { PersonalLoan } from '../../types/personalLoansWorkbook';
import type { Fund } from '../../types/fundsWorkbook';

function includedOnly<T extends { includeInNetWorth?: boolean }>(items: T[]): T[] {
  return items.filter((item) => item.includeInNetWorth !== false);
}

export const includedBankAccounts = (accounts: BankAccount[]): BankAccount[] => includedOnly(accounts);
export const includedEmiLoans = (loans: EMILoan[]): EMILoan[] => includedOnly(loans);
export const includedPersonalLoans = (loans: PersonalLoan[]): PersonalLoan[] => includedOnly(loans);
export const includedFunds = (funds: Fund[]): Fund[] => includedOnly(funds);
/** Added 2026-09-10 alongside the `CreditCard` entity — same pattern as
 * every other entity type above; `creditCardModule.ts`'s own
 * `creditCardLiabilityByCurrency` also filters internally as a second,
 * self-contained safeguard on real money, so this is belt-and-suspenders
 * consistency with the rest of the app's UI-level filtering, not the only
 * place this gets applied. */
export const includedCreditCards = (cards: CreditCard[]): CreditCard[] => includedOnly(cards);
