import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { SaveIcon, XIcon } from './icons';

/** Shared popup shell for editing a Finance-based record (Cash/Bank/
 * Rentals) — user-requested (2026-09-03): "Editing should be done in a
 * popup (may use single add/edit form) to ensure UI consistency," a direct
 * response to the same "editing UIs are missing some fields" gap that
 * motivated the whole Finance restructure (an inline table-row edit had
 * quietly drifted out of sync with its own module's add form — e.g. no
 * time/timezone editing even though adding one captures both). Each
 * module still owns its own specific fields (Bank's description, Cash/
 * Rentals' direction toggle) as `children` — this shell only provides the
 * common popup chrome + Save/Cancel, the same pattern every other
 * add/edit `Modal` in this app already follows. */
export function FinanceEditModal({
  titleText,
  onClose,
  onSave,
  children,
}: {
  titleText: string;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <Modal title={titleText} onClose={onClose}>
      {children}
      <div className="row" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="btn secondary" onClick={onClose}><XIcon size={12} />Cancel</button>
        <button className="btn" onClick={onSave}><SaveIcon size={12} />Save</button>
      </div>
    </Modal>
  );
}
