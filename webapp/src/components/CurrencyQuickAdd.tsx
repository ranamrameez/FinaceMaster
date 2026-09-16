import { useId, useState } from 'react';
import { CURRENCIES } from '../lib/currencies';
import { toast } from './Toast';

/** A type-to-add currency picker — user-requested (2026-09-16, in the same
 * message as the "Reset to all currencies" complaint): "in DB save a list
 * of all currencies and let the user choose for his currency or more
 * simply let the user type his currency(ies)." Suggests from the bundled
 * `CURRENCIES` reference list via a native `<datalist>` (typing "yen" or
 * "JPY" both surface it — a datalist's suggestion row shows the option's
 * own text, and a click sets the input to its `value` attribute, which is
 * the code, not the name), but also accepts ANY plausible 3-letter code
 * typed directly and never submitted from the list — a currency this app's
 * bundled list doesn't happen to cover isn't blocked, matching
 * `useEnabledCurrencies`'s own existing "never hide a currency the user's
 * real data already uses, even one outside CURRENCIES" principle.
 *
 * Shared by the Account page's Currencies section and the first-run
 * currency-onboarding modal so there's one implementation, not two —
 * `useId()` keeps each instance's own `<datalist>` id collision-free even
 * if (unlikely, but possible) two were ever rendered on the same page at
 * once. */
export function CurrencyQuickAdd({
  onAdd,
  excludeCodes = [],
}: {
  onAdd: (code: string) => void;
  excludeCodes?: string[];
}) {
  const [value, setValue] = useState('');
  const listId = useId();
  const suggestions = CURRENCIES.filter((c) => !excludeCodes.includes(c.code));

  const submit = () => {
    const code = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      toast('Enter a 3-letter currency code, e.g. JPY.');
      return;
    }
    onAdd(code);
    setValue('');
  };

  return (
    <form
      className="row"
      style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        list={listId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a currency (code or name, e.g. JPY / Yen)"
        style={{ width: 240 }}
      />
      <datalist id={listId}>
        {suggestions.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </datalist>
      <button type="submit" className="btn secondary small">
        Add
      </button>
    </form>
  );
}
