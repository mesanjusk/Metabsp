import { describe, expect, it } from 'vitest';
import { parseCsv, parseContactsFromRows, parseCatalogRows } from '@/lib/client/importParsers';

/**
 * The CSV reader replaces `xlsx`, which carried unfixed advisories. Hand-rolled
 * parsers get quoting wrong, so these cover the cases that actually break real
 * contact exports rather than only the happy path.
 */
describe('CSV parsing', () => {
  it('reads a plain file into rows', () => {
    expect(parseCsv('name,phone\nAsha,919876543210\nRavi,919812345678')).toEqual([
      ['name', 'phone'],
      ['Asha', '919876543210'],
      ['Ravi', '919812345678'],
    ]);
  });

  it('keeps a comma that is inside quotes — the case naive splitting corrupts', () => {
    const rows = parseCsv('name,company\nAsha,"Kumar, Sons & Co"');
    expect(rows[1]).toEqual(['Asha', 'Kumar, Sons & Co']);
  });

  it('handles an escaped quote inside a quoted field', () => {
    expect(parseCsv('note\n"She said ""yes"" today"')[1]).toEqual(['She said "yes" today']);
  });

  it('handles a newline inside a quoted field', () => {
    const rows = parseCsv('name,address\nAsha,"12 Main St\nGondia"');
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe('12 Main St\nGondia');
  });

  it('reads CRLF line endings without leaving stray carriage returns', () => {
    const rows = parseCsv('name,phone\r\nAsha,919876543210\r\n');
    expect(rows).toEqual([
      ['name', 'phone'],
      ['Asha', '919876543210'],
    ]);
  });

  it('strips the byte-order mark Excel writes, which would corrupt the first header', () => {
    const rows = parseCsv('﻿name,phone\nAsha,919876543210');
    expect(rows[0][0]).toBe('name');
  });

  it('drops entirely blank lines rather than importing empty contacts', () => {
    expect(parseCsv('name,phone\n\nAsha,919876543210\n,\n')).toHaveLength(2);
  });

  it('returns nothing for empty input instead of throwing', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv(undefined as any)).toEqual([]);
  });
});

describe('contact mapping', () => {
  it('accepts any of the column names a real export might use for a number', () => {
    const rows = [
      { Name: 'Asha', Phone: '+91 98765 43210' },
      { name: 'Ravi', Mobile: '919812345678' },
      { name: 'Sunita', WhatsApp: '91-981-234-0000' },
    ];
    expect(parseContactsFromRows(rows).map((c) => c.phone)).toEqual([
      '919876543210',
      '919812345678',
      '919812340000',
    ]);
  });

  it('drops rows with no usable number rather than importing blanks', () => {
    expect(parseContactsFromRows([{ name: 'No Number', phone: '' }, { name: 'Letters', phone: 'abc' }])).toEqual([]);
  });

  it('tolerates junk input without throwing', () => {
    expect(parseContactsFromRows(null as any)).toEqual([]);
    expect(parseContactsFromRows([null as any, undefined as any])).toEqual([]);
  });
});

describe('catalogue rows', () => {
  const row = {
    'Item Name': 'Visiting Card',
    'Paper Type': 'Art Card',
    gsm: '300',
    'Dispatch Days': '3',
    rate: '450',
  };

  it('keeps a well-formed row', () => {
    expect(parseCatalogRows([row])).toHaveLength(1);
  });

  it('skips a repeated header row, which is what concatenated exports contain', () => {
    expect(parseCatalogRows([{ ...row, 'Item Name': 'Item Name' }])).toEqual([]);
  });

  it('recovers when dispatch days and rate are transposed', () => {
    const swapped = { ...row, 'Dispatch Days': '450', rate: '3' };
    const [parsed] = parseCatalogRows([swapped]);
    expect(parsed['Dispatch Days']).toBe('3');
    expect(parsed.rate).toBe('450');
  });
});
