import { useEnabledCurrencies } from '../../hooks/useEnabledCurrencies';

/** User-requested (2026-09-14): "in all app currency selectors (start with
 * Transfers) only the user preferred currencies should be listed (use
 * chips instead of drop downs)." A currency picker built from
 * `useEnabledCurrencies()` (so it's always filtered to the account's own
 * chosen subset — falling back to every currency only when nothing's been
 * configured — plus the field's own already-selected value even if it
 * falls outside that subset, per that hook's own doc comment) rendered as
 * `.chip`/`.chip.active` buttons instead of a `<select>`, matching every
 * other single-choice picker already converted this way
 * (`DirectionChips`, `ChartFilterBar`'s ticker filter). */
export function CurrencyChips({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const options = useEnabledCurrencies(value);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((c) => (
        <button
          key={c.code}
          type="button"
          className={`chip${value === c.code ? ' active' : ''}`}
          onClick={() => onChange(c.code)}
        >
          {c.code}
        </button>
      ))}
    </div>
  );
}
