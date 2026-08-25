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
