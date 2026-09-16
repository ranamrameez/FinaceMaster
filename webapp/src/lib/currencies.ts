/** Shared currency reference list for the non-stock-exchange modules and the
 * Account page's Currencies picker. QSE/PSX keep their own free-text
 * currency field (a trading account has exactly one currency, chosen once);
 * modules like Cash track currency per-entry, so a real picker is worth it
 * here.
 *
 * Expanded 2026-09-16 from an original 11-currency (US/EU/GCC/Pakistan/
 * India-only) set to ~50 real, common world currencies, per a direct user
 * complaint: "no one is going to work only these currencies... save a list
 * of all currencies." This is a static bundled reference, not a literal
 * database — consistent with this app's own locked "no live third-party API
 * calls" design (see CLAUDE.md) — and it isn't meant to be exhaustive
 * (ISO-4217 has ~180 codes); it's a broad, genuinely useful common set. A
 * currency this list still doesn't cover is never a hard wall: every
 * consumer of this list (`useEnabledCurrencies`, `CurrencyQuickAdd`) already
 * accepts an arbitrary user-typed code outside it, falling back to a plain
 * "CODE " symbol. `name` is used by `CurrencyQuickAdd`'s type-ahead
 * suggestions (so typing "yen" finds JPY) — not shown elsewhere today. */
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal' },
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham' },
  { code: 'QAR', symbol: 'QAR ', name: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'KWD ', name: 'Kuwaiti Dinar' },
  { code: 'BHD', symbol: 'BHD ', name: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'OMR ', name: 'Omani Rial' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar' },
  { code: 'HKD', symbol: '$', name: 'Hong Kong Dollar' },
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'SEK ', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'NOK ', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'DKK ', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'PLN ', name: 'Polish Zloty' },
  { code: 'CZK', symbol: 'CZK ', name: 'Czech Koruna' },
  { code: 'HUF', symbol: 'HUF ', name: 'Hungarian Forint' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'EGP', symbol: 'EGP ', name: 'Egyptian Pound' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'KES', symbol: 'KES ', name: 'Kenyan Shilling' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'LKR', symbol: 'Rs ', name: 'Sri Lankan Rupee' },
  { code: 'NPR', symbol: 'Rs ', name: 'Nepalese Rupee' },
  { code: 'JOD', symbol: 'JOD ', name: 'Jordanian Dinar' },
  { code: 'LBP', symbol: 'LBP ', name: 'Lebanese Pound' },
  { code: 'IQD', symbol: 'IQD ', name: 'Iraqi Dinar' },
  { code: 'AFN', symbol: '؋', name: 'Afghan Afghani' },
] as const;

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code + ' ';
}

/** Reverse of each currency's own "primary financial center" timezone —
 * used only to GUESS a sensible default currency from the browser's own
 * timezone (see `detectPrimaryCurrency` below). Deliberately its own small
 * table, not a shared import from `lib/datetime.ts`'s own (much larger,
 * ~25-currency) `CURRENCY_TIMEZONES` — that one exists for a different job
 * (defaulting a record's TIMEZONE field). Not exhaustive — covers every
 * currency in `CURRENCIES` above that has one obvious representative
 * timezone; a handful of Europe/EUR-zone cities beyond Berlin were already
 * a pre-existing gap and aren't this list's job to fully solve. */
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
  'Asia/Tokyo': 'JPY',
  'Asia/Shanghai': 'CNY',
  'Asia/Seoul': 'KRW',
  'Asia/Taipei': 'TWD',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Singapore': 'SGD',
  'Australia/Sydney': 'AUD',
  'Pacific/Auckland': 'NZD',
  'America/Toronto': 'CAD',
  'Europe/Zurich': 'CHF',
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK',
  'Europe/Warsaw': 'PLN',
  'Europe/Prague': 'CZK',
  'Europe/Budapest': 'HUF',
  'Europe/Moscow': 'RUB',
  'Europe/Istanbul': 'TRY',
  'Asia/Jerusalem': 'ILS',
  'Africa/Johannesburg': 'ZAR',
  'Africa/Cairo': 'EGP',
  'Africa/Lagos': 'NGN',
  'Africa/Nairobi': 'KES',
  'America/Sao_Paulo': 'BRL',
  'America/Mexico_City': 'MXN',
  'America/Argentina/Buenos_Aires': 'ARS',
  'Asia/Bangkok': 'THB',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Jakarta': 'IDR',
  'Asia/Manila': 'PHP',
  'Asia/Ho_Chi_Minh': 'VND',
  'Asia/Dhaka': 'BDT',
  'Asia/Colombo': 'LKR',
  'Asia/Kathmandu': 'NPR',
  'Asia/Amman': 'JOD',
  'Asia/Beirut': 'LBP',
  'Asia/Baghdad': 'IQD',
  'Asia/Kabul': 'AFN',
};

/** User-requested (2026-09-14): "ONE PRIMARY CURRENCY DEFAULT BASED ON
 * USER TIMEZONE/LOCATION" — guesses which currency a visitor most likely
 * deals in, from the browser's own IANA timezone (`Intl.DateTimeFormat` —
 * no live geolocation/IP lookup, consistent with this app's locked "no
 * live third-party API calls" design). Falls back to USD for a timezone
 * with no match — a widely-understood default rather than leaving nothing
 * selected. */
export function detectPrimaryCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_TO_CURRENCY[tz] ?? 'USD';
  } catch {
    return 'USD';
  }
}
