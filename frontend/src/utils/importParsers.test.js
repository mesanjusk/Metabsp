import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';

import {
  UnsupportedSpreadsheetError,
  parseContactsFromRows,
  parseCsv,
  parsePriceCatalogRows,
  parseTabularFile,
} from './importParsers';

// jsdom's File does not implement arrayBuffer()/text() the way the parser
// needs, so this stands in for the browser's File — same three members the
// parser touches, nothing more.
const fileFrom = (name, data) => ({
  name,
  text: async () => (typeof data === 'string' ? data : new TextDecoder().decode(data)),
  arrayBuffer: async () => (typeof data === 'string' ? new TextEncoder().encode(data).buffer : data),
});

const xlsxBufferFrom = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
};

describe('parseCsv', () => {
  it('splits plain rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps commas and newlines inside quoted fields', () => {
    expect(parseCsv('name,note\n"Doe, Jane","line one\nline two"')).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'line one\nline two'],
    ]);
  });

  it('unescapes a doubled quote', () => {
    expect(parseCsv('quote\n"she said ""hi"""')).toEqual([['quote'], ['she said "hi"']]);
  });

  it('does not emit a phantom row for a trailing newline', () => {
    expect(parseCsv('a\n1\n')).toEqual([['a'], ['1']]);
  });

  it('normalises CRLF', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseTabularFile', () => {
  it('reads a CSV into header-keyed objects', async () => {
    const rows = await parseTabularFile(fileFrom('contacts.csv', 'name,phone\nJane,+91 98765 43210'));
    expect(rows).toEqual([{ name: 'Jane', phone: '+91 98765 43210' }]);
  });

  it('fills missing trailing cells with an empty string', async () => {
    const rows = await parseTabularFile(fileFrom('contacts.csv', 'name,phone,tags\nJane,123'));
    expect(rows).toEqual([{ name: 'Jane', phone: '123', tags: '' }]);
  });

  it('skips blank rows', async () => {
    const rows = await parseTabularFile(fileFrom('contacts.csv', 'name,phone\nJane,123\n,\nJohn,456'));
    expect(rows.map((r) => r.name)).toEqual(['Jane', 'John']);
  });

  it('reads an .xlsx workbook', async () => {
    const buffer = await xlsxBufferFrom([
      ['name', 'phone'],
      ['Jane', 9876543210],
    ]);
    const rows = await parseTabularFile(fileFrom('contacts.xlsx', buffer));
    expect(rows).toEqual([{ name: 'Jane', phone: 9876543210 }]);
  });

  it('rejects legacy .xls with an instruction rather than returning nothing', async () => {
    await expect(parseTabularFile(fileFrom('old.xls', 'irrelevant'))).rejects.toBeInstanceOf(
      UnsupportedSpreadsheetError
    );
    await expect(parseTabularFile(fileFrom('old.xls', 'irrelevant'))).rejects.toThrow(/re-save it as \.xlsx/);
  });
});

describe('parseContactsFromRows', () => {
  it('accepts any of the phone column spellings and strips non-digits', () => {
    expect(parseContactsFromRows([{ Name: 'Jane', Mobile: '+91 (98765) 43210' }])).toEqual([
      { name: 'Jane', phone: '919876543210', tags: '', assignedAgent: '' },
    ]);
  });

  it('drops rows with no phone number at all', () => {
    expect(parseContactsFromRows([{ name: 'Jane' }, { name: 'John', phone: '123' }])).toHaveLength(1);
  });
});

describe('parsePriceCatalogRows', () => {
  it('keeps a complete row and swaps rate/dispatch when they arrive transposed', () => {
    const [row] = parsePriceCatalogRows([
      { 'Item Name': 'Flyer', 'Paper Type': 'Art', gsm: '130', 'Dispatch Days': '250', rate: '3' },
    ]);
    expect(row.rate).toBe('250');
    expect(row['Dispatch Days']).toBe('3');
  });

  it('drops repeated header rows', () => {
    expect(
      parsePriceCatalogRows([{ 'Item Name': 'Item Name', 'Paper Type': 'Paper Type', gsm: 'gsm' }])
    ).toEqual([]);
  });
});
