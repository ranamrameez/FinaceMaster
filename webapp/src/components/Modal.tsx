import { useState, type ReactNode } from 'react';
import { CollapseIcon, ExpandIcon } from './icons';

export function Modal({
  title,
  onClose,
  children,
  zIndex,
  width,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Overrides the shared `.modal-overlay`'s default z-index:100 — needed
   * for `ConfirmDialogHost`/`SignInModalHost`, which are mounted once near
   * the app root (before the routed page content in the DOM) but must
   * still render on top of whatever page-level Modal (e.g. Bank's
   * AccountDetailModal, Rentals' PropertyDetailModal) called
   * confirmDialog()/ensureSignedIn() from inside itself — without this,
   * two same-z-index `.modal-overlay`s stack by DOM order, and the
   * page-level one (mounted later, deeper in the tree) would paint on top,
   * burying the confirm/sign-in dialog's buttons underneath it and making
   * them unclickable. Same reasoning TermsGateModal already used its own
   * inline z-index:1000 for (see that component's own comment) — this
   * just gives every other `Modal` caller the same escape hatch. */
  zIndex?: number;
  /** Overrides `.modal-box`'s default width cap (UI_DESIGN_GUIDELINES.md:
   * popups open at no more than ~50% of the viewport by default). A whole
   * app-wide audit (2026-09-07) found every real `<Modal>` usage is a form
   * or entity-detail popup, never a table/wide-workspace — so this is an
   * escape hatch for a genuinely wide future case, not something any
   * current caller needs. Pass a CSS width value (e.g. a `clamp()`); the
   * user can still widen any modal via the full-screen toggle regardless. */
  width?: string;
}) {
  const [fullScreen, setFullScreen] = useState(false);
  return (
    <div className="modal-overlay show" style={zIndex ? { zIndex } : undefined} onClick={onClose}>
      <div
        className={`modal-box${fullScreen ? ' fullscreen' : ''}`}
        style={!fullScreen && width ? { maxWidth: width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-between align-center">
          <h3 className="m-0">{title}</h3>
          <div className="d-flex align-center" style={{ gap: 4 }}>
            <button
              aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
              title={fullScreen ? 'Exit full screen' : 'Full screen'}
              onClick={() => setFullScreen((v) => !v)}
              className="modal-icon-btn"
            >
              {fullScreen ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            <button aria-label="Close" title="Close" onClick={onClose} className="modal-icon-btn modal-icon-btn-close">
              ✕
            </button>
          </div>
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </div>
  );
}
