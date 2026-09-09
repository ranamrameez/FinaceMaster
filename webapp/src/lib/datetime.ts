/** Pending item 41: "every transaction-like record should carry a real
 * time, not just a date, for true chronological ordering" — plus the
 * user's own follow-up: missing time backfills to 12:00, and the timezone
 * selector should default to whatever's appropriate for that record's
 * market or currency, not force the user to pick one from scratch every
 * time. This file is the one shared place that knows how to turn a
 * date+time+timezone into a real comparable instant, and how to guess a
 * sensible default timezone — every module reuses it rather than rolling
 * its own date math. */

/** The two stock exchanges this app tracks have one obvious timezone
 * each — the market's own. */
export const MARKET_TIMEZONES: Record<'QSE' | 'PSX', string> = {
  QSE: 'Asia/Qatar',
  PSX: 'Asia/Karachi',
};

/** Everything else (Cash/Bank/Personal Loans/Rentals/Funds/Subscriptions)
 * has a currency but no single "market" — default to that currency's own
 * primary financial center. Deliberately a plain lookup table, not a
 * library: this app already prefers small hand-rolled utilities
 * (Sparkline, csv.ts, xirr.ts) over new dependencies for exactly this kind
 * of bounded, rarely-changing data. Covers every currency already offered
 * in `lib/currencies.ts` plus QSE/PSX's own. Falls back to the browser's
 * own local timezone for anything not listed (see
 * `defaultTimezoneForCurrency` below), so an unlisted currency degrades to
 * "assume the user's own timezone," not an error. */
const CURRENCY_TIMEZONES: Record<string, string> = {
  USD: 'America/New_York',
  GBP: 'Europe/London',
  EUR: 'Europe/Berlin',
  QAR: 'Asia/Qatar',
  PKR: 'Asia/Karachi',
  SAR: 'Asia/Riyadh',
  AED: 'Asia/Dubai',
  KWD: 'Asia/Kuwait',
  BHD: 'Asia/Bahrain',
  OMR: 'Asia/Muscat',
  INR: 'Asia/Kolkata',
  JPY: 'Asia/Tokyo',
  CNY: 'Asia/Shanghai',
  HKD: 'Asia/Hong_Kong',
  SGD: 'Asia/Singapore',
  MYR: 'Asia/Kuala_Lumpur',
  IDR: 'Asia/Jakarta',
  THB: 'Asia/Bangkok',
  AUD: 'Australia/Sydney',
  NZD: 'Pacific/Auckland',
  CAD: 'America/Toronto',
  CHF: 'Europe/Zurich',
  TRY: 'Europe/Istanbul',
  ZAR: 'Africa/Johannesburg',
  EGP: 'Africa/Cairo',
  BRL: 'America/Sao_Paulo',
  MXN: 'America/Mexico_City',
};

/** Every timezone this file already knows how to default to, deduped, for
 * populating a `<datalist>` next to a free-text timezone field — a full
 * ~400-entry IANA list would be more noise than help, so this sticks to
 * the markets/currencies this app actually knows about, plus the viewer's
 * own local timezone so it's always offered even for an unlisted currency. */
export function commonTimezones(): string[] {
  return [...new Set([...Object.values(MARKET_TIMEZONES), ...Object.values(CURRENCY_TIMEZONES), browserTimezone()])].sort();
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function defaultTimezoneForMarket(market: 'QSE' | 'PSX'): string {
  return MARKET_TIMEZONES[market];
}

export function defaultTimezoneForCurrency(currency: string | undefined): string {
  if (currency && CURRENCY_TIMEZONES[currency.toUpperCase()]) return CURRENCY_TIMEZONES[currency.toUpperCase()];
  return browserTimezone();
}

/** Current wall-clock time on the user's OWN machine, `HH:MM` — the
 * default for a fresh add-form's optional Time field. User-reported:
 * "let the user enter minimum data and fill most by default (pick
 * timestamps from user machine...)" — every add-form's Date field already
 * defaults to today(), but most of them left Time blank, requiring the
 * user to type it by hand for an entry that's really happening right now.
 * Still freely editable/clearable for a backdated entry — this only sets
 * the initial value, same as `today()` does for Date. Deliberately NOT
 * used to backfill an EDIT form's existing `time` — a record that never
 * had a time recorded should keep reading as "unset," not silently gain
 * "right now" every time its edit modal happens to be reopened. */
export function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

/** True when `date` is today's real calendar date. */
export function isToday(date: string): boolean {
  return date === new Date().toISOString().slice(0, 10);
}

/** User-reported (2026-09-08): "Some transactions are not showing up down
 * arrows" — the same-day reorder buttons (`useTieGroupReorder.ts`) only
 * ever appear for two records that tie on the exact same real instant,
 * but `nowTime()`'s own auto-fill (above) stamps a NEW row with whatever
 * the wall clock happens to read the moment the row is created — and
 * every add-form's Date field defaults to today but stays freely
 * editable, so backdating it does NOT re-sync `time`. Two genuinely
 * same-day, order-unknown BACKDATED entries typed minutes apart therefore
 * get two arbitrary, different `time` values and can never tie — exactly
 * defeating the reorder feature for the very scenario it exists for (a
 * transaction logged later, same day, real order unknown).
 *
 * Call this from a form's own Date-field `onChange`, only while the user
 * hasn't manually edited Time themselves (same "only ever nudge forward,
 * reset explicitly on the one real transition, never clobber a real
 * user edit" discipline this codebase already uses elsewhere — see
 * `psxFees.ts`'s `autoSameDay()`): re-stamp with `nowTime()` when the
 * NEW date is today (this row really is happening right now), or clear
 * back to `undefined` when it's backdated (the real time is unknown —
 * falls back to `DEFAULT_TIME`/noon, restoring same-day tie eligibility
 * for the whole point of the reorder feature). */
export function defaultTimeForDate(date: string): string | undefined {
  return isToday(date) ? nowTime() : undefined;
}

/** A record without a stored time backfills to noon — the user's own
 * explicit choice: a neutral middle-of-the-day placeholder rather than
 * midnight (which would visually suggest "very early," and would sort
 * every backfilled record before any same-day record that DOES have a
 * real recorded time, which is backwards — noon plants old records in the
 * middle of the day, roughly where "sometime that day, we don't know
 * when" belongs). */
export const DEFAULT_TIME = '12:00';

/** IANA-timezone-aware wall-clock -> instant conversion, dependency-free.
 * `Date.UTC` only ever builds a UTC instant; to find the instant that
 * reads as `date`+`time` in some OTHER timezone, first guess assuming UTC,
 * then ask `Intl.DateTimeFormat` what that guess actually reads as in the
 * target zone, and correct by the difference. One correction pass is
 * enough for every real IANA zone (they don't shift by more than a
 * fraction of a day between two nearby instants), which is why this
 * doesn't loop. */
function offsetMinutesAt(instant: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  dtf.formatToParts(new Date(instant)).forEach((p) => { parts[p.type] = p.value; });
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUTC - instant) / 60000;
}

/** User-reported (2026-09-08), a follow-up to `defaultTimeForDate` above:
 * "NOT ALL TRANSACTIONS showing movement arrows. some transactions need
 * reordering for same date." `defaultTimeForDate` fixed the most common
 * cause (a fresh row's `nowTime()` stamp going stale after backdating the
 * Date field), but two records that both got a REAL, DIFFERENT time — one
 * genuinely entered at 9am, another at 3pm the same day, in whatever real
 * order the user typed them — still never tie under `toInstantMs`, even
 * though the user may still not know which one actually happened first in
 * real life and wants to fix their relative order. The user's own ask is
 * explicitly for same-CALENDAR-DATE reordering, a strictly broader
 * relaxation than same-instant: this key drops time/timezone entirely, so
 * every record dated the same day ties for reorder purposes regardless of
 * what time each happens to carry. The display ledgers that offer
 * `ReorderButtons` sort by this (with `seq`/`serialNumber` as the sole
 * same-day tie-break) instead of `toInstantMs`, so a reorder move actually
 * changes the visible order, not just tie-eligibility. Deliberately NOT
 * used by the core calc engine's own `sortTransactionsChronological`
 * (`lib/calc/sortTransactions.ts`) — FIFO lot matching and realized P&L
 * need the finer, real-instant + BUY-before-SELL ordering for financial
 * correctness (Done item 128); this coarser date-only key is only for
 * DISPLAY ledgers with a reorder control, never the position/P&L math. */
export function dateOnlyMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

/** Combines a date/time/timezone into a real epoch-ms instant, safe to
 * compare across records. Missing `time` backfills to `DEFAULT_TIME`;
 * missing `timezone` falls back to UTC — deliberately, not the browser's
 * timezone, so two different sessions viewing the same un-timezoned old
 * record always compute the identical instant (a per-viewer fallback
 * would make sort order viewer-dependent, which is worse than a fixed,
 * arbitrary-but-consistent one). */
export function toInstantMs(date: string, time?: string, timezone?: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || DEFAULT_TIME).split(':').map(Number);
  const tz = timezone || 'UTC';
  const naiveUTC = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  if (tz === 'UTC') return naiveUTC;
  const offset = offsetMinutesAt(naiveUTC, tz);
  return naiveUTC - offset * 60000;
}
