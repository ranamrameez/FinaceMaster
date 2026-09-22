export function fmt(n: number | undefined | null, dec = 3): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtMoney(n: number, currency: string): string {
  return `${fmt(n, 2)} ${currency}`;
}

/** Abbreviates a large magnitude (1,234,567 -> "1.23M") for compact display
 * in stat cards — full precision is still available separately (callers
 * pass the un-abbreviated `fmt`/`fmtMoney` string as a tooltip). Below
 * 1,000 this is identical to `fmt` (abbreviating "842" to anything shorter
 * isn't useful and would just look inconsistent next to prices that don't
 * abbreviate). Negative numbers abbreviate the same way, sign preserved. */
export function fmtCompact(n: number | undefined | null, dec = 2): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return fmt(n, 0);
  const sign = n < 0 ? '-' : '';
  const units: [number, string][] = [
    [1_000_000_000, 'B'],
    [1_000_000, 'M'],
    [1_000, 'k'],
  ];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      return `${sign}${scaled.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec })}${suffix}`;
    }
  }
  return fmt(n, 0);
}

export function fmtMoneyCompact(n: number, currency: string): string {
  return `${fmtCompact(n)} ${currency}`;
}

/** README item 3: QSE prices span a wide range (e.g. ~1-3 for some tickers,
 * ~20+ for others) and a fixed decimal count either truncates precision on
 * low-priced tickers or pads noise on high-priced ones. This formats to 4
 * significant digits, with a floor of 2 decimals — 2.155 and 21.55 both
 * carry 4 sig figs, and very small prices (e.g. 0.0025) still get extra
 * decimals to stay legible. The floor matters: a plain 4-sig-fig rule alone
 * rounds AWAY real precision the user actually entered once the price
 * clears 3 digits (123.456 -> "123.5", one decimal; 1234.5 -> "1235", zero)
 * — a real user-reported regression, since a manually-entered buy price
 * should never look less precise on screen than what was typed. Flooring
 * at 2 keeps that from happening for the vast majority of real prices. */
export function fmtPrice(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  if (n === 0) return '0.000';
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const decimals = Math.max(2, 4 - magnitude - 1);
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}


export type DateFormat =
  | 'DD-MMM-YYYY'
  | 'YYYY-MMM-DD'
  | 'DD-MM-YYYY'
  | 'MM-DD-YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'dddd, MMM DD, YYYY'
  | 'ddd, DD MMM, YYYY';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function formatDate(date: string | undefined | null, format: DateFormat = 'DD/MM/YYYY'): string {
  if (!date) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [, y, m, d] = match;
  const month = Number(m), day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return date;
  const monthShort = MONTHS[month - 1];
  switch (format) {
    case 'DD-MMM-YYYY': return d + '-' + monthShort + '-' + y;
    case 'YYYY-MMM-DD': return y + '-' + monthShort + '-' + d;
    case 'DD-MM-YYYY': return d + '-' + m + '-' + y;
    case 'MM-DD-YYYY': return m + '-' + d + '-' + y;
    case 'DD/MM/YYYY': return d + '/' + m + '/' + y;
    case 'MM/DD/YYYY': return m + '/' + d + '/' + y;
    case 'dddd, MMM DD, YYYY': {
      const weekday = WEEKDAYS[new Date(Date.UTC(month === 0 ? Number(y) : Number(y), month - 1, day)).getUTCDay()];
      return weekday + ', ' + monthShort + ' ' + d + ', ' + y;
    }
    case 'ddd, DD MMM, YYYY': {
      const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(Number(y), month - 1, day)).getUTCDay()];
      return weekday + ', ' + d + ' ' + monthShort + ', ' + y;
    }
    default: return d + '/' + m + '/' + y;
  }
}

export function dateInputFormat(format: DateFormat): Exclude<DateFormat, 'dddd, MMM DD, YYYY' | 'ddd, DD MMM, YYYY'> {
  return format === 'dddd, MMM DD, YYYY' || format === 'ddd, DD MMM, YYYY' ? 'DD-MMM-YYYY' : format;
}

export function parseDateInput(value: string, format: DateFormat): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y,m,d] = v.split('-').map(Number);
    const dt = new Date(Date.UTC(y,m-1,d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d ? v : null;
  }
  const patterns: Record<string, RegExp> = {
    'DD-MMM-YYYY': /^(\d{2})-([A-Za-z]{3})-(\d{4})$/,
    'YYYY-MMM-DD': /^(\d{4})-([A-Za-z]{3})-(\d{2})$/,
    'DD-MM-YYYY': /^(\d{2})-(\d{2})-(\d{4})$/,
    'MM-DD-YYYY': /^(\d{2})-(\d{2})-(\d{4})$/,
    'DD/MM/YYYY': /^(\d{2})\/(\d{2})\/(\d{4})$/,
    'MM/DD/YYYY': /^(\d{2})\/(\d{2})\/(\d{4})$/,
  };
  const match = patterns[format]?.exec(v);
  if (!match) return null;
  let y:number, m:number, d:number;
  if (format === 'DD-MMM-YYYY') {
    d = Number(match[1]); m = MONTHS.findIndex(x => x.toLowerCase() === match[2].toLowerCase()) + 1; y = Number(match[3]);
  } else if (format === 'YYYY-MMM-DD') {
    y = Number(match[1]); m = MONTHS.findIndex(x => x.toLowerCase() === match[2].toLowerCase()) + 1; d = Number(match[3]);
  } else {
    y = Number(match[3]);
    const a = Number(match[1]), b = Number(match[2]);
    d = format === 'MM-DD-YYYY' || format === 'MM/DD/YYYY' ? b : a;
    m = format === 'MM-DD-YYYY' || format === 'MM/DD/YYYY' ? a : b;
  }
  if (m < 1 || d < 1 || m > 12 || d > 31) return null;
  const dt = new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d
    ? y + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0')
    : null;
}
