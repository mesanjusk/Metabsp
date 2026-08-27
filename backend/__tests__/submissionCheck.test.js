const { isPlaceholder, REQUIRED_PERMISSIONS } = require('../scripts/submission-check');

describe('scripts/submission-check', () => {
  describe('isPlaceholder', () => {
    // A placeholder is worse than an unset value: it satisfies every
    // `if (!process.env.X)` guard in the codebase and then fails at the Graph
    // call, in production, with a message that does not mention config.
    it.each([
      'your_meta_app_secret',
      'your_app_id',
      'changeme',
      'CHANGEME',
      'change_me',
      '<your-secret>',
      '[REVIEWER PASSWORD]',
      'xxxxx',
      'TODO',
      'placeholder',
    ])('flags %s', (value) => {
      expect(isPlaceholder(value)).toBe(true);
    });

    it.each([
      'mongodb+srv://user:pass@cluster.mongodb.net/db',
      '1003501095782121',
      'https://app.example.com',
      'a7f3c9e1b4d28a06f5c7e9b1d3a5f7c9',
      'v23.0',
    ])('accepts %s', (value) => {
      expect(isPlaceholder(value)).toBe(false);
    });

    it('ignores surrounding whitespace', () => {
      expect(isPlaceholder('  changeme  ')).toBe(true);
    });
  });

  it('requests exactly three permissions, and public_profile is not one of them', () => {
    expect(REQUIRED_PERMISSIONS).toEqual([
      'whatsapp_business_messaging',
      'whatsapp_business_management',
      'business_management',
    ]);
    expect(REQUIRED_PERMISSIONS).not.toContain('public_profile');
  });
});
