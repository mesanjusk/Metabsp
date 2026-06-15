import * as XLSX from 'xlsx';

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const parseTabularFile = async (file) => {
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
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
