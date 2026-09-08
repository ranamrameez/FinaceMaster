import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { resolveNumericInput } from '../../lib/mathExpression';

/** User-requested (2026-09-08): "allow users to directly enter basic math
 * in the input boxes like a sheet rather than needing an external calc."
 * A drop-in replacement for `<TextInput type="number">` on an Amount-style
 * field — the browser's own native `type="number"` input REJECTS
 * characters like `+`/`*`/`(` outright, so accepting an expression means
 * using `type="text"` (with `inputMode="decimal"` to still get a
 * numeric-leaning mobile keyboard) and evaluating on blur/Enter, not on
 * every keystroke — an in-progress expression like `"10+"` isn't a valid
 * number yet, so committing it mid-type would be wrong. Same "own local
 * text state that holds exactly what's typed" pattern already established
 * for the Trade Calculator's Amount field, generalized into one shared
 * component instead of being re-solved per call site.
 *
 * `value`/`onChange` behave like a plain controlled number field from the
 * OUTSIDE — the caller only ever sees a resolved number, never the raw
 * typed text — but the actual commit (and any downstream effect that
 * depends on the value, e.g. an FX-conversion suggestion) only fires once
 * the user leaves the field or presses Enter, exactly like typing a
 * formula into a spreadsheet cell. An unresolvable expression is left
 * as-is in the field (not silently cleared) so the user can see and fix
 * their typo, and `onChange` simply isn't called until it resolves. */
export function AmountInput({
  value,
  onChange,
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [draft, setDraft] = useState(() => (value || value === 0 ? String(value) : ''));

  // Resync when the value changes for a reason OTHER than this field's own
  // commit (e.g. the caller reset the whole row/form) — a commit's own
  // onChange leads to the same value coming back here, which is a no-op.
  useEffect(() => {
    setDraft(value || value === 0 ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = () => {
    const resolved = resolveNumericInput(draft);
    if (resolved !== null) {
      setDraft(String(resolved));
      if (resolved !== value) onChange(resolved);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      {...rest}
    />
  );
}
