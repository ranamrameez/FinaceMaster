import type { BankTransaction } from '../types/bankWorkbook';
import type { CashEntry } from '../types/cashWorkbook';
import type { InterEntityTransfer, InterEntityTransferInput, LinkModule, LinkSideConfig } from '../types/interEntityTransfer';
import type { Transfer } from '../types/workbook';

/** The ledger record a link creates/updates on one side, tagged by which
 * module it belongs to so the caller knows which store to dispatch it to
 * without re-deriving that from the link itself. */
export type LinkSideRecord =
  | { module: 'cash'; record: CashEntry }
  | { module: 'bank'; record: BankTransaction }
  | { module: 'qse' | 'psx'; record: Transfer };

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
      return {
        module: cfg.module,
        record: { id, date, type: direction === 'in' ? 'DEPOSIT' : 'WITHDRAWAL', gross: amount, fee: 0 },
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
  const from = buildSideRecord(input.from, ids.fromRecordId, input.date, input.amount, 'out', input.note);
  const to = buildSideRecord(input.to, ids.toRecordId, input.date, input.amount, 'in', input.note);
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
  ];
  return supported.some(([a, b]) => a === from && b === to);
}
