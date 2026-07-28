// Ported unchanged from backend/src/utils/normalizeNumber.js.
export function normalizeWhatsAppNumber(number: unknown): string {
  const digits = String(number).trim().replace(/\D/g, '');
  if (digits.startsWith('91')) return digits;
  return '91' + digits;
}

export default normalizeWhatsAppNumber;
