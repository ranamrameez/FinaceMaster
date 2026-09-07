import type { ReactNode } from 'react';

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
  /** Overrides `.modal-box`'s default `max-width:920px` — user-reported
   * (2026-09-07): a small form (e.g. the "Add a trade" popup — ticker/
   * action/shares/price, maybe a fee-mode control) looked oddly wide,
   * "winning the horizon," stretched almost edge to edge on a normal
   * desktop viewport for content that doesn't need anywhere near that
   * much room. Pass a CSS width value (e.g. a `clamp()`) for a popup whose
   * content is genuinely narrow; omit for the default 920px cap, which
   * stays right for wider content (a multi-column comparison, a table). */
  width?: string;
}) {
  return (
    <div className="modal-overlay show" style={zIndex ? { zIndex } : undefined} onClick={onClose}>
      <div className="modal-box" style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer',
              width: 28, height: 28, minWidth: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', fontSize: 18, lineHeight: 1, flex: '0 0 28px', padding: 0,
              transition: 'background .12s ease, transform .12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ✕
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}
