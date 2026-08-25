import { create } from 'zustand';
import { Modal } from './Modal';

interface ConfirmState {
  message: string | null;
  title: string;
  resolve: ((v: boolean) => void) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({ message: null, title: 'Confirm', resolve: null }));

/** In-app replacement for `window.confirm()` — native dialogs are blocked
 * or auto-dismissed in some browsers/webviews (this is what caused the
 * "stuck on login" bug: clicking "Continue without an account" opened a
 * confirm() that never resolved true, so the click appeared to do
 * nothing). Use this everywhere a destructive/one-way action needs
 * confirmation instead. */
export function confirmDialog(message: string, title = 'Confirm'): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.setState({ message, title, resolve });
  });
}

export function ConfirmDialogHost() {
  const { message, title, resolve } = useConfirmStore();
  if (!message) return null;

  const close = (result: boolean) => {
    resolve?.(result);
    useConfirmStore.setState({ message: null, resolve: null });
  };

  return (
    <Modal title={title} onClose={() => close(false)} zIndex={300}>
      <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn secondary" onClick={() => close(false)}>
          Cancel
        </button>
        <button className="btn" onClick={() => close(true)}>
          Confirm
        </button>
      </div>
    </Modal>
  );
}
