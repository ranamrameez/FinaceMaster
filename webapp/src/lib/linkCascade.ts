import { confirmDialog } from '../components/ConfirmDialog';
import { useBankWorkbookStore } from '../store/bankWorkbookStore';
import { useCashWorkbookStore } from '../store/cashWorkbookStore';
import { useInterEntityTransfersStore } from '../store/interEntityTransfersStore';
import { usePSXWorkbookStore } from '../store/psxWorkbookStore';
import { useRentalsWorkbookStore } from '../store/rentalsWorkbookStore';
import { useWorkbookStore } from '../store/workbookStore';
import { LINK_MODULE_LABELS, type InterEntityTransfer, type InterEntityTransferInput, type LinkModule } from '../types/interEntityTransfer';
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
    case 'rentals': return useRentalsWorkbookStore.getState().addEntry(side.record);
  }
}

export function dispatchUpdate(side: LinkSideRecord) {
  switch (side.module) {
    case 'cash': return useCashWorkbookStore.getState().updateEntry(side.record.id, side.record);
    case 'bank': return useBankWorkbookStore.getState().updateTransaction(side.record.id, side.record);
    case 'qse': return useWorkbookStore.getState().updateTransfer(side.record.id, side.record);
    case 'psx': return usePSXWorkbookStore.getState().updateTransfer(side.record.id, side.record);
    case 'rentals': return useRentalsWorkbookStore.getState().updateEntry(side.record.id, side.record);
  }
}

export function dispatchRemove(module: LinkModule, id: string) {
  switch (module) {
    case 'cash': return useCashWorkbookStore.getState().deleteEntry(id);
    case 'bank': return useBankWorkbookStore.getState().deleteTransaction(id);
    case 'qse': return useWorkbookStore.getState().deleteTransfer(id);
    case 'psx': return usePSXWorkbookStore.getState().deleteTransfer(id);
    case 'rentals': return useRentalsWorkbookStore.getState().deleteEntry(id);
  }
}

/** Creates a linked transfer's two side records + the link record itself.
 * Code-review finding (PR #2): the three writes below aren't a real
 * database transaction — there's no way to make a client-only app with
 * per-store localStorage + independently-debounced Firebase pushes
 * genuinely atomic. What this *can* do, and does: if the second side
 * record's write throws, it rolls back the first one rather than leaving
 * a one-sided orphan and reporting success. In practice none of the store
 * actions here throw synchronously (persistence failures are caught and
 * logged inside each store, not surfaced) — this is defense-in-depth for
 * if that ever changes, not a claim of full transactional safety. */
export function createLinkedTransfer(input: InterEntityTransferInput): { link: InterEntityTransfer } | { error: string } {
  const ids = { linkId: crypto.randomUUID(), fromRecordId: crypto.randomUUID(), toRecordId: crypto.randomUUID() };
  let fromModule: LinkSideRecord['module'] | undefined;
  try {
    const { from, to, link } = buildLinkedRecords(input, ids);
    dispatchAdd(from);
    fromModule = from.module;
    dispatchAdd(to);
    useInterEntityTransfersStore.getState().addEntry(link);
    return { link };
  } catch (e) {
    if (fromModule) {
      try {
        dispatchRemove(fromModule, ids.fromRecordId);
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
 * Known remaining gap, not fixed here: *editing* (not deleting) a linked
 * record's amount/date directly in its native module still doesn't
 * propagate to the other side or the link record. Full correctness there
 * would mean every edit form knowing it's editing a linked record and
 * either blocking the edit or redirecting to the Transfers page — a larger
 * UI change than this fix, and not attempted silently. */
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
