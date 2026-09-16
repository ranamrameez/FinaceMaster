import { useState } from 'react';
import { useEnabledCurrencies } from '../../hooks/useEnabledCurrencies';
import { useEnabledCurrenciesStore } from '../../store/enabledCurrenciesStore';

const PROMINENT_TIER_SIZE = 2; // Primary + Secondary, per the 2026-09-16 currency-tier design.

/** User-requested (2026-09-14): "in all app currency selectors (start with
 * Transfers) only the user preferred currencies should be listed (use
 * chips instead of drop downs)." A currency picker built from
 * `useEnabledCurrencies()` (so it's always filtered to the account's own
 * chosen subset — falling back to every currency only when nothing's been
 * configured — plus the field's own already-selected value even if it
 * falls outside that subset, per that hook's own doc comment) rendered as
 * `.chip`/`.chip.active` buttons instead of a `<select>`, matching every
 * other single-choice picker already converted this way
 * (`DirectionChips`, `ChartFilterBar`'s ticker filter).
 *
 * "Prominence in currency pickers app-wide" (2026-09-16, one of the three
 * controls the user confirmed for the Primary/Secondary/Other tier design
 * — see `useEnabledCurrencies`' own doc comment): the user's ranked
 * Primary + Secondary currencies are always shown; anything ranked below
 * that ("Other") collapses behind a "+N more" chip, expanding automatically
 * if the field's own current value happens to be one of them (never hides
 * an already-selected value). Only kicks in once the user has actually
 * ranked more than 2 currencies — an unconfigured account (`enabledCodes
 * === null`) or a single/dual-currency one has nothing worth collapsing,
 * matching the user's own "single currency user doesn't need complexity"
 * instruction. */
export function CurrencyChips({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const options = useEnabledCurrencies(value);
  const enabledCodes = useEnabledCurrenciesStore((s) => s.enabledCodes);
  const [expanded, setExpanded] = useState(false);

  const hasTiers = enabledCodes !== null && enabledCodes.length > PROMINENT_TIER_SIZE;
  const activeIsCollapsed = hasTiers && options.findIndex((c) => c.code === value) >= PROMINENT_TIER_SIZE;
  const showAll = !hasTiers || expanded || activeIsCollapsed;
  const visible = showAll ? options : options.slice(0, PROMINENT_TIER_SIZE);
  const hiddenCount = options.length - visible.length;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map((c) => (
        <button
          key={c.code}
          type="button"
          className={`chip${value === c.code ? ' active' : ''}`}
          onClick={() => onChange(c.code)}
        >
          {c.code}
        </button>
      ))}
      {!showAll && hiddenCount > 0 && (
        <button type="button" className="chip" onClick={() => setExpanded(true)}>
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}
