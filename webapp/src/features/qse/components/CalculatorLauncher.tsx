import { useState } from 'react';
import { Modal } from '../../../components/Modal';
import { TradeCalculator } from './TradeCalculator';

/** Trade Calculator as an on-demand popup instead of a permanent block on
 * the Dashboard — available from anywhere via this floating button, opened
 * only when actually needed. */
export function CalculatorLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="btn"
        onClick={() => setOpen(true)}
        title="Trade calculator"
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          borderRadius: 999,
          padding: '12px 20px',
          boxShadow: '0 4px 16px rgba(0,0,0,.25)',
          zIndex: 500,
        }}
      >
        🧮 Calculator
      </button>
      {open && (
        <Modal title="Trade Calculator" onClose={() => setOpen(false)}>
          <TradeCalculator />
        </Modal>
      )}
    </>
  );
}
