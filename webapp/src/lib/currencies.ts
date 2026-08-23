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
