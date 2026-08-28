import type { BankTransaction } from '../types/bankWorkbook';
import type { CashEntry } from '../types/cashWorkbook';
import type { EMIRepayment } from '../types/emiWorkbook';
import type { InterEntityTransfer, InterEntityTransferInput, LinkModule, LinkSideConfig } from '../types/interEntityTransfer';
import type { PersonalLoanRepayment } from '../types/personalLoansWorkbook';
import type { RentalEntry } from '../types/rentalsWorkbook';
import type { Transfer } from '../types/workbook';

/** The ledger record a link creates/updates on one side, tagged by which
 * module it belongs to so the caller knows which store to dispatch it to
 * without re-deriving that from the link itself. */
export type LinkSideRecord =
  | { module: 'cash'; record: CashEntry }
  | { module: 'bank'; record: BankTransaction }
  | { module: 'qse' | 'psx' | 'funds'; record: Transfer }
  | { module: 'rentals'; record: RentalEntry }
  | { module: 'personalLoans'; record: PersonalLoanRepayment }
  | { module: 'emi'; record: EMIRepayment };

function buildSideRecord(
  cfg: LinkSideConfig,
  id: string,
  date: string,
  amount: number,
  direction: 'in' | 'out',
  note: string | undefined,
): LinkSideRecord {
  switch (cfg.module) {
    case 'cash':
      return {
        module: 'cash',
        record: {
          id,
          date,
          type: direction === 'in' ? 'IN' : 'OUT',
          amount,
          // `cfg.currencyCode` should always be set by the time this runs —
          // every real caller (SideFields' own module picker, each
          // module's inline "link to Cash" shortcut) sets it explicitly,
          // Cash having no fixed currency of its own the way a Bank
          // account does. The 'USD' fallback is defensive-only, for a
          // theoretical caller that skips that step — it used to be
          // silently reachable in practice before those callers were
          // fixed (README Done item: "Link To always shows USD instead of
          // filling default currency").
          currencyCode: cfg.currencyCode || 'USD',
          category: 'Transfer',
          note,
          source: 'manual',
        },
      };
    case 'bank':
      if (!cfg.ref) throw new Error('Bank side of a linked transfer needs an account.');
      return {
        module: 'bank',
        record: {
          id,
          accountId: cfg.ref,
          date,
          amount: direction === 'in' ? amount : -amount,
          description: note || 'Linked transfer',
          category: 'Transfer',
          source: 'manual',
        },
      };
    case 'qse':
    case 'psx':
    case 'funds':
      return {
        module: cfg.module,
        record: { id, date, type: direction === 'in' ? 'DEPOSIT' : 'WITHDRAWAL', gross: amount, fee: 0 },
      };
    case 'rentals':
      // Unlike Bank/Cash/QSE/PSX/Funds, Rentals has no real balance of its
      // own — RENT_INCOME/EXPENSE just categorize a real Bank/Cash event
      // from the property's own performance-tracking side, they don't
      // represent money "leaving" or "entering" a Rentals-held pool. So the
      // generic from='out'/to='in' convention (correct for a genuine
      // transfer between two real money pools, where one side's balance
      // rises exactly as the other's falls) doesn't apply here: real rent
      // landing in Bank/Cash means BOTH that account AND the property's own
      // income figure go up together, not in opposite directions. If
      // Rentals is picked as the `to` side, the real money is necessarily
      // on the `from` side and is decreasing (money left that account to
      // pay for something) — an EXPENSE. If Rentals is `from`, the real
      // money is on `to` and increasing (money arrived) — RENT_INCOME. This
      // was inverted until 2026-08-25 (README Done item 126) — the exact
      // same class of "direction doesn't map to a sign for this module"
      // exception the `personalLoans` case below already documents, just
      // missed here originally.
      if (!cfg.ref) throw new Error('Rentals side of a linked transfer needs a property.');
      return {
        module: 'rentals',
        record: {
          id,
          propertyId: cfg.ref,
          date,
          type: direction === 'in' ? 'EXPENSE' : 'RENT_INCOME',
          amount,
          note,
        },
      };
    case 'personalLoans':
      // A repayment's amount is always positive regardless of which way the
      // debt runs or which side of the link it is — paying off "money I owe"
      // and receiving a repayment for "money I lent out" both just log a
      // PersonalLoanRepayment against the chosen loan, so `direction` is
      // intentionally unused here (unlike every other module's side record).
      if (!cfg.ref) throw new Error('Personal Loans side of a linked transfer needs a loan.');
      return {
        module: 'personalLoans',
        record: { id, loanId: cfg.ref, date, amount },
      };
    case 'emi':
      // Same "direction doesn't flip the sign" exception as personalLoans
      // above — an EMI installment payment always reduces what's owed
      // regardless of which side of the link it's on. `emiMonth` is
      // resolved by the picker UI (see LinkSideConfig's own doc comment)
      // since this function has no store access to read the loan's
      // current schedule.
      if (!cfg.ref) throw new Error('EMI/Loans side of a linked transfer needs a loan.');
      if (!cfg.emiMonth) throw new Error("Couldn't determine which installment this payment applies to.");
      return {
        module: 'emi',
        record: { id, loanId: cfg.ref, month: cfg.emiMonth, amount, date },
      };
  }
}

/** Pure builder: given the link's input and the three ids it needs (the
 * link record itself, plus one ledger record per side), computes the two
 * side records and the link record — no store access, so it's testable
 * without mocking Zustand and reusable for both create (new ids) and edit
 * (existing ids, recomputed fields). Callers are responsible for actually
 * dispatching `from`/`to` into the right module store and `link` into the
 * inter-entity-transfers store. */
export function buildLinkedRecords(
  input: InterEntityTransferInput,
  ids: { linkId: string; fromRecordId: string; toRecordId: string },
): { from: LinkSideRecord; to: LinkSideRecord; link: InterEntityTransfer } {
  const from = buildSideRecord(input.from, ids.fromRecordId, input.date, input.fromAmount, 'out', input.note);
  const to = buildSideRecord(input.to, ids.toRecordId, input.date, input.toAmount, 'in', input.note);
  const link: InterEntityTransfer = {
    ...input,
    id: ids.linkId,
    fromRecordId: ids.fromRecordId,
    toRecordId: ids.toRecordId,
  };
  return { from, to, link };
}

/** Whether a from/to module pairing is actually supported in v1 — see the
 * module doc-comment on `LinkModule` for the locked scope. Bank->Bank is
 * included (moving money between two of the user's own accounts) since
 * Bank is the only module with more than one sub-account; the caller is
 * responsible for rejecting a bank->bank pairing where both sides resolve
 * to the *same* account, since that's a same-account no-op this function
 * can't see (it only knows modules, not refs). */
export function isSupportedLinkPair(from: LinkModule, to: LinkModule): boolean {
  const supported: [LinkModule, LinkModule][] = [
    ['cash', 'bank'],
    ['bank', 'cash'],
    ['bank', 'bank'],
    ['bank', 'qse'],
    ['qse', 'bank'],
    ['bank', 'psx'],
    ['psx', 'bank'],
    ['bank', 'rentals'],
    ['rentals', 'bank'],
    ['cash', 'rentals'],
    ['rentals', 'cash'],
    ['bank', 'personalLoans'],
    ['personalLoans', 'bank'],
    ['cash', 'personalLoans'],
    ['personalLoans', 'cash'],
    ['bank', 'funds'],
    ['funds', 'bank'],
    ['cash', 'funds'],
    ['funds', 'cash'],
    ['bank', 'emi'],
    ['emi', 'bank'],
    ['cash', 'emi'],
    ['emi', 'cash'],
  ];
  return supported.some(([a, b]) => a === from && b === to);
}
