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
  /** Overrides the shared `.modal-overlay`'s default z-index. */
  zIndex?: number;
  /** Overrides `.modal-box`'s default width cap. */
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
        <div className="modal-header d-flex justify-between align-center">
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
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
