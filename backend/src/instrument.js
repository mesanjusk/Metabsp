// Sentry error tracking / APM — fully inert unless SENTRY_DSN is set (no
// account/DSN was available to verify this live in this environment; the
// Sentry.init()/setupExpressErrorHandler() API below is @sentry/node v8's
// current Express integration — confirm against your Sentry project's
// quickstart before relying on it in production).
//
// Must be required before any other app module — Sentry's auto-instrumentation
// (HTTP, Express, Mongo, etc.) patches modules at require time.
const Sentry = require('@sentry/node');

const isEnabled = Boolean(process.env.SENTRY_DSN);

if (isEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  });
}

module.exports = { Sentry, isEnabled };
