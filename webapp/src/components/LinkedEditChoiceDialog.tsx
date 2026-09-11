import { create } from 'zustand';
import { Modal } from './Modal';

export type LinkedEditChoice = 'this' | 'both' | 'cancel';

interface LinkedEditChoiceState {
  otherModuleLabel: string | null;
  resolve: ((v: LinkedEditChoice) => void) | null;
}

const useLinkedEditChoiceStore = create<LinkedEditChoiceState>(() => ({ otherModuleLabel: null, resolve: null }));

/** Replaces the old plain confirm-dialog gate on editing a linked record
 * (`warnIfLinked`'s original behavior) — user-reported (2026-09-11): that
 * dialog's own copy told the user to "use the Transfers page instead for a
 * fully-synced edit," but the standalone Transfers page was removed
 * app-wide (README Done item 216, replaced by the FAB + shared popup
 * mechanism) — the instruction pointed at a page that no longer exists.
 * Rather than just reword the dialog, this gives the user the ACTUAL
 * fully-synced option right here: a three-way choice (cancel / this side
 * only / both sides), with "both sides" now genuinely wired up via
 * `lib/linkCascade.ts`'s `propagateLinkedEdit` instead of only being
 * possible from a page that isn't there anymore. */
export function linkedEditChoiceDialog(otherModuleLabel: string): Promise<LinkedEditChoice> {
  return new Promise((resolve) => {
    useLinkedEditChoiceStore.setState({ otherModuleLabel, resolve });
  });
}

export function LinkedEditChoiceDialogHost() {
  const { otherModuleLabel, resolve } = useLinkedEditChoiceStore();
  if (!otherModuleLabel) return null;

  const close = (choice: LinkedEditChoice) => {
    resolve?.(choice);
    useLinkedEditChoiceStore.setState({ otherModuleLabel: null, resolve: null });
  };

  return (
    <Modal title="Edit linked entry" onClose={() => close('cancel')} zIndex={300}>
      <p>
        This entry is linked to a transfer with {otherModuleLabel}. Editing it as "this side only" leaves the
        other side and the link record unchanged — pick "both sides" to update the linked entry to match.
      </p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn secondary" onClick={() => close('cancel')}>
          Cancel
        </button>
        <button className="btn secondary" onClick={() => close('this')}>
          This side only
        </button>
        <button className="btn" onClick={() => close('both')}>
          Both sides
        </button>
      </div>
    </Modal>
  );
}
