import { describe, expect, it } from 'vitest';
import { parseCSV, toCSV } from '../csv';

describe('parseCSV', () => {
  it('parses a simple comma-separated file with a header row', () => {
    const text = 'Date,Description,Amount\n2026-01-01,Groceries,-50.00\n2026-01-05,Salary,2000.00';
    expect(parseCSV(text)).toEqual([
      ['Date', 'Description', 'Amount'],
      ['2026-01-01', 'Groceries', '-50.00'],
      ['2026-01-05', 'Salary', '2000.00'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const text = 'Date,Description,Amount\n2026-01-01,"Groceries, Inc.",-50.00';
    expect(parseCSV(text)).toEqual([
      ['Date', 'Description', 'Amount'],
      ['2026-01-01', 'Groceries, Inc.', '-50.00'],
    ]);
  });

  it('handles escaped double-quotes inside a quoted field', () => {
    const text = 'Note\n"She said ""hi"""';
    expect(parseCSV(text)).toEqual([['Note'], ['She said "hi"']]);
  });

  it('handles CRLF line endings', () => {
    const text = 'A,B\r\n1,2\r\n3,4';
    expect(parseCSV(text)).toEqual([['A', 'B'], ['1', '2'], ['3', '4']]);
  });

  it('handles a file with no trailing newline', () => {
    const text = 'A,B\n1,2';
    expect(parseCSV(text)).toEqual([['A', 'B'], ['1', '2']]);
  });

  it('skips fully blank lines', () => {
    const text = 'A,B\n1,2\n\n3,4\n';
    expect(parseCSV(text)).toEqual([['A', 'B'], ['1', '2'], ['3', '4']]);
  });
});

describe('toCSV', () => {
  it('joins simple fields with commas and CRLF rows', () => {
    expect(toCSV([['Date', 'Amount'], ['2026-01-01', -50]])).toBe('Date,Amount\r\n2026-01-01,-50');
  });

  it('quotes a field containing a comma', () => {
    expect(toCSV([['Groceries, Inc.', 5]])).toBe('"Groceries, Inc.",5');
  });

  it('escapes embedded quotes by doubling them', () => {
    expect(toCSV([['She said "hi"']])).toBe('"She said ""hi"""');
  });

  it('round-trips through parseCSV', () => {
    const rows = [['Date', 'Description', 'Amount'], ['2026-01-01', 'Rent, Feb', '-1200']];
    expect(parseCSV(toCSV(rows))).toEqual(rows.map((r) => r.map(String)));
  });
});
