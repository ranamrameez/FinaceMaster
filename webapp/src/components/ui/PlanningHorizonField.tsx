import { PLANNING_HORIZON_OPTIONS, type PlanningHorizonDays } from '../../lib/calc/plannedBalance';
import { Field, Select } from './Field';

/** Shared control for every "Balance projection"/plan-list view (Cash,
 * Bank, Credit Card) — one picker, one set of options, one default (30
 * days, "This month"). User-reported (2026-09-20): before this, a Balance
 * projection summed EVERY not-yet-done plan regardless of date, so a plan
 * dated years out silently distorted a number meant to read as "soon" —
 * fixed by defaulting every caller's own horizon state to 30, with this
 * picker as the escape hatch to widen (or remove) the window. */
export function PlanningHorizonField({
  value,
  onChange,
  width = 150,
}: {
  value: PlanningHorizonDays;
  onChange: (v: PlanningHorizonDays) => void;
  width?: number;
}) {
  return (
    <Field
      label="Time period"
      width={width}
      title="Limits which not-yet-done plans count toward the totals and list below — a plan dated further out than this won't show until it's closer, so today's real balance never gets mixed with a plan from far in the future. Already-overdue plans always show, regardless of this setting."
    >
      <Select
        value={value === null ? 'all' : String(value)}
        onChange={(e) => onChange(e.target.value === 'all' ? null : (Number(e.target.value) as PlanningHorizonDays))}
      >
        {PLANNING_HORIZON_OPTIONS.map((o) => (
          <option key={o.value === null ? 'all' : o.value} value={o.value === null ? 'all' : o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
