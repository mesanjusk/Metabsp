'use client';

/**
 * Spreadsheet and CSV import.
 *
 * This used to run on `xlsx` (SheetJS) for both formats. That package carries
 * unfixed advisories on the public registry — prototype pollution and a
 * regular-expression denial of service, both reachable through parsing — and
 * upstream's fix is only distributed from their own CDN, which is not
 * something a build should depend on. It is replaced here by:
 *
 *   • a CSV parser written out below, because CSV does not warrant a
 *     dependency at all once quoting is handled properly; and
 *   • `read-excel-file` for real .xlsx, which is maintained, has no open
 *     advisories, and is loaded lazily so it never lands in the bundle of a
 *     user who does not import a spreadsheet.
 *
 * Both paths return the same shape the callers already expect: an array of
 * plain objects keyed by the header row.
 */

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

/**
 * A correct-enough CSV reader: RFC 4180 quoting, escaped quotes (`""`),
 * embedded commas and newlines inside quotes, and both CRLF and LF endings.
 *
 * Splitting on commas — the obvious shortcut — corrupts any row containing a
 * company name with a comma in it, which in a contact list is most of them.
 */
export function parseCsv(text) {
  // A byte-order mark survives Excel's "Save as CSV" and would otherwise end
  // up glued to the first header, silently breaking column matching.
  const input = String(text || '').replace(/^﻿/, '');

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Consume the LF of a CRLF pair so it does not open an empty row.
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => String(cell).trim() !== ''));
}

const rowsToObjects = (rows) => {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => String(header ?? '').trim());

  return rows.slice(1).map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [
        header,
        // Callers were written against `{ defval: '' }`, so an empty cell must
        // be an empty string rather than undefined.
        cells[index] == null ? '' : cells[index] instanceof Date ? cells[index].toISOString() : String(cells[index]),
      ])
    )
  );
};

export const parseTabularFile = async (file) => {
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase();

  if (extension === 'csv' || extension === 'txt' || file?.type === 'text/csv') {
    return rowsToObjects(parseCsv(await file.text()));
  }

  // The '/browser' entry point specifically: this runs against a File object
  // in the browser, and the package's export map has no bare '.' — importing
  // it unqualified fails the build rather than falling back.
  //
  // Dynamic, because the .xlsx reader is far larger than everything else on
  // this screen and most people import a CSV.
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const rows = await readXlsxFile(file);
  return rowsToObjects(rows);
};

export const parseContactsFromRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row || {}).map(([key, value]) => [normalizeKey(key).toLowerCase(), value])
      );

      const phone = digitsOnly(
        normalized.phone || normalized.mobile || normalized.number || normalized.whatsapp || normalized.contact
      );

      return {
        name: String(normalized.name || normalized.customer || normalized.contactname || '').trim(),
        phone,
        tags: String(normalized.tags || '').trim(),
        assignedAgent: String(normalized.assignedagent || normalized.agent || '').trim(),
      };
    })
    .filter((item) => item.phone);

/**
 * Catalogue rows for the catalogue-driven auto-reply flow: an item, its
 * specification, and a price the automation can quote back.
 */
export const parseCatalogRows = (rows = []) => {
  const cleaned = [];

  for (const raw of Array.isArray(rows) ? rows : []) {
    const row = Object.fromEntries(
      Object.entries(raw || {}).map(([key, value]) => [normalizeKey(key), value == null ? '' : String(value).trim()])
    );

    const itemName = row['Item Name'];
    const paperType = row['Paper Type'];
    const gsm = row.gsm;

    // A repeated header row is what you get when someone concatenates several
    // exports into one file; skip rather than importing the word "gsm".
    if (!itemName || String(itemName).toLowerCase() === 'item name') continue;
    if (!paperType || String(paperType).toLowerCase() === 'paper type') continue;
    if (!gsm || String(gsm).toLowerCase() === 'gsm') continue;

    // These two columns are frequently transposed between exports. A dispatch
    // time is a small whole number of days; a rate is larger and may have
    // decimals — so they can be told apart by shape rather than by position.
    const dispatchMaybe = row['Dispatch Days'];
    const rateMaybe = row.rate;
    const dispatchIsDays = /^\d+$/.test(String(dispatchMaybe || '').trim()) && Number(dispatchMaybe) <= 30;
    const rateIsPrice = /^\d+(\.\d+)?$/.test(String(rateMaybe || '').trim()) && Number(rateMaybe) > 30;

    cleaned.push({
      'Item Name': itemName,
      'Paper Type': paperType,
      gsm,
      size: row.size,
      'Print Side': row['Print Side'],
      'Printing Color': row['Printing Color'],
      'Lamination Side': row['Lamination Side'],
      'Lamination Type': row['Lamination Type'],
      Quantity: row.Quantity,
      'Dispatch Days': dispatchIsDays ? dispatchMaybe : rateMaybe,
      rate: rateIsPrice ? rateMaybe : dispatchMaybe,
    });
  }

  return cleaned.filter((row) => row['Item Name'] && row.rate);
};

// The previous name. Kept so nothing breaks on a rename that carries no
// meaning of its own.
export const parsePriceCatalogRows = parseCatalogRows;
