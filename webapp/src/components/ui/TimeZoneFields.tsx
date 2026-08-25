import { commonTimezones } from '../../lib/datetime';
import { Field, TextInput } from './Field';

/** Pending item 41: an optional Time + Timezone pair, dropped alongside any
 * add-form's existing Date field. A record with nothing entered here just
 * falls back to noon UTC for sorting (see `lib/datetime.ts`) — this is
 * purely for a user who wants finer same-day ordering than the date alone
 * gives them, never a required field. One shared component so every
 * module's add-form wires this up the same way instead of re-inventing
 * the pair of inputs and the timezone datalist per call site. */
export function TimeZoneFields({
  time,
  timezone,
  onTimeChange,
  onTimezoneChange,
}: {
  time: string | undefined;
  timezone: string | undefined;
  onTimeChange: (time: string | undefined) => void;
  onTimezoneChange: (timezone: string | undefined) => void;
}) {
  return (
    <>
      <Field label="Time (optional)" width={110} title="Defaults to noon if left blank — only matters for sorting same-day entries in the exact order they happened.">
        <TextInput type="time" value={time || ''} onChange={(e) => onTimeChange(e.target.value || undefined)} />
      </Field>
      <Field label="Timezone" width={190} title="Prefilled for you — change it if this entry actually happened somewhere else.">
        <TextInput
          list="tz-options-datalist"
          value={timezone || ''}
          onChange={(e) => onTimezoneChange(e.target.value || undefined)}
          placeholder="e.g. Asia/Karachi"
        />
      </Field>
      <datalist id="tz-options-datalist">
        {commonTimezones().map((tz) => <option key={tz} value={tz} />)}
      </datalist>
    </>
  );
}
