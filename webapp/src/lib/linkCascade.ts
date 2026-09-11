import { confirmDialog } from '../components/ConfirmDialog';
import { linkedEditChoiceDialog, type LinkedEditChoice } from '../components/LinkedEditChoiceDialog';
import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../store/cashWorkbookStore';
import { useCreditCardWorkbookStore } from '../store/creditCardWorkbookStore';
import { useEMIWorkbookStore } from '../store/emiWorkbookStore';
import { useFundsWorkbookStore } from '../store/fundsWorkbookStore';
import { useInterEntityTransfersStore } from '../store/interEntityTransfersStore';
import { usePersonalLoansWorkbookStore } from '../store/personalLoansWorkbookStore';
import { usePSXWorkbookStore } from '../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../store/rentalsWorkbookStore';
import { useWorkbookStore } from '../store/workbookStore';
import { LINK_MODULE_LABELS, type InterEntityTransfer, type InterEntityTransferInput, type LinkModule, type LinkSideConfig } from '../types/interEntityTransfer';
import { buildLinkedRecords, type LinkSideRecord } from './interEntityLink';

/** Dispatches a side record into the module store it belongs to. Shared by
 * the Transfers page (create/edit/delete a link) and every native module's
 * own delete handler (`confirmAndDeleteLinkable` below), so both paths
 * cascade a linked record's deletion identically. */
export function dispatchAdd(side: LinkSideRecord) {
  switch (side.module) {
    case 'cash': return useCashWorkbookStore.getState().addEntry(side.record);
    case 'bank': return useBankWorkbookStore.getState().addTransaction(side.record);
    case 'qse': return useWorkbookStore.getState().addTransfer(side.record);
    case 'psx': return usePSXWorkbookStore.getState().addTransfer(side.record);
    case 'funds': return useFundsWorkbookStore.getState().addTransfer(side.record);
    case 'rentals': return useRentalsWorkbookStore.getState().addEntry(side.record);
    case 'personalLoans': return usePersonalLoansWorkbookStore.getState().addRepayment(side.record);
    case 'emi': return useEMIWorkbookStore.getState().addRepayment(side.record);
    case 'creditCard': return useCreditCardWorkbookStore.getState().addTransaction(side.record);
  }
}

export function dispatchUpdate(side: LinkSideRecord) {
  switch (side.module) {
    case 'cash': return useCashWorkbookStore.getState().updateEntry(side.record.id, side.record);
    case 'bank': return useBankWorkbookStore.getState().updateTransaction(side.record.id, side.record);
    case 'qse': return useWorkbookStore.getState().updateTransfer(side.record.id, side.record);
    case 'psx': return usePSXWorkbookStore.getState().updateTransfer(side.record.id, side.record);
    case 'funds': return useFundsWorkbookStore.getState().updateTransfer(side.record.id, side.record);
    case 'rentals': return useRentalsWorkbookStore.getState().updateEntry(side.record.id, side.record);
    case 'personalLoans': return usePersonalLoansWorkbookStore.getState().updateRepayment(side.record.id, side.record);
    case 'emi': return useEMIWorkbookStore.getState().updateRepayment(side.record.id, side.record);
    case 'creditCard': return useCreditCardWorkbookStore.getState().updateTransaction(side.record.id, side.record);
  }
}

export function dispatchRemove(module: LinkModule, id: string) {
  switch (module) {
    case 'cash': return useCashWorkbookStore.getState().deleteEntry(id);
    case 'bank': return useBankWorkbookStore.getState().deleteTransaction(id);
    case 'qse': return useWorkbookStore.getState().deleteTransfer(id);
    case 'psx': return usePSXWorkbookStore.getState().deleteTransfer(id);
    case 'funds': return useFundsWorkbookStore.getState().deleteTransfer(id);
    case 'rentals': return useRentalsWorkbookStore.getState().deleteEntry(id);
    case 'personalLoans': return usePersonalLoansWorkbookStore.getState().deleteRepayment(id);
    case 'emi': return useEMIWorkbookStore.getState().deleteRepayment(id);
    case 'creditCard': return useCreditCardWorkbookStore.getState().deleteTransaction(id);
  }
}

/** Creates a linked transfer's two side records + the link record itself.
 * Code-review finding (PR #2): the three writes below aren't a real
 * database transaction — there's no way to make a client-only app with
 * per-store localStorage + independently-debounced Firebase pushes
 * genuinely atomic. What this *can* do, and does: if a later write throws,
 * it rolls back every side record already written rather than leaving a
 * one-sided (or, per Sourcery's follow-up review, a written-but-unlinked)
 * orphan and reporting success. In practice none of the store actions here
 * throw synchronously (persistence failures are caught and logged inside
 * each store, not surfaced) — this is defense-in-depth for if that ever
 * changes, not a claim of full transactional safety.
 *
 * Sourcery finding (2026-08-23, follow-up review on PR #2): the original
 * version only tracked `fromModule`, so if the link-record write threw
 * *after* both side records had already been written successfully, the
 * catch block rolled back `from` but left `to` orphaned. Fixed by tracking
 * both written sides and rolling back whichever ones actually succeeded,
 * in every failure case — including a failure at the final link-store
 * write. */
export function createLinkedTransfer(input: InterEntityTransferInput): { link: InterEntityTransfer } | { error: string } {
  const ids = { linkId: crypto.randomUUID(), fromRecordId: crypto.randomUUID(), toRecordId: crypto.randomUUID() };
  const written: { module: LinkSideRecord['module']; id: string }[] = [];
  try {
    const { from, to, link } = buildLinkedRecords(input, ids);
    dispatchAdd(from);
    written.push({ module: from.module, id: ids.fromRecordId });
    dispatchAdd(to);
    written.push({ module: to.module, id: ids.toRecordId });
    useInterEntityTransfersStore.getState().addEntry(link);
    return { link };
  } catch (e) {
    for (const side of written) {
      try {
        dispatchRemove(side.module, side.id);
      } catch {
        // Best-effort rollback — if this also fails there's nothing more
        // to do client-side; the error below still surfaces to the user.
      }
    }
    return { error: e instanceof Error ? e.message : 'Failed to create the linked transfer.' };
  }
}

/** Recomputes and re-dispatches both side records for an edit. Unlike
 * `createLinkedTransfer`, this doesn't attempt rollback on a partial
 * failure — reverting an *update* would need the pre-edit record values,
 * which aren't retained here. If this ever throws partway, the two sides
 * may end up briefly inconsistent; this is reported honestly rather than
 * claimed as safe. */
export function updateLinkedTransfer(
  input: InterEntityTransferInput,
  link: InterEntityTransfer,
): { link: InterEntityTransfer } | { error: string } {
  const ids = { linkId: link.id, fromRecordId: link.fromRecordId, toRecordId: link.toRecordId };
  const { from, to, link: updated } = buildLinkedRecords(input, ids);
  try {
    dispatchUpdate(from);
    dispatchUpdate(to);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update the linked transfer.' };
  }
  useInterEntityTransfersStore.getState().updateEntry(link.id, updated);
  return { link: updated };
}

/** Removes both side records and the link record itself. Used by the
 * Transfers page's own delete action and by `confirmAndDeleteLinkable`
 * below, so deleting either side from its native module cascades exactly
 * like deleting it from the Transfers page does. */
export function deleteLinkCascade(link: InterEntityTransfer) {
  dispatchRemove(link.from.module, link.fromRecordId);
  dispatchRemove(link.to.module, link.toRecordId);
  useInterEntityTransfersStore.getState().deleteEntry(link.id);
}

/** Finds the link (if any) that owns a given module's record — used so a
 * native module's own delete button can detect it's about to remove one
 * side of a linked transfer. */
export function findLinkForRecord(module: LinkModule, recordId: string): InterEntityTransfer | undefined {
  return useInterEntityTransfersStore
    .getState()
    .workbook.entries.find(
      (l) => (l.from.module === module && l.fromRecordId === recordId) || (l.to.module === module && l.toRecordId === recordId),
    );
}

/** `Finance.isLinked`'s only correct source: computed live from the real
 * link store, never a second persisted copy of the same fact (a stored
 * boolean could silently go stale the moment a link is created or removed
 * elsewhere in the app — see `types/finance.ts`'s file-level comment). */
export function isRecordLinked(module: LinkModule, recordId: string): boolean {
  return !!findLinkForRecord(module, recordId);
}

/** README item 27's known remaining gap, now closed at the "honest warning"
 * level (not full propagation — see the reasoning below): editing a linked
 * record's amount/date directly in its native module doesn't update the
 * other side or the link record, and silently letting that happen was the
 * actual gap. Auto-propagating the edit isn't safe to do blindly either —
 * `InterEntityTransferInput.fromAmount`/`toAmount` are independently
 * entered specifically because a cross-currency link has no live FX rate
 * to derive one side from the other, so "just copy the new amount to the
 * other side" would be wrong for exactly the links most likely to need
 * this warning. Call this before saving a native edit to a record that
 * might be linked; if it returns false, the caller should abort the save.
 *
 * Kept as a plain yes/no gate for the one remaining caller
 * (`EMIPage.tsx`'s `applyBigEmi`, a loop over potentially many months at
 * once) where popping the full `resolveLinkedEdit` three-way choice
 * per-iteration would mean stacking several sequential modals for one
 * batch action — every single-record edit flow uses `resolveLinkedEdit`
 * below instead. */
export async function warnIfLinked(module: LinkModule, id: string): Promise<boolean> {
  const link = findLinkForRecord(module, id);
  if (!link) return true;
  const otherModule = link.from.module === module ? link.to.module : link.from.module;
  return confirmDialog(
    `This entry is linked to a transfer with ${LINK_MODULE_LABELS[otherModule]}. Editing it here updates only this side — the other side and the link record won't change to match.`,
    'Edit this linked entry anyway?',
  );
}

/** User-reported (2026-09-11): the old `warnIfLinked` confirm dialog told
 * the user to "use the Transfers page instead for a fully-synced edit" —
 * but the standalone Transfers page was removed app-wide (README Done item
 * 216) in favor of an app-wide FAB + shared popup, so that instruction
 * pointed at a page that no longer exists. Every single-record edit flow
 * (as opposed to `applyBigEmi`'s batch loop, which still uses the plain
 * `warnIfLinked` gate above) now calls this instead: it offers the actual
 * fully-synced option right there — `'both'` — rather than sending the
 * user somewhere that doesn't exist. Returns `'this'` immediately (no
 * dialog) when the record isn't linked at all. */
export async function resolveLinkedEdit(module: LinkModule, id: string): Promise<LinkedEditChoice> {
  const link = findLinkForRecord(module, id);
  if (!link) return 'this';
  const otherModule = link.fromRecordId === id ? link.to.module : link.from.module;
  return linkedEditChoiceDialog(LINK_MODULE_LABELS[otherModule]);
}

/** Same currency-lookup `useSideCurrency` (`features/transfers/pages/
 * TransferLinksPage.tsx`) does, but as a plain `.getState()` read instead
 * of a hook — this runs from inside an imperative save handler, not a
 * component render, so it can't call a hook. Not reused directly from that
 * file to avoid a real import cycle: `TransferLinksPage.tsx` imports
 * `AddAccountForm`/`AddLoanForm`/etc. from `BankPage.tsx`/`EMIPage.tsx`/
 * `PersonalLoansPage.tsx`/`RentalsPage.tsx`, and every one of those already
 * imports from this file — so this file importing back from
 * `TransferLinksPage.tsx` would close the loop. The switch itself is small
 * enough that duplicating it here is safer than untangling that cycle. */
function resolveSideCurrency(cfg: LinkSideConfig): string | null {
  switch (cfg.module) {
    case 'cash': return cfg.currencyCode || useCashWorkbookStore.getState().workbook.settings.defaultCurrency;
    case 'bank': return useBankWorkbookStore.getState().workbook.settings.accounts.find((a) => a.id === cfg.ref)?.currencyCode ?? null;
    case 'qse': return useWorkbookStore.getState().workbook.settings.currency;
    case 'psx': return usePSXWorkbookStore.getState().workbook.settings.currency;
    case 'funds': return useFundsWorkbookStore.getState().workbook.settings.defaultCurrency;
    case 'rentals': return useRentalsWorkbookStore.getState().workbook.settings.properties.find((p) => p.id === cfg.ref)?.currencyCode ?? null;
    case 'personalLoans': return usePersonalLoansWorkbookStore.getState().workbook.loans.find((l) => l.id === cfg.ref)?.currencyCode ?? null;
    case 'emi': return useEMIWorkbookStore.getState().workbook.entries.find((l) => l.id === cfg.ref)?.currencyCode ?? null;
    case 'creditCard': return useCreditCardWorkbookStore.getState().workbook.cards.find((c) => c.id === cfg.ref)?.currencyCode ?? null;
  }
}

/** Propagates an edited date/amount/note to the OTHER side of a linked
 * record, plus the link record itself — the actual mechanics behind
 * `resolveLinkedEdit`'s `'both'` choice. Deliberately does NOT re-dispatch
 * an update for `module`/`id`'s own side (the side being natively edited):
 * the caller already saves that side through its own normal
 * `updateEntry`/`updateTransaction`/etc. call, which preserves every
 * module-specific field (Pending flag, time/timezone, category, PSX's fee
 * override, ...) — re-deriving that side from `buildSideRecord` here too
 * would silently reset every one of those back to `buildSideRecord`'s own
 * bare-minimum shape (e.g. a QSE/PSX/Funds `Transfer`'s `fee` would get
 * clobbered back to 0, since `buildSideRecord` always writes `fee: 0`).
 *
 * `amount` is a magnitude (matching `fromAmount`/`toAmount`'s own
 * always-positive convention). When both sides genuinely share a currency,
 * "both sides" means exactly that — the new amount is mirrored onto BOTH
 * `fromAmount` and `toAmount`, on the theory that the user picking this
 * option is a deliberate "yes, keep them equal" choice, not a silent
 * assumption of the kind `InterEntityTransferInput`'s own doc comment
 * warns against. When the currencies differ (or either side's currency
 * can't be resolved, e.g. a picker referencing a since-deleted account),
 * mirroring the raw number would be wrong (100 USD isn't 100 PKR) — same
 * "independently entered, no live FX rate" rule that field's comment
 * documents — so only the side actually being edited gets the new amount,
 * the other side's own (presumably already-converted) figure is left
 * alone, and the returned `message` says so instead of claiming a full
 * sync that didn't happen. */
export function propagateLinkedEdit(
  module: LinkModule,
  id: string,
  changes: { date?: string; amount?: number; note?: string },
): { error?: string; message?: string } {
  const link = findLinkForRecord(module, id);
  if (!link) return {};
  const isFromSide = link.fromRecordId === id;
  let fromAmount = link.fromAmount;
  let toAmount = link.toAmount;
  let message: string | undefined;
  if (changes.amount !== undefined) {
    const fromCurrency = resolveSideCurrency(link.from);
    const toCurrency = resolveSideCurrency(link.to);
    if (fromCurrency && toCurrency && fromCurrency === toCurrency) {
      fromAmount = changes.amount;
      toAmount = changes.amount;
    } else {
      if (isFromSide) fromAmount = changes.amount; else toAmount = changes.amount;
      message = "Entry updated — the linked entry's currency differs, so only the date synced; its own amount is unchanged.";
    }
  }
  const input: InterEntityTransferInput = {
    date: changes.date ?? link.date,
    fromAmount,
    toAmount,
    from: link.from,
    to: link.to,
    note: changes.note !== undefined ? changes.note : link.note,
    rateSource: link.rateSource,
  };
  try {
    const ids = { linkId: link.id, fromRecordId: link.fromRecordId, toRecordId: link.toRecordId };
    const { from, to, link: updatedLink } = buildLinkedRecords(input, ids);
    dispatchUpdate(isFromSide ? to : from);
    useInterEntityTransfersStore.getState().updateEntry(link.id, updatedLink);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update the linked entry.' };
  }
}

/** Code-review finding (PR #2): deleting a linked record directly from its
 * native module (Cash's ledger, Bank's transactions, QSE/PSX transfers,
 * Rentals entries) used to just remove that one row, leaving the link
 * record pointing at a now-missing id and the *other* side still present
 * — a silent orphan. Every native delete button should call this instead
 * of confirming+deleting directly: if the record isn't part of a link,
 * behavior is unchanged; if it is, the confirm dialog says so and, if
 * confirmed, cascades the delete to both sides + the link record, exactly
 * like deleting from the Transfers page does — never a one-sided delete
 * from either entry point.
 *
 * *Editing* (not deleting) a linked record's amount/date directly in its
 * native module used to just silently update this side only — fixed
 * (2026-09-11) by letting the user choose, right there, whether to also
 * sync the other side: every single-record native edit form calls
 * `resolveLinkedEdit` before saving and, if the user picks "both sides",
 * `propagateLinkedEdit` right after — see both functions' own comments for
 * why full auto-propagation isn't always safe to do blindly (a
 * cross-currency link's amount, in particular) even when the user does
 * ask for it. */
export async function confirmAndDeleteLinkable(module: LinkModule, id: string, plainDelete: () => void): Promise<void> {
  const link = findLinkForRecord(module, id);
  if (!link) {
    if (await confirmDialog('This cannot be undone.', 'Delete this entry?')) plainDelete();
    return;
  }
  const otherModule = link.from.module === module ? link.to.module : link.from.module;
  const ok = await confirmDialog(
    `This entry is part of a linked transfer with ${LINK_MODULE_LABELS[otherModule]} — deleting it here also removes the linked record on the other side and the link itself. This cannot be undone.`,
    'Delete this linked entry?',
  );
  if (!ok) return;
  deleteLinkCascade(link);
}
