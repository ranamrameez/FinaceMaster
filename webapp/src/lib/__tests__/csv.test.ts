import { describe, expect, it } from 'vitest';
import { parseCSV } from '../csv';

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
