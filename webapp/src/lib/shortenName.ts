/** Trims common corporate suffixes and caps length for compact table
 * display — "Mesaieed Petrochemical Holding" reads fine as "Mesaieed
 * Petrochemical", table cells don't need "Holding Company Limited" etc. */
const SUFFIXES = [
  /\b(Holding Company|Holding Group|Holding|Company Limited|Company|Corporation|Corp|Group|Limited|Ltd|Inc|PLC|PJSC|QPSC)\.?\s*$/i,
];

export function shortenCompanyName(name: string, maxLen = 22): string {
  let s = name.trim();
  for (const re of SUFFIXES) {
    const next = s.replace(re, '').trim();
    if (next && next !== s) {
      s = next;
      break;
    }
  }
  if (s.length > maxLen) {
    s = s.slice(0, maxLen - 1).trimEnd() + '…';
  }
  return s;
}
