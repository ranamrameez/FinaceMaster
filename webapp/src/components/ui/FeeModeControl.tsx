import type { Transaction } from '../../types/workbook';

export type FeeMode = 'auto' | 'semi' | 'manual';

/** A transaction's fee mode is derived from which of its two optional
 * fields is set — never stored separately, so there's no way for the mode
 * and the underlying data to drift apart. */
export function feeModeFor(tx: Pick<Transaction, 'manualSameDay' | 'feeOverride'>): FeeMode {
  if (tx.feeOverride !== undefined) return 'manual';
  if (tx.manualSameDay !== undefined) return 'semi';
  return 'auto';
}

/** User-reported confusion: the same-day checkbox and the fee-override
 * field were two independent controls that could both be filled in at
 * once (feeOverride wins, silently ignoring a checked same-day box), and
 * neither showed the other was irrelevant once set — "fee isn't
 * auto-calculating due to same day check." This single selector makes the
 * three fee-determination modes explicit and mutually exclusive: **Auto**
 * (fully computed from Settings — same-day netting still auto-detected
 * from the transaction log), **Semi** (you decide whether *this* leg
 * counts as the netted side, but the amount is still computed from
 * Settings), and **Manual** (you type the exact fee from your statement,
 * bypassing computation entirely). Switching modes clears whichever
 * field the new mode doesn't use, so the two can never conflict. */
export function FeeModeControl({
  mode,
  onModeChange,
  manualSameDay,
  onManualSameDayChange,
  feeOverride,
  onFeeOverrideChange,
}: {
  mode: FeeMode;
  onModeChange: (mode: FeeMode) => void;
  manualSameDay: boolean;
  onManualSameDayChange: (value: boolean) => void;
  feeOverride: number | undefined;
  onFeeOverrideChange: (value: number | undefined) => void;
}) {
  return (
    <div className="row" style={{ gap: 6, alignItems: 'center', flex: '0 0 auto' }}>
      <select
        value={mode}
        onChange={(e) => onModeChange(e.target.value as FeeMode)}
        title="Auto: fee fully computed from Settings, same-day netting auto-detected. Semi: you decide whether this leg is the same-day-netted one, amount still computed. Manual: type the exact fee from your statement."
        style={{ width: 92 }}
      >
        <option value="auto">Auto fee</option>
        <option value="semi">Semi</option>
        <option value="manual">Manual fee</option>
      </select>
      {mode === 'semi' && (
        <label
          className="footer-note"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          title="Checked: this leg pays government levies only (netted). Unchecked: this leg pays full commission (charged). Overrides auto-detection either way."
        >
          <input type="checkbox" checked={manualSameDay} onChange={(e) => onManualSameDayChange(e.target.checked)} />
          Netted
        </label>
      )}
      {mode === 'manual' && (
        <input
          type="number"
          step="0.01"
          className="price-input"
          placeholder="Fee amount"
          value={feeOverride ?? ''}
          onChange={(e) => onFeeOverrideChange(e.target.value === '' ? undefined : Number(e.target.value))}
          style={{ width: 110 }}
        />
      )}
    </div>
  );
}
