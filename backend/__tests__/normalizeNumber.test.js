const normalizeWhatsAppNumber = require('../src/utils/normalizeNumber');

describe('normalizeWhatsAppNumber', () => {
  it('prepends 91 to a 10-digit number', () => {
    expect(normalizeWhatsAppNumber('9000000001')).toBe('919000000001');
  });

  it('leaves a number that already starts with 91 unchanged', () => {
    expect(normalizeWhatsAppNumber('919000000001')).toBe('919000000001');
  });

  it('strips non-digit characters before normalizing', () => {
    expect(normalizeWhatsAppNumber('+91 90000-00001')).toBe('919000000001');
  });

  it('coerces non-string input to a string first', () => {
    expect(normalizeWhatsAppNumber(9000000001)).toBe('919000000001');
  });
});
