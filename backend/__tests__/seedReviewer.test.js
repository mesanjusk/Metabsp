const ENV_KEYS = [
  'REVIEWER_LOGIN',
  'REVIEWER_PASSWORD',
  'REVIEWER_NAME',
  'REVIEWER_MOBILE',
  'REVIEWER_CONTACT_EMAIL',
  'PUBLIC_APP_URL',
  'FRONTEND_URL',
  'MONGO_URI',
];

describe('scripts/seed-reviewer', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  const load = () => require('../scripts/seed-reviewer');

  it('refuses to run with no credentials rather than inventing a default login', () => {
    const { readConfig } = load();
    const { problems } = readConfig();
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('REVIEWER_LOGIN'),
        expect.stringContaining('REVIEWER_PASSWORD'),
        expect.stringContaining('MONGO_URI'),
      ])
    );
  });

  it('rejects a password short enough to be guessed by a reviewer-facing account', () => {
    const { readConfig, MIN_PASSWORD_LENGTH } = load();
    process.env.REVIEWER_LOGIN = 'meta_reviewer';
    process.env.REVIEWER_PASSWORD = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';

    expect(readConfig().problems).toEqual([expect.stringContaining(`at least ${MIN_PASSWORD_LENGTH}`)]);
  });

  it('accepts a complete configuration', () => {
    const { readConfig } = load();
    process.env.REVIEWER_LOGIN = 'meta_reviewer';
    process.env.REVIEWER_PASSWORD = 'a-sufficiently-long-password';
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';

    expect(readConfig().problems).toEqual([]);
  });

  it('falls back to FRONTEND_URL when PUBLIC_APP_URL is unset', () => {
    const { readConfig } = load();
    process.env.FRONTEND_URL = 'https://app.example.com';
    expect(readConfig().appUrl).toBe('https://app.example.com');
  });

  // The instructions block is the field the last submission got wrong, so its
  // contents are worth asserting rather than eyeballing.
  it('emits instructions naming the label the login form actually renders', () => {
    const { readConfig, reportInstructions } = load();
    process.env.REVIEWER_LOGIN = 'meta_reviewer';
    process.env.REVIEWER_PASSWORD = 'a-sufficiently-long-password';
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.REVIEWER_CONTACT_EMAIL = 'support@example.com';
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';

    const text = reportInstructions(readConfig());

    expect(text).toContain('https://app.example.com/login');
    expect(text).toContain('User Name: meta_reviewer');
    expect(text).toContain('Password: a-sufficiently-long-password');
    expect(text).toContain('support@example.com');
    // The dashboard is behind auth and signup needs a WhatsApp OTP; saying
    // otherwise is what stalled the 2026-07-13 submission.
    expect(text).toMatch(/Self-registration is not possible/);
    // "Mobile / Username" is the label on /bulk-login, a different page.
    expect(text).not.toContain('Mobile / Username');
  });

  it('tells you which variable to set instead of printing a bracketed placeholder', () => {
    const { readConfig, reportInstructions } = load();
    process.env.REVIEWER_LOGIN = 'meta_reviewer';
    process.env.REVIEWER_PASSWORD = 'a-sufficiently-long-password';
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';

    const text = reportInstructions(readConfig());

    expect(text).toContain('set PUBLIC_APP_URL');
    expect(text).toContain('set REVIEWER_CONTACT_EMAIL');
  });
});
