/** Minimal RFC4180-ish CSV parser — good enough for bank statement exports
 * (quoted fields, escaped `""` quotes, commas inside quotes). Not trying to
 * handle every CSV dialect; this is a personal-finance app parsing your own
 * bank's export, not a general-purpose CSV library. Returns rows of raw
 * string cells; the caller decides which column means what (see the
 * "map these columns" import UI — MODULES_PLAN.md explicitly avoids a
 * per-bank-format hardcoded parser). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\r') {
      // ignore, \n (or end) handles the row break
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  // Final field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}
