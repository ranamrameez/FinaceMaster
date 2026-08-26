import * as XLSX from 'xlsx';

export interface ParsedXlsxSheet {
  name: string;
  /** Raw cell grid, row 0 is whatever the sheet's own first row is (not
   * necessarily a header — the caller decides). Dates come through as
   * real `Date` objects (`cellDates: true`), matching what
   * `fundsDailyHistoryImport.ts`'s `parseDailyBalanceRows` expects. */
  rows: (string | number | Date | null)[][];
}

/** Thin adapter around the `xlsx` (SheetJS) library — only reads cell
 * values, never evaluates formulas or macros. Used for the Funds "Daily
 * History Import," which needs every sheet in a workbook (unlike the CSV
 * Snapshot Import, which only ever has one table to read). Kept as its
 * own file so the calc modules that consume its output stay dependency-
 * free and unit-testable without needing a real xlsx binary. */
export function parseXlsxWorkbook(buffer: ArrayBuffer): ParsedXlsxSheet[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });
    return { name, rows };
  });
}
