// Spreadsheet import used to run on `xlsx` (SheetJS), which carries two
// unfixed advisories — prototype pollution and a ReDoS — with no patched
// release on npm, on a direct production dependency that parses files an
// end user uploads. That is the worst combination available, so the reader
// is ExcelJS now.
//
// One capability was lost with it, deliberately: ExcelJS reads the modern
// OOXML `.xlsx` format but not the legacy BIFF `.xls` one. Rather than
// silently returning an empty sheet for a `.xls` upload, parseTabularFile
// rejects it with an instruction the user can act on. Every caller surfaces
// the message.
//
// ExcelJS itself is imported dynamically inside parseTabularFile, so it stays
// out of the entry bundle.

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const extensionOf = (name) => String(name || '').split('.').pop()?.toLowerCase() || '';

export class UnsupportedSpreadsheetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedSpreadsheetError';
  }
}

/**
 * RFC 4180 CSV: comma-separated, `"` quoting, `""` for a literal quote inside
 * a quoted field, and newlines allowed inside quotes. Hand-rolled because the
 * alternative is another parsing dependency for eleven lines of state machine.
 */
export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // A trailing newline produces one empty final row; drop it rather than
    // emitting a record of empty strings.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  const source = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') endField();
    else if (char === '\n') endRow();
    else field += char;
  }

  if (field !== '' || row.length) endRow();

  return rows;
};

/**
 * Header row → array of objects, matching what `XLSX.utils.sheet_to_json(…,
 * { defval: '' })` produced: missing cells become '', and a row whose cells
 * are all empty is skipped.
 */
const rowsToObjects = (rows) => {
  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h ?? '').trim());

  return rows
    .slice(1)
    .filter((cells) => cells.some((cell) => String(cell ?? '').trim() !== ''))
    .map((cells) =>
      Object.fromEntries(
        headers.map((header, index) => [header, cells[index] === undefined || cells[index] === null ? '' : cells[index]])
      )
    );
};

// ExcelJS hands back rich objects for some cell types. Flatten them to what a
// caller expects to compare and trim: a formula cell yields its computed
// result, a hyperlink or rich-text cell its visible text, a date its ISO form.
const cellValue = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;
  if ('result' in value) return cellValue(value.result);
  if ('text' in value) return cellValue(value.text);
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
  if ('hyperlink' in value) return value.hyperlink;
  if ('error' in value) return '';
  return String(value);
};

export const parseTabularFile = async (file) => {
  const extension = extensionOf(file?.name);

  if (extension === 'xls') {
    throw new UnsupportedSpreadsheetError(
      'Legacy .xls files are not supported. Open the file and re-save it as .xlsx (or export it as CSV), then upload again.'
    );
  }

  if (extension === 'csv' || extension === 'txt') {
    return rowsToObjects(parseCsv(await file.text()));
  }

  // Loaded on demand. ExcelJS is ~600 kB minified; importing it at module
  // scope put all of it in the entry chunk, which every dashboard visitor
  // downloads whether or not they ever import a spreadsheet.
  const { default: ExcelJS } = await import('exceljs');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    // `row.values` is 1-indexed with a leading hole, hence the slice.
    const cells = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows.push(cells.map(cellValue));
  });

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

export const parsePriceCatalogRows = (rows = []) => {
  const cleaned = [];

  for (const raw of Array.isArray(rows) ? rows : []) {
    const row = Object.fromEntries(
      Object.entries(raw || {}).map(([key, value]) => [normalizeKey(key), value == null ? '' : String(value).trim()])
    );

    const itemName = row['Item Name'];
    const paperType = row['Paper Type'];
    const gsm = row['gsm'];

    if (!itemName || String(itemName).toLowerCase() === 'item name') continue;
    if (!paperType || String(paperType).toLowerCase() === 'paper type') continue;
    if (!gsm || String(gsm).toLowerCase() === 'gsm') continue;

    const dispatchMaybe = row['Dispatch Days'];
    const rateMaybe = row.rate;
    const dispatchIsDays = /^\d+$/.test(String(dispatchMaybe || '').trim()) && Number(dispatchMaybe) <= 30;
    const rateIsPrice = /^\d+(\.\d+)?$/.test(String(rateMaybe || '').trim()) && Number(rateMaybe) > 30;

    const normalized = {
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
    };

    cleaned.push(normalized);
  }

  return cleaned.filter((row) => row['Item Name'] && row.rate);
};
