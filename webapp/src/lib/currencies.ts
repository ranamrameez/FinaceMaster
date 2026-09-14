/** Shared currency list for the new (non-stock-exchange) modules — covers
 * the primary user base: US, EU, GCC, and Pakistan (see MODULES_PLAN.md).
 * QSE/PSX keep their own free-text currency field (a trading account has
 * exactly one currency, chosen once); modules like Cash track currency
 * per-entry, so a picker with a real symbol is worth it here. */
export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'SAR', symbol: 'SAR ' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'QAR', symbol: 'QAR ' },
  { code: 'KWD', symbol: 'KWD ' },
  { code: 'BHD', symbol: 'BHD ' },
  { code: 'OMR', symbol: 'OMR ' },
  { code: 'PKR', symbol: '₨' },
  { code: 'INR', symbol: '₹' },
] as const;

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code + ' ';
}

/** Reverse of each currency's own "primary financial center" timezone —
 * used only to GUESS a sensible default currency from the browser's own
 * timezone (see `detectPrimaryCurrency` below). Deliberately its own small
 * table, not a shared import from `lib/datetime.ts`'s own (much larger,
 * ~25-currency) `CURRENCY_TIMEZONES` — that one exists for a different job
 * (defaulting a record's TIMEZONE field) and covers currencies this app
 * doesn't even offer in `CURRENCIES` above; keeping this scoped to just
 * the 11 currencies this file actually knows about avoids coupling two
 * otherwise-independent leaf modules together for one lookup. */
const TIMEZONE_TO_CURRENCY: Record<string, string> = {
  'America/New_York': 'USD',
  'Europe/London': 'GBP',
  'Europe/Berlin': 'EUR',
  'Asia/Qatar': 'QAR',
  'Asia/Karachi': 'PKR',
  'Asia/Riyadh': 'SAR',
  'Asia/Dubai': 'AED',
  'Asia/Kuwait': 'KWD',
  'Asia/Bahrain': 'BHD',
  'Asia/Muscat': 'OMR',
  'Asia/Kolkata': 'INR',
};

/** User-requested (2026-09-14): "ONE PRIMARY CURRENCY DEFAULT BASED ON
 * USER TIMEZONE/LOCATION" — guesses which of this app's own 11 currencies
 * a visitor most likely deals in, from the browser's own IANA timezone
 * (`Intl.DateTimeFormat` — no live geolocation/IP lookup, consistent with
 * this app's locked "no live third-party API calls" design). Falls back
 * to USD for a timezone with no match (most of the world isn't one of the
 * 11 currencies this app offers) — a widely-understood default rather
 * than leaving nothing selected. */
export function detectPrimaryCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_TO_CURRENCY[tz] ?? 'USD';
  } catch {
    return 'USD';
  }
}
