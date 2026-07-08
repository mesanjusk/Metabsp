describe('instrument (Sentry)', () => {
  const originalDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
    jest.resetModules();
  });

  it('reports disabled when SENTRY_DSN is not set', () => {
    delete process.env.SENTRY_DSN;
    jest.resetModules();
    const { isEnabled } = require('../src/instrument');
    expect(isEnabled).toBe(false);
  });

  it('reports enabled and initializes Sentry when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = 'https://public@o0.ingest.sentry.io/0';
    jest.resetModules();
    const { isEnabled, Sentry } = require('../src/instrument');
    expect(isEnabled).toBe(true);
    expect(typeof Sentry.setupExpressErrorHandler).toBe('function');
  });
});
