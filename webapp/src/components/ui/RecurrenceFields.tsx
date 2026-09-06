import type { RecurrenceCycle, RecurrenceRule } from '../../types/recurrence';
import { Field, Select, TextInput } from './Field';

/** A "One-off / Repeats" toggle plus cycle picker, shared by Cash's and
 * Bank's "Add a plan" forms (2026-09-07 — user-requested recurring-plan
 * support: "salary deposit on 28 each month, expected utility bills on
 * specific days"). `startDate` is the plan's own anchor date field (e.g.
 * "Expected date") — the caller keeps `recurrence.startDate` in sync with
 * it whenever that field changes, this component only toggles/edits the
 * cycle itself. */
export function RecurrenceFields({
  startDate,
  value,
  onChange,
}: {
  startDate: string;
  value: RecurrenceRule | undefined;
  onChange: (rule: RecurrenceRule | undefined) => void;
}) {
  const repeats = !!value;
  return (
    <>
      <Field label="Repeats?">
        <Select
          value={repeats ? 'yes' : 'no'}
          onChange={(e) => onChange(e.target.value === 'yes' ? { cycle: 'monthly', startDate } : undefined)}
          width={110}
        >
          <option value="no">One-off</option>
          <option value="yes">Repeats</option>
        </Select>
      </Field>
      {value && (
        <Field label="Every">
          <Select value={value.cycle} onChange={(e) => onChange({ ...value, cycle: e.target.value as RecurrenceCycle })} width={130}>
            <option value="monthly">Month</option>
            <option value="yearly">Year</option>
            <option value="weekly">Week</option>
            <option value="custom">Custom (days)</option>
          </Select>
        </Field>
      )}
      {value?.cycle === 'custom' && (
        <Field label="Days" width={80}>
          <TextInput type="number" min={1} value={value.customDays || ''} onChange={(e) => onChange({ ...value, customDays: Number(e.target.value) })} />
        </Field>
      )}
    </>
  );
}
